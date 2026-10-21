import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const postId = url.searchParams.get('post_id');
    const commentId = url.searchParams.get('comment_id');
    const supabase = getServiceClient();

    if (req.method === 'GET') {
      if (!postId) return error(res, 400, 'post_id required', null, req);
      const { data, error: qErr } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id, profiles:user_id (id, username, display_name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (qErr) {
        console.error(qErr);
        return error(res, 500, 'Failed to load comments', null, req);
      }
      const comments = (data || []).map((c) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user: c.profiles,
      }));
      return json(res, 200, { comments }, req);
    }

    if (req.method === 'POST') {
      if (!rateLimit(`comment:${user.id}`, 30, 60000)) return error(res, 429, 'Too many comments', null, req);
      const body = await parseBody(req);
      const pid = body.post_id || postId;
      const content = (body.content || '').trim();
      if (!pid) return error(res, 400, 'post_id required', null, req);
      if (!content || content.length > 500) return error(res, 400, 'Komentar 1–500 karakter', null, req);

      const { data, error: insErr } = await supabase
        .from('comments')
        .insert({ post_id: pid, user_id: user.id, content })
        .select('id, content, created_at, user_id')
        .single();
      if (insErr) {
        console.error(insErr);
        return error(res, 500, 'Failed to add comment', null, req);
      }
      return json(res, 201, {
        comment: {
          ...data,
          user: {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
          },
        },
      }, req);
    }

    if (req.method === 'DELETE') {
      if (!commentId) return error(res, 400, 'comment_id required', null, req);
      const { data: existing } = await supabase.from('comments').select('id, user_id').eq('id', commentId).maybeSingle();
      if (!existing) return error(res, 404, 'Comment not found', null, req);
      if (existing.user_id !== user.id) return error(res, 403, 'Forbidden', null, req);
      await supabase.from('comments').delete().eq('id', commentId);
      return json(res, 200, { ok: true }, req);
    }

    return error(res, 405, 'Method not allowed', null, req);
  } catch (err) {
    console.error('comments:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}
