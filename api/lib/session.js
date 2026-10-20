import crypto from 'crypto';
import { getServiceClient } from './supabase.js';

const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '168', 10); // 7 days
const COOKIE_NAME = 'mimigram_session';

/**
 * Hash token for storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new session for user
 * @returns {{ token: string, expiresAt: Date }}
 */
export async function createSession(userId) {
  const supabase = getServiceClient();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  const { error } = await supabase.from('sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('createSession error:', error);
    throw new Error('Failed to create session');
  }

  return { token, expiresAt };
}

/**
 * Validate session token and return user profile
 */
export async function validateSession(token) {
  if (!token) return null;

  const supabase = getServiceClient();
  const tokenHash = hashToken(token);

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, user_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !session) return null;

  if (new Date(session.expires_at) < new Date()) {
    // Expired - clean up
    await supabase.from('sessions').delete().eq('id', session.id);
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user_id)
    .single();

  if (profileError || !profile) return null;

  return profile;
}

/**
 * Revoke session
 */
export async function revokeSession(token) {
  if (!token) return;
  const supabase = getServiceClient();
  const tokenHash = hashToken(token);
  await supabase.from('sessions').delete().eq('token_hash', tokenHash);
}

/**
 * Parse session cookie from request headers
 */
export function getSessionTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  return cookies[COOKIE_NAME] || null;
}

/**
 * Build Set-Cookie header for session
 */
export function buildSessionCookie(token, expiresAt, isProduction = true) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Build clear cookie header
 */
export function buildClearSessionCookie(isProduction = true) {
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Middleware-style helper: get authenticated user or null
 */
export async function getAuthUser(req) {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  return validateSession(token);
}

/**
 * Require auth - returns user or sends 401
 */
export async function requireAuth(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}
