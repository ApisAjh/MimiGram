/**
 * GET    /api/posts
 * POST   /api/posts
 * DELETE /api/posts?id=
 * PATCH  /api/posts?id=  (status draft|published)
 */
import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method === 'GET') return getPosts(req, res);
  if (req.method === 'POST') return createPost(req, res);
  if (req.method === 'DELETE') return deletePost(req, res);
  if (req.method === 'PATCH') return patchPost(req, res);
  return error(res, 405, 'Method not allowed', null, req);
}

function mediaUrl(path) {
  const base = process.env.SUPABASE_URL;
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/media/${path}`;
}

function mapPost(p, extra = {}) {
  const { profiles, ...rest } = p;
  return {
    ...rest,
    user: profiles || null,
    media_url: mediaUrl(p.media_path),
    thumbnail_url: p.thumbnail_path ? mediaUrl(p.thumbnail_path) : null,
    ...extra,
  };
}

async function getPosts(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '15', 10), 50);
    const userId = url.searchParams.get('user_id');
    const postType = url.searchParams.get('type'); // post | reel
    const mediaType = url.searchParams.get('media_type'); // image | video
    const status = url.searchParams.get('status') || 'published'; // published | draft
    const includeDrafts = url.searchParams.get('include_drafts') === '1';

    const supabase = getServiceClient();
    let query = supabase
      .from('posts')
      .select(
        `
        id, user_id, caption, media_path, media_type, post_type, thumbnail_path, duration_seconds, status, created_at,
        profiles:user_id (id, username, display_name, avatar_url)
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // Drafts only for owner
    if (status === 'draft') {
      query = query.eq('status', 'draft').eq('user_id', user.id);
    } else if (includeDrafts && userId === user.id) {
      query = query.in('status', ['published', 'draft']);
    } else {
      query = query.eq('status', 'published');
    }

    if (userId) query = query.eq('user_id', userId);
    if (postType === 'post' || postType === 'reel') query = query.eq('post_type', postType);
    if (mediaType === 'image' || mediaType === 'video') query = query.eq('media_type', mediaType);
    if (cursor) query = query.lt('created_at', cursor);

    const { data: posts, error: qErr } = await query;
    if (qErr) {
      console.error('getPosts:', qErr);
      return error(res, 500, 'Failed to fetch posts', null, req);
    }

    const hasMore = (posts || []).length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts || [];
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;
    const postIds = items.map((p) => p.id);

    if (postIds.length === 0) return json(res, 200, { posts: [], nextCursor: null }, req);

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

    const enriched = items.map((p) =>
      mapPost(p, {
        likes_count: likeCounts[p.id] || 0,
        comments_count: commentCounts[p.id] || 0,
        liked_by_me: likedSet.has(p.id),
        bookmarked_by_me: bookmarkedSet.has(p.id),
      })
    );

    return json(res, 200, { posts: enriched, nextCursor }, req);
  } catch (err) {
    console.error('getPosts:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}

async function createPost(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!rateLimit(`post:${user.id}`, 10, 60000)) return error(res, 429, 'Too many posts', null, req);

    const body = await parseBody(req);
    const {
      caption = '',
      media_path,
      media_type,
      post_type = 'post',
      thumbnail_path = null,
      duration_seconds = null,
      status = 'published',
    } = body;

    if (!media_path || !media_type) return error(res, 400, 'media_path and media_type required', null, req);
    if (!['image', 'video'].includes(media_type)) return error(res, 400, 'Invalid media_type', null, req);
    if (!['post', 'reel'].includes(post_type)) return error(res, 400, 'Invalid post_type', null, req);
    if (!['published', 'draft'].includes(status)) return error(res, 400, 'Invalid status', null, req);
    if (caption.length > 2200) return error(res, 400, 'Caption too long', null, req);
    if (post_type === 'reel' && media_type !== 'video') return error(res, 400, 'Reels must be video', null, req);
    if (duration_seconds != null && duration_seconds > 90) return error(res, 400, 'Reel max 90s', null, req);
    if (!media_path.startsWith(`${user.id}/`)) return error(res, 403, 'Invalid media path', null, req);

    const supabase = getServiceClient();
    const { data: post, error: insertErr } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        caption: (caption || '').trim(),
        media_path,
        media_type,
        post_type,
        thumbnail_path,
        duration_seconds,
        visibility: 'public',
        status,
      })
      .select(
        `
        id, user_id, caption, media_path, media_type, post_type, thumbnail_path, duration_seconds, status, created_at,
        profiles:user_id (id, username, display_name, avatar_url)
      `
      )
      .single();

    if (insertErr) {
      console.error('createPost:', insertErr);
      return error(res, 500, 'Failed to create post', null, req);
    }

    return json(
      res,
      201,
      {
        post: mapPost(post, {
          likes_count: 0,
          comments_count: 0,
          liked_by_me: false,
          bookmarked_by_me: false,
        }),
      },
      req
    );
  } catch (err) {
    console.error('createPost:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}

async function deletePost(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');
    if (!id) return error(res, 400, 'id required', null, req);

    const supabase = getServiceClient();
    const { data: post, error: findErr } = await supabase
      .from('posts')
      .select('id, user_id, media_path, thumbnail_path')
      .eq('id', id)
      .maybeSingle();
    if (findErr || !post) return error(res, 404, 'Post not found', null, req);
    if (post.user_id !== user.id) return error(res, 403, 'Forbidden', null, req);

    await supabase.from('posts').delete().eq('id', id);
    const paths = [post.media_path, post.thumbnail_path].filter(Boolean);
    if (paths.length) {
      try {
        await supabase.storage.from('media').remove(paths);
      } catch (e) {
        console.error('storage remove', e);
      }
    }
    return json(res, 200, { ok: true }, req);
  } catch (err) {
    console.error('deletePost:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}

async function patchPost(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');
    if (!id) return error(res, 400, 'id required', null, req);
    const body = await parseBody(req);

    const supabase = getServiceClient();
    const { data: post } = await supabase.from('posts').select('id, user_id').eq('id', id).maybeSingle();
    if (!post) return error(res, 404, 'Post not found', null, req);
    if (post.user_id !== user.id) return error(res, 403, 'Forbidden', null, req);

    const updates = { updated_at: new Date().toISOString() };
    if (typeof body.caption === 'string') updates.caption = body.caption.slice(0, 2200);
    if (body.status === 'published' || body.status === 'draft') updates.status = body.status;

    const { data: updated, error: uErr } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
      .select(
        `
        id, user_id, caption, media_path, media_type, post_type, thumbnail_path, duration_seconds, status, created_at,
        profiles:user_id (id, username, display_name, avatar_url)
      `
      )
      .single();
    if (uErr) return error(res, 500, 'Update failed', null, req);
    return json(res, 200, { post: mapPost(updated) }, req);
  } catch (err) {
    console.error('patchPost:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}
