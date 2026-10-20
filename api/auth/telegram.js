/**
 * POST /api/auth/telegram
 * Body: { initData: string }
 * Verifies Telegram initData, upserts profile, creates session.
 */

import { verifyTelegramInitData, extractTelegramUser } from '../lib/telegram.js';
import { getServiceClient } from '../lib/supabase.js';
import { createSession, buildSessionCookie } from '../lib/session.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res);
  }

  if (req.method !== 'POST') {
    return error(res, 405, 'Method not allowed');
  }

  try {
    const body = await parseBody(req);
    const { initData } = body;

    if (!initData) {
      return error(res, 400, 'initData is required');
    }

    // Rate limit by IP-ish (Vercel provides x-forwarded-for)
    const clientKey = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    if (!rateLimit(`auth:${clientKey}`, 20, 60000)) {
      return error(res, 429, 'Too many requests');
    }

    const botToken = process.env.BOT_TOKEN;
    const verification = verifyTelegramInitData(initData, botToken);

    if (!verification.valid) {
      return error(res, 401, verification.error || 'Invalid initData');
    }

    const tgUser = extractTelegramUser(verification.data.user);
    const supabase = getServiceClient();

    // Upsert profile by telegram_id
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', tgUser.telegram_id)
      .maybeSingle();

    let profile;

    if (existing) {
      // Update avatar/username if changed, keep custom display_name/bio
      const updates = {
        username: tgUser.username,
        updated_at: new Date().toISOString(),
      };
      // Only update avatar if Telegram provides one and user hasn't customized (simple: always sync avatar)
      if (tgUser.avatar_url) {
        updates.avatar_url = tgUser.avatar_url;
      }
      // If display_name was default, refresh from Telegram
      if (!existing.display_name || existing.display_name === `User ${tgUser.telegram_id}`) {
        updates.display_name = tgUser.display_name;
      }

      const { data: updated, error: updateErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();

      if (updateErr) {
        console.error('Profile update error:', updateErr);
        return error(res, 500, 'Failed to update profile');
      }
      profile = updated;
    } else {
      const { data: created, error: createErr } = await supabase
        .from('profiles')
        .insert({
          telegram_id: tgUser.telegram_id,
          username: tgUser.username,
          display_name: tgUser.display_name,
          avatar_url: tgUser.avatar_url,
          bio: '',
        })
        .select()
        .single();

      if (createErr) {
        console.error('Profile create error:', createErr);
        return error(res, 500, 'Failed to create profile');
      }
      profile = created;
    }

    // Create session
    const { token, expiresAt } = await createSession(profile.id);
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    res.setHeader('Set-Cookie', buildSessionCookie(token, expiresAt, isProd));

    return json(res, 200, {
      user: {
        id: profile.id,
        telegram_id: profile.telegram_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        created_at: profile.created_at,
      },
    });
  } catch (err) {
    console.error('auth/telegram error:', err);
    return error(res, 500, 'Internal server error');
  }
}
