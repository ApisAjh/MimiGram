/**
 * POST /api/posts/:id/like - toggle like
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

    if (!rateLimit(`like:${user.id}`, 60, 60000)) {
      return error(res, 429, 'Too many actions');
    }

    const id = req.query?.id || extractId(req.url);
    if (!id) return error(res, 400, 'Post id required');

    const supabase = getServiceClient();

    // Check post exists and get owner
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

    // Notification (if not self)
    if (post.user_id !== user.id) {
      // Avoid duplicate notifications for same like (simple: check recent)
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

function extractId(url) {
  const match = url?.match(/\/posts\/([0-9a-f-]{36})\/like/i);
  return match ? match[1] : null;
}
