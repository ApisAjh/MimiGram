/**
 * POST /api/auth/logout
 */

import { getSessionTokenFromRequest, revokeSession, buildClearSessionCookie } from '../lib/session.js';
import { json, handleOptions } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res);
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const token = getSessionTokenFromRequest(req);
    if (token) {
      await revokeSession(token);
    }

    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    res.setHeader('Set-Cookie', buildClearSessionCookie(isProd));

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('logout error:', err);
    return json(res, 500, { error: 'Internal server error' });
  }
}
