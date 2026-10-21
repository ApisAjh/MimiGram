import { requireAuth, getAuthUser } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action'); // follow | search
    const supabase = getServiceClient();

    if (action === 'search' && req.method === 'GET') {
      const user = await requireAuth(req, res);
      if (!user) return;
      const q = (url.searchParams.get('q') || '').trim();
      if (q.length < 1) return json(res, 200, { users: [] }, req);
      const { data, error: qErr } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      if (qErr) return error(res, 500, 'Search failed', null, req);
      return json(res, 200, { users: data || [] }, req);
    }

    if (action === 'follow' && req.method === 'POST') {
      const user = await requireAuth(req, res);
      if (!user) return;
      if (!id) return error(res, 400, 'id required', null, req);
      if (id === user.id) return error(res, 400, 'Cannot follow yourself', null, req);
      const { data: existing } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', id)
        .maybeSingle();
      if (existing) {
        await supabase.from('follows').delete().eq('id', existing.id);
        return json(res, 200, { following: false }, req);
      }
      await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
      return json(res, 200, { following: true }, req);
    }

    if (req.method === 'GET') {
      const user = await getAuthUser(req);
      if (!id) return error(res, 400, 'id required', null, req);
      const { data: profile, error: pErr } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (pErr || !profile) return error(res, 404, 'User not found', null, req);
      const [postsRes, followersRes, followingRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', id).eq('status', 'published'),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
      ]);
      let isFollowing = false;
      if (user) {
        const { data: f } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', id)
          .maybeSingle();
        isFollowing = !!f;
      }
      return json(res, 200, {
        user: {
          ...profile,
          posts_count: postsRes.count || 0,
          followers_count: followersRes.count || 0,
          following_count: followingRes.count || 0,
          is_following: isFollowing,
        },
      }, req);
    }

    if (req.method === 'PATCH') {
      const user = await requireAuth(req, res);
      if (!user) return;
      if (!id || id !== user.id) return error(res, 403, 'Forbidden', null, req);
      const body = await parseBody(req);
      const updates = { updated_at: new Date().toISOString() };
      if (typeof body.display_name === 'string') updates.display_name = body.display_name.slice(0, 50);
      if (typeof body.bio === 'string') updates.bio = body.bio.slice(0, 150);
      if (typeof body.avatar_url === 'string') updates.avatar_url = body.avatar_url;
      const { data, error: uErr } = await supabase.from('profiles').update(updates).eq('id', id).select().single();
      if (uErr) return error(res, 500, 'Update failed', null, req);
      return json(res, 200, { user: data }, req);
    }

    return error(res, 405, 'Method not allowed', null, req);
  } catch (err) {
    console.error('user:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}
