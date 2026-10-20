/**
 * GET /api/posts/:id/comments
 * POST /api/posts/:id/comments
 * DELETE with comment_id query
 */

import { requireAuth } from '../../lib/session.js';
import { getServiceClient } from '../../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  const id = req.query?.id || extractId(req.url);
  if (!id) return error(res, 400, 'Post id required');

  if (req.method === 'GET') return listComments(req, res, id);
  if (req.method === 'POST') return addComment(req, res, id);
  if (req.method === 'DELETE') return deleteComment(req, res, id);
  return error(res, 405, 'Method not allowed');
}

function extractId(url) {
  const match = url?.match(/\/posts\/([0-9a-f-]{36})\/comments/i);
  return match ? match[1] : null;
}

async function listComments(req, res, postId) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 50);

    const supabase = getServiceClient();
    const { data, error: qErr } = await supabase
      .from('comments')
      .select(`
        id, content, created_at,
        user:profiles!comments_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(limit);

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

    if (!rateLimit(`comment:${user.id}`, 30, 60000)) {
      return error(res, 429, 'Too many comments');
    }

    const body = await parseBody(req);
    const content = (body.content || '').trim();
    if (!content || content.length > 1000) {
      return error(res, 400, 'Invalid comment content');
    }

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
      .select(`
        id, content, created_at,
        user:profiles!comments_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .single();

    if (insErr) {
      console.error(insErr);
      return error(res, 500, 'Failed to add comment');
    }

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
