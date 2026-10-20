/**
 * GET /api/posts - Feed with pagination
 * POST /api/posts - Create post (metadata after media upload)
 */

import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  if (req.method === 'GET') {
    return getPosts(req, res);
  }
  if (req.method === 'POST') {
    return createPost(req, res);
  }
  return error(res, 405, 'Method not allowed');
}

async function getPosts(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '15', 10), 30);
    const userId = url.searchParams.get('user_id');
    const postType = url.searchParams.get('type'); // post | reel | null

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
        user:profiles!posts_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (postType === 'post' || postType === 'reel') {
      query = query.eq('post_type', postType);
    }
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: posts, error: qErr } = await query;
    if (qErr) {
      console.error('getPosts error:', qErr);
      return error(res, 500, 'Failed to fetch posts');
    }

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;

    // Enrich with like/comment counts and user state
    const postIds = items.map((p) => p.id);
    if (postIds.length === 0) {
      return json(res, 200, { posts: [], nextCursor: null });
    }

    const [likesRes, commentsRes, userLikesRes, userBookmarksRes] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
      supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
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
    const bookmarkedSet = new Set((userBookmarksRes.data || []).map((b) => b.post_id));

    const enriched = items.map((p) => ({
      ...p,
      likes_count: likeCounts[p.id] || 0,
      comments_count: commentCounts[p.id] || 0,
      liked_by_me: likedSet.has(p.id),
      bookmarked_by_me: bookmarkedSet.has(p.id),
      media_url: buildMediaUrl(p.media_path),
      thumbnail_url: p.thumbnail_path ? buildMediaUrl(p.thumbnail_path) : null,
    }));

    return json(res, 200, { posts: enriched, nextCursor });
  } catch (err) {
    console.error('getPosts:', err);
    return error(res, 500, 'Internal server error');
  }
}

async function createPost(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (!rateLimit(`post:${user.id}`, 10, 60000)) {
      return error(res, 429, 'Too many posts. Please wait.');
    }

    const body = await parseBody(req);
    const {
      caption = '',
      media_path,
      media_type,
      post_type = 'post',
      thumbnail_path = null,
      duration_seconds = null,
    } = body;

    if (!media_path || !media_type) {
      return error(res, 400, 'media_path and media_type are required');
    }
    if (!['image', 'video'].includes(media_type)) {
      return error(res, 400, 'Invalid media_type');
    }
    if (!['post', 'reel'].includes(post_type)) {
      return error(res, 400, 'Invalid post_type');
    }
    if (caption.length > 2200) {
      return error(res, 400, 'Caption too long');
    }
    if (post_type === 'reel' && media_type !== 'video') {
      return error(res, 400, 'Reels must be video');
    }
    if (duration_seconds != null && duration_seconds > 90) {
      return error(res, 400, 'Reel duration exceeds 90 seconds');
    }

    // Validate path belongs to user (prefix)
    if (!media_path.startsWith(`${user.id}/`)) {
      return error(res, 403, 'Invalid media path');
    }

    const supabase = getServiceClient();
    const { data: post, error: insertErr } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        caption: caption.trim(),
        media_path,
        media_type,
        post_type,
        thumbnail_path,
        duration_seconds,
        visibility: 'public',
        status: 'published',
      })
      .select(`
        id,
        caption,
        media_path,
        media_type,
        post_type,
        thumbnail_path,
        duration_seconds,
        created_at,
        user:profiles!posts_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .single();

    if (insertErr) {
      console.error('createPost error:', insertErr);
      return error(res, 500, 'Failed to create post');
    }

    return json(res, 201, {
      post: {
        ...post,
        likes_count: 0,
        comments_count: 0,
        liked_by_me: false,
        bookmarked_by_me: false,
        media_url: buildMediaUrl(post.media_path),
        thumbnail_url: post.thumbnail_path ? buildMediaUrl(post.thumbnail_path) : null,
      },
    });
  } catch (err) {
    console.error('createPost:', err);
    return error(res, 500, 'Internal server error');
  }
}

function buildMediaUrl(path) {
  const base = process.env.SUPABASE_URL;
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/media/${path}`;
}
