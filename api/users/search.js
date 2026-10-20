/**
 * GET /api/users/search?q=
 */

import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 50);
    if (!q || q.length < 1) {
      return json(res, 200, { users: [] });
    }

    // Escape for ilike - use parameterized via supabase
    const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

    const supabase = getServiceClient();
    const { data, error: qErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`display_name.ilike.${pattern},username.ilike.${pattern}`)
      .limit(20);

    if (qErr) {
      console.error(qErr);
      return error(res, 500, 'Search failed');
    }

    return json(res, 200, { users: data || [] });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
