/**
 * POST /api/posts/:id/bookmark - toggle bookmark
 */

import { requireAuth } from '../../lib/session.js';
import { getServiceClient } from '../../lib/supabase.js';
import { json, error, handleOptions, rateLimit } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (!rateLimit(`bookmark:${user.id}`, 60, 60000)) {
      return error(res, 429, 'Too many actions');
    }

    const id = req.query?.id || (req.url?.match(/\/posts\/([0-9a-f-]{36})\/bookmark/i) || [])[1];
    if (!id) return error(res, 400, 'Post id required');

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
