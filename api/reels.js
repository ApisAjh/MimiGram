/**
 * GET /api/reels - vertical feed of reels
 */

import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 20);

    const supabase = getServiceClient();

    let query = supabase
      .from('posts')
      .select(`
        id,
        caption,
        media_path,
        media_type,
        post_type,
        thumbnail_path,
        duration_seconds,
        created_at,
        profiles:user_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('status', 'published')
      .eq('media_type', 'video')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: posts, error: qErr } = await query;
    if (qErr) {
      console.error(qErr);
      return error(res, 500, 'Failed to fetch reels');
    }

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;

    const postIds = items.map((p) => p.id);
    if (postIds.length === 0) {
      return json(res, 200, { reels: [], nextCursor: null });
    }

    const [likesRes, commentsRes, userLikesRes, followsRes] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
      supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', items.map((p) => p.user?.id).filter(Boolean)),
    ]);

    const likeCounts = {};
    (likesRes.data || []).forEach((l) => {
      likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
    });
    const commentCounts = {};
    (commentsRes.data || []).forEach((c) => {
      commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
    });
    const likedSet = new Set((userLikesRes.data || []).map((l) => l.post_id));
    const followingSet = new Set((followsRes.data || []).map((f) => f.following_id));

    const base = process.env.SUPABASE_URL;
    const enriched = items.map((p) => {
      const { profiles, ...rest } = p;
      const u = profiles || p.user || null;
      return {
        ...rest,
        user: u,
        likes_count: likeCounts[p.id] || 0,
        comments_count: commentCounts[p.id] || 0,
        liked_by_me: likedSet.has(p.id),
        is_following: u ? followingSet.has(u.id) : false,
        media_url: `${base}/storage/v1/object/public/media/${p.media_path}`,
        thumbnail_url: p.thumbnail_path
          ? `${base}/storage/v1/object/public/media/${p.thumbnail_path}`
          : null,
      };
    });

    return json(res, 200, { reels: enriched, nextCursor });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
