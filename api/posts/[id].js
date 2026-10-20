/**
 * DELETE /api/posts/:id
 * GET /api/posts/:id (optional single post)
 */

import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  const id = req.query?.id || extractId(req.url);
  if (!id) return error(res, 400, 'Post id required');

  if (req.method === 'DELETE') {
    return deletePost(req, res, id);
  }
  if (req.method === 'GET') {
    return getPost(req, res, id);
  }
  return error(res, 405, 'Method not allowed');
}

function extractId(url) {
  // /api/posts/uuid
  const match = url?.match(/\/posts\/([0-9a-f-]{36})/i);
  return match ? match[1] : null;
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

    // Soft delete or hard
    const { error: delErr } = await supabase
      .from('posts')
      .update({ status: 'deleted' })
      .eq('id', id);

    if (delErr) {
      console.error(delErr);
      return error(res, 500, 'Failed to delete');
    }

    // Optionally remove storage objects (best effort)
    try {
      const paths = [post.media_path];
      if (post.thumbnail_path) paths.push(post.thumbnail_path);
      await supabase.storage.from('media').remove(paths);
    } catch (e) {
      console.warn('Storage cleanup failed:', e.message);
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
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
        id, caption, media_path, media_type, post_type, thumbnail_path,
        duration_seconds, created_at,
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

    const base = process.env.SUPABASE_URL;
    return json(res, 200, {
      post: {
        ...post,
        likes_count: likes.count || 0,
        comments_count: comments.count || 0,
        liked_by_me: !!userLike.data,
        bookmarked_by_me: !!userBookmark.data,
        media_url: `${base}/storage/v1/object/public/media/${post.media_path}`,
        thumbnail_url: post.thumbnail_path
          ? `${base}/storage/v1/object/public/media/${post.thumbnail_path}`
          : null,
      },
    });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
