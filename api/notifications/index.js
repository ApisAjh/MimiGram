/**
 * GET /api/notifications
 * POST /api/notifications/read - mark read
 */

import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  if (req.method === 'GET') return listNotifications(req, res);
  if (req.method === 'POST') return markRead(req, res);
  return error(res, 405, 'Method not allowed');
}

async function listNotifications(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 50);

    const supabase = getServiceClient();
    const { data, error: qErr } = await supabase
      .from('notifications')
      .select(`
        id, type, is_read, created_at, post_id, comment_id,
        actor:profiles!notifications_actor_id_fkey (id, username, display_name, avatar_url)
      `)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (qErr) {
      console.error(qErr);
      return error(res, 500, 'Failed to load notifications');
    }

    const unread = (data || []).filter((n) => !n.is_read).length;
    return json(res, 200, { notifications: data || [], unread_count: unread });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function markRead(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const body = await parseBody(req);
    const supabase = getServiceClient();

    if (body.all) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
    } else if (body.ids && Array.isArray(body.ids)) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .in('id', body.ids.slice(0, 50));
    } else {
      return error(res, 400, 'Provide all:true or ids:[]');
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
