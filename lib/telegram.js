/**
 * Telegram WebApp initData verification
 * Based on official Telegram documentation:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import crypto from 'crypto';

const AUTH_MAX_AGE_SECONDS = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE || '86400', 10); // 24h default

/**
 * Parse initData query string into object
 */
export function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const data = {};
  for (const [key, value] of params.entries()) {
    data[key] = value;
  }
  return data;
}

/**
 * Verify Telegram WebApp initData signature
 * @param {string} initData - Raw initData string from Telegram.WebApp.initData
 * @param {string} botToken - Bot token
 * @returns {{ valid: boolean, data?: object, error?: string }}
 */
export function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') {
    return { valid: false, error: 'Missing initData' };
  }
  if (!botToken) {
    return { valid: false, error: 'Server misconfiguration' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { valid: false, error: 'Missing hash' };
    }

    // Build data-check-string: sorted key=value pairs excluding hash
    const entries = [];
    for (const [key, value] of params.entries()) {
      if (key !== 'hash') {
        entries.push(`${key}=${value}`);
      }
    }
    entries.sort();
    const dataCheckString = entries.join('\n');

    // Secret key = HMAC-SHA256 of bot_token with key "WebAppData"
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Check auth_date freshness
    const authDate = parseInt(params.get('auth_date'), 10);
    if (!authDate || isNaN(authDate)) {
      return { valid: false, error: 'Missing auth_date' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > AUTH_MAX_AGE_SECONDS) {
      return { valid: false, error: 'initData expired' };
    }

    // Parse user
    let user = null;
    const userStr = params.get('user');
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        return { valid: false, error: 'Invalid user data' };
      }
    }

    if (!user || !user.id) {
      return { valid: false, error: 'Missing user identity' };
    }

    return {
      valid: true,
      data: {
        user,
        auth_date: authDate,
        query_id: params.get('query_id') || null,
        start_param: params.get('start_param') || null,
      },
    };
  } catch (err) {
    console.error('verifyTelegramInitData error:', err.message);
    return { valid: false, error: 'Verification failed' };
  }
}

/**
 * Extract Telegram user fields safely
 */
export function extractTelegramUser(user) {
  return {
    telegram_id: user.id,
    username: user.username || null,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    display_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `User ${user.id}`,
    avatar_url: user.photo_url || null,
    language_code: user.language_code || null,
    is_premium: !!user.is_premium,
  };
}
