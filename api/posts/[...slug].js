/**
 * Catch-all posts routes (1 serverless function)
 * GET/POST /api/posts
 * GET/DELETE /api/posts/:id
 * POST /api/posts/:id/like
 * GET/POST/DELETE /api/posts/:id/comments
 * POST /api/posts/:id/bookmark
 * POST /api/posts/upload-url
 */

import { requireAuth } from '../../lib/session.js';
import { getServiceClient } from '../../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../../lib/http.js';
import crypto from 'crypto';

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760', 10);
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE || '52428800', 10);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  const slug = resolveSlug(req);
  // /api/posts              → []
  // /api/posts/upload-url   → ['upload-url']
  // /api/posts/:id          → [id]
  // /api/posts/:id/like     → [id, 'like']

  if (slug.length === 0) {
    if (req.method === 'GET') return getPosts(req, res);
    if (req.method === 'POST') return createPost(req, res);
    return error(res, 405, 'Method not allowed');
  }

  if (slug[0] === 'upload-url' && req.method === 'POST') {
    return uploadUrl(req, res);
  }

  const id = slug[0];
  const action = slug[1];

  if (!action) {
    if (req.method === 'GET') return getPost(req, res, id);
    if (req.method === 'DELETE') return deletePost(req, res, id);
    return error(res, 405, 'Method not allowed');
  }

  if (action === 'like' && req.method === 'POST') return toggleLike(req, res, id);
  if (action === 'bookmark' && req.method === 'POST') return toggleBookmark(req, res, id);
  if (action === 'comments') {
    if (req.method === 'GET') return listComments(req, res, id);
    if (req.method === 'POST') return addComment(req, res, id);
    if (req.method === 'DELETE') return deleteComment(req, res, id);
  }

  return error(res, 404, 'Not found');
}

function resolveSlug(req) {
  const slug = req.query?.slug;
  if (slug) return Array.isArray(slug) ? slug : [slug];
  const raw = (req.url || '').split('?')[0];
  const match = raw.match(/\/api\/posts\/?(.*)$/i);
  if (!match || !match[1]) return [];
  return match[1].split('/').filter(Boolean);
}

function mediaUrl(path) {
  const base = process.env.SUPABASE_URL;
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/media/${path}`;
}

async function getPosts(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '15', 10), 30);
    const userId = url.searchParams.get('user_id');
    const postType = url.searchParams.get('type');

    const supabase = getServiceClient();
    let query = supabase
      .from('posts')
      .select(`
        id, caption, media_path, media_type, post_type, thumbnail_path, duration_seconds, created_at,
        user:profiles!posts_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (userId) query = query.eq('user_id', userId);
    if (postType === 'post' || postType === 'reel') query = query.eq('post_type', postType);
    if (cursor) query = query.lt('created_at', cursor);

    const { data: posts, error: qErr } = await query;
    if (qErr) return error(res, 500, 'Failed to fetch posts');

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;
    const postIds = items.map((p) => p.id);

    if (postIds.length === 0) return json(res, 200, { posts: [], nextCursor: null });

    const [likesRes, commentsRes, userLikesRes, userBookmarksRes] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
      supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
    ]);

    const likeCounts = {};
    (likesRes.data || []).forEach((l) => { likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1; });
    const commentCounts = {};
    (commentsRes.data || []).forEach((c) => { commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1; });
    const likedSet = new Set((userLikesRes.data || []).map((l) => l.post_id));
    const bookmarkedSet = new Set((userBookmarksRes.data || []).map((b) => b.post_id));

    const enriched = items.map((p) => ({
      ...p,
      likes_count: likeCounts[p.id] || 0,
      comments_count: commentCounts[p.id] || 0,
      liked_by_me: likedSet.has(p.id),
      bookmarked_by_me: bookmarkedSet.has(p.id),
      media_url: mediaUrl(p.media_path),
      thumbnail_url: p.thumbnail_path ? mediaUrl(p.thumbnail_path) : null,
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
    if (!rateLimit(`post:${user.id}`, 10, 60000)) return error(res, 429, 'Too many posts');

    const body = await parseBody(req);
    const {
      caption = '',
      media_path,
      media_type,
      post_type = 'post',
      thumbnail_path = null,
      duration_seconds = null,
    } = body;

    if (!media_path || !media_type) return error(res, 400, 'media_path and media_type required');
    if (!['image', 'video'].includes(media_type)) return error(res, 400, 'Invalid media_type');
    if (!['post', 'reel'].includes(post_type)) return error(res, 400, 'Invalid post_type');
    if (caption.length > 2200) return error(res, 400, 'Caption too long');
    if (post_type === 'reel' && media_type !== 'video') return error(res, 400, 'Reels must be video');
    if (duration_seconds != null && duration_seconds > 90) return error(res, 400, 'Reel max 90s');
    if (!media_path.startsWith(`${user.id}/`)) return error(res, 403, 'Invalid media path');

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
        id, caption, media_path, media_type, post_type, thumbnail_path, duration_seconds, created_at,
        user:profiles!posts_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .single();

    if (insertErr) return error(res, 500, 'Failed to create post');

    return json(res, 201, {
      post: {
        ...post,
        likes_count: 0,
        comments_count: 0,
        liked_by_me: false,
        bookmarked_by_me: false,
        media_url: mediaUrl(post.media_path),
        thumbnail_url: post.thumbnail_path ? mediaUrl(post.thumbnail_path) : null,
      },
    });
  } catch (err) {
    console.error('createPost:', err);
    return error(res, 500, 'Internal server error');
  }
}

async function getPost(req, res, id) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const supabase = getServiceClient();
    const { data: post, error: qErr } = await supabase
      .from('posts')
      .select(`
        id, caption, media_path, media_type, post_type, thumbnail_path, duration_seconds, created_at,
        user:profiles!posts_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (qErr || !post) return error(res, 404, 'Post not found');

    const [likes, comments, userLike, userBookmark] = await Promise.all([
      supabase.from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', id),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', id),
      supabase.from('post_likes').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('bookmarks').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
    ]);

    return json(res, 200, {
      post: {
        ...post,
        likes_count: likes.count || 0,
        comments_count: comments.count || 0,
        liked_by_me: !!userLike.data,
        bookmarked_by_me: !!userBookmark.data,
        media_url: mediaUrl(post.media_path),
        thumbnail_url: post.thumbnail_path ? mediaUrl(post.thumbnail_path) : null,
      },
    });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function deletePost(req, res, id) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const supabase = getServiceClient();
    const { data: post } = await supabase
      .from('posts')
      .select('id, user_id, media_path, thumbnail_path')
      .eq('id', id)
      .single();

    if (!post) return error(res, 404, 'Post not found');
    if (post.user_id !== user.id) return error(res, 403, 'Forbidden');

    await supabase.from('posts').update({ status: 'deleted' }).eq('id', id);
    try {
      const paths = [post.media_path];
      if (post.thumbnail_path) paths.push(post.thumbnail_path);
      await supabase.storage.from('media').remove(paths);
    } catch (e) {
      console.warn('Storage cleanup:', e.message);
    }
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function toggleLike(req, res, id) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!rateLimit(`like:${user.id}`, 60, 60000)) return error(res, 429, 'Too many actions');

    const supabase = getServiceClient();
    const { data: post } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', id)
      .eq('status', 'published')
      .single();
    if (!post) return error(res, 404, 'Post not found');

    const { data: existing } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('post_likes').delete().eq('id', existing.id);
      return json(res, 200, { liked: false });
    }

    await supabase.from('post_likes').insert({ post_id: id, user_id: user.id });
    if (post.user_id !== user.id) {
      const { data: recent } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', post.user_id)
        .eq('actor_id', user.id)
        .eq('type', 'like')
        .eq('post_id', id)
        .maybeSingle();
      if (!recent) {
        await supabase.from('notifications').insert({
          recipient_id: post.user_id,
          actor_id: user.id,
          type: 'like',
          post_id: id,
        });
      }
    }
    return json(res, 200, { liked: true });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function toggleBookmark(req, res, id) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!rateLimit(`bookmark:${user.id}`, 60, 60000)) return error(res, 429, 'Too many actions');

    const supabase = getServiceClient();
    const { data: post } = await supabase
      .from('posts')
      .select('id')
      .eq('id', id)
      .eq('status', 'published')
      .single();
    if (!post) return error(res, 404, 'Post not found');

    const { data: existing } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('bookmarks').delete().eq('id', existing.id);
      return json(res, 200, { bookmarked: false });
    }
    await supabase.from('bookmarks').insert({ post_id: id, user_id: user.id });
    return json(res, 200, { bookmarked: true });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function listComments(req, res, postId) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const supabase = getServiceClient();
    const { data, error: qErr } = await supabase
      .from('comments')
      .select(`id, content, created_at, user:profiles!comments_user_id_fkey (id, username, display_name, avatar_url)`)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (qErr) return error(res, 500, 'Failed to load comments');
    return json(res, 200, { comments: data || [] });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function addComment(req, res, postId) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!rateLimit(`comment:${user.id}`, 30, 60000)) return error(res, 429, 'Too many comments');

    const body = await parseBody(req);
    const content = (body.content || '').trim();
    if (!content || content.length > 1000) return error(res, 400, 'Invalid comment content');

    const supabase = getServiceClient();
    const { data: post } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .eq('status', 'published')
      .single();
    if (!post) return error(res, 404, 'Post not found');

    const { data: comment, error: insErr } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content })
      .select(`id, content, created_at, user:profiles!comments_user_id_fkey (id, username, display_name, avatar_url)`)
      .single();

    if (insErr) return error(res, 500, 'Failed to add comment');

    if (post.user_id !== user.id) {
      await supabase.from('notifications').insert({
        recipient_id: post.user_id,
        actor_id: user.id,
        type: 'comment',
        post_id: postId,
        comment_id: comment.id,
      });
    }
    return json(res, 201, { comment });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function deleteComment(req, res, postId) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const commentId = url.searchParams.get('comment_id');
    if (!commentId) return error(res, 400, 'comment_id required');

    const supabase = getServiceClient();
    const { data: comment } = await supabase
      .from('comments')
      .select('id, user_id')
      .eq('id', commentId)
      .eq('post_id', postId)
      .single();

    if (!comment) return error(res, 404, 'Comment not found');
    if (comment.user_id !== user.id) return error(res, 403, 'Forbidden');

    await supabase.from('comments').delete().eq('id', commentId);
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function uploadUrl(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!rateLimit(`upload:${user.id}`, 15, 60000)) return error(res, 429, 'Too many upload requests');

    const body = await parseBody(req);
    const { filename, contentType, size } = body;
    if (!filename || !contentType) return error(res, 400, 'filename and contentType required');

    const isImage = ALLOWED_IMAGE.includes(contentType);
    const isVideo = ALLOWED_VIDEO.includes(contentType);
    if (!isImage && !isVideo) return error(res, 400, 'Unsupported media type');

    if (size != null) {
      const max = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
      if (size > max) return error(res, 400, `File too large. Max ${Math.round(max / 1024 / 1024)}MB`);
    }

    const ext = filename.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'mp4');
    const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const supabase = getServiceClient();
    const { data, error: signErr } = await supabase.storage.from('media').createSignedUploadUrl(objectPath);
    if (signErr) return error(res, 500, 'Failed to create upload URL');

    return json(res, 200, {
      path: objectPath,
      signedUrl: data.signedUrl,
      token: data.token,
      media_type: isImage ? 'image' : 'video',
    });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
