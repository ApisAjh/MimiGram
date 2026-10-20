/**
 * Shared HTTP helpers for Vercel Serverless
 */

export function setCors(res, origin) {
  const allowed = process.env.ALLOWED_ORIGIN || process.env.TELEGRAM_MINI_APP_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowed === '*' ? '*' : allowed);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function handleOptions(req, res) {
  setCors(res);
  res.status(204).end();
}

export function json(res, status, body) {
  setCors(res);
  res.status(status).json(body);
}

export function error(res, status, message, details = null) {
  const body = { error: message };
  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }
  json(res, status, body);
}

/**
 * Parse JSON body safely
 */
export async function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Rate limit simple in-memory (per instance; use Redis for production scale)
 */
const rateLimitMap = new Map();

export function rateLimit(key, max = 30, windowMs = 60000) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitMap.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > max) {
    return false;
  }
  return true;
}
