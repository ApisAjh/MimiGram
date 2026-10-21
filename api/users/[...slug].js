/**
 * Catch-all users routes (1 serverless function)
 * GET/PATCH /api/users/:id
 * POST /api/users/:id/follow
 * GET /api/users/search?q=
 */

import { requireAuth, getAuthUser } from '../../lib/session.js';
import { getServiceClient } from '../../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  const slug = resolveSlug(req);
  // /api/users/search     → ['search']
  // /api/users/:id        → [id]
  // /api/users/:id/follow → [id, 'follow']

  if (slug[0] === 'search' && req.method === 'GET') {
    return searchUsers(req, res);
  }

  const id = slug[0];
  if (!id) return error(res, 400, 'User id required');

  const action = slug[1];
  if (action === 'follow' && req.method === 'POST') {
    return toggleFollow(req, res, id);
  }

  if (!action) {
    if (req.method === 'GET') return getProfile(req, res, id);
    if (req.method === 'PATCH') return updateProfile(req, res, id);
  }

  return error(res, 404, 'Not found');
}

function resolveSlug(req) {
  const slug = req.query?.slug;
  if (slug) return Array.isArray(slug) ? slug : [slug];
  const raw = (req.url || '').split('?')[0];
  const match = raw.match(/\/api\/users\/?(.*)$/i);
  if (!match || !match[1]) return [];
  return match[1].split('/').filter(Boolean);
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
    if (Object.keys(updates).length === 0) return error(res, 400, 'Nothing to update');

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

async function toggleFollow(req, res, targetId) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!rateLimit(`follow:${user.id}`, 40, 60000)) return error(res, 429, 'Too many actions');
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

    await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });

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

async function searchUsers(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 50);
    if (!q) return json(res, 200, { users: [] });

    const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const supabase = getServiceClient();
    const { data, error: qErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`display_name.ilike.${pattern},username.ilike.${pattern}`)
      .limit(20);

    if (qErr) return error(res, 500, 'Search failed');
    return json(res, 200, { users: data || [] });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
