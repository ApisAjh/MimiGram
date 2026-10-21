/**
 * Shared HTTP helpers for Vercel Serverless Functions
 */

export function setCors(res, req) {
  const requestOrigin = req?.headers?.origin || '';
  const allowed =
    process.env.ALLOWED_ORIGIN ||
    process.env.TELEGRAM_MINI_APP_URL ||
    '';

  // Same-origin Mini App does not need CORS; when Origin is present, echo safely
  let origin = '*';
  if (allowed && allowed !== '*') {
    origin = allowed;
  } else if (requestOrigin) {
    // Reflect request origin (Telegram WebView / same deployment)
    origin = requestOrigin;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

export function handleOptions(req, res) {
  setCors(res, req);
  res.statusCode = 204;
  res.end();
}

export function json(res, status, body, req = null) {
  setCors(res, req);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

export function error(res, status, message, details = null, req = null) {
  const body = { error: message };
  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }
  json(res, status, body, req);
}

/**
 * Parse JSON body for Vercel Node serverless.
 * Vercel often pre-parses req.body; never hang on already-consumed streams.
 */
export async function parseBody(req) {
  // Already parsed object
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  // Already parsed string
  if (typeof req.body === 'string') {
    if (!req.body) return {};
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Invalid JSON');
    }
  }
  // Buffer
  if (Buffer.isBuffer(req.body)) {
    const s = req.body.toString('utf8');
    if (!s) return {};
    try {
      return JSON.parse(s);
    } catch {
      throw new Error('Invalid JSON');
    }
  }

  // Read raw stream with timeout so we never hang
  return new Promise((resolve, reject) => {
    let data = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({});
      }
    }, 5000);

    const done = (fn) => (arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(arg);
    };

    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        done(reject)(new Error('Body too large'));
        try {
          req.destroy();
        } catch {
          /* ignore */
        }
      }
    });
    req.on('end', done((_) => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    }));
    req.on('error', done(reject));
  });
}

const rateLimitMap = new Map();

export function rateLimit(key, max = 30, windowMs = 60000) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitMap.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= max;
}
