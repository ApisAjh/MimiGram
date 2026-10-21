import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed', null, req);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const body = await parseBody(req);
    const postId = body.post_id;
    if (!postId) return error(res, 400, 'post_id required', null, req);

    const supabase = getServiceClient();
    const { data: existing } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('post_likes').delete().eq('id', existing.id);
      return json(res, 200, { liked: false }, req);
    }
    await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
    return json(res, 200, { liked: true }, req);
  } catch (err) {
    console.error('like:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}
