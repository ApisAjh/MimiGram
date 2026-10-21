import { getAuthUser } from '../../lib/session.js';
import { getServiceClient } from '../../lib/supabase.js';
import { json, error, handleOptions } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed');

  try {
    const user = await getAuthUser(req);
    if (!user) return error(res, 401, 'Unauthorized');

    const supabase = getServiceClient();
    const [postsRes, followersRes, followingRes] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'published'),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
    ]);

    return json(res, 200, {
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        bio: user.bio,
        created_at: user.created_at,
        posts_count: postsRes.count || 0,
        followers_count: followersRes.count || 0,
        following_count: followingRes.count || 0,
      },
    });
  } catch (err) {
    console.error('auth/me:', err);
    return error(res, 500, 'Internal server error');
  }
}
