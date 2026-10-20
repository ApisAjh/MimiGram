/**
 * POST /api/users/:id/follow - toggle follow
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

    if (!rateLimit(`follow:${user.id}`, 40, 60000)) {
      return error(res, 429, 'Too many actions');
    }

    const targetId = req.query?.id || (req.url?.match(/\/users\/([0-9a-f-]{36})\/follow/i) || [])[1];
    if (!targetId) return error(res, 400, 'User id required');
    if (targetId === user.id) return error(res, 400, 'Cannot follow yourself');

    const supabase = getServiceClient();
    const { data: target } = await supabase.from('profiles').select('id').eq('id', targetId).single();
    if (!target) return error(res, 404, 'User not found');

    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetId)
      .maybeSingle();

    if (existing) {
      await supabase.from('follows').delete().eq('id', existing.id);
      return json(res, 200, { following: false });
    }

    await supabase.from('follows').insert({
      follower_id: user.id,
      following_id: targetId,
    });

    // Notification
    const { data: recent } = await supabase
      .from('notifications')
      .select('id')
      .eq('recipient_id', targetId)
      .eq('actor_id', user.id)
      .eq('type', 'follow')
      .maybeSingle();

    if (!recent) {
      await supabase.from('notifications').insert({
        recipient_id: targetId,
        actor_id: user.id,
        type: 'follow',
      });
    }

    return json(res, 200, { following: true });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
