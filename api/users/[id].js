/**
 * GET /api/users/:id - public profile
 * PATCH /api/users/:id - update own profile
 */

import { requireAuth, getAuthUser } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  const id = req.query?.id || (req.url?.match(/\/users\/([0-9a-f-]{36})/i) || [])[1];
  if (!id) return error(res, 400, 'User id required');

  if (req.method === 'GET') return getProfile(req, res, id);
  if (req.method === 'PATCH') return updateProfile(req, res, id);
  return error(res, 405, 'Method not allowed');
}

async function getProfile(req, res, id) {
  try {
    const me = await getAuthUser(req);
    const supabase = getServiceClient();

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, created_at')
      .eq('id', id)
      .single();

    if (pErr || !profile) return error(res, 404, 'User not found');

    const [postsRes, followersRes, followingRes, followCheck] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', id).eq('status', 'published'),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
      me
        ? supabase.from('follows').select('id').eq('follower_id', me.id).eq('following_id', id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return json(res, 200, {
      user: {
        ...profile,
        posts_count: postsRes.count || 0,
        followers_count: followersRes.count || 0,
        following_count: followingRes.count || 0,
        is_following: !!followCheck.data,
        is_me: me?.id === id,
      },
    });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}

async function updateProfile(req, res, id) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.id !== id) return error(res, 403, 'Forbidden');

    const body = await parseBody(req);
    const updates = {};
    if (typeof body.display_name === 'string') {
      const name = body.display_name.trim().slice(0, 50);
      if (name) updates.display_name = name;
    }
    if (typeof body.bio === 'string') {
      updates.bio = body.bio.trim().slice(0, 150);
    }

    if (Object.keys(updates).length === 0) {
      return error(res, 400, 'Nothing to update');
    }

    const supabase = getServiceClient();
    const { data, error: uErr } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select('id, username, display_name, avatar_url, bio, created_at')
      .single();

    if (uErr) return error(res, 500, 'Failed to update');
    return json(res, 200, { user: data });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
