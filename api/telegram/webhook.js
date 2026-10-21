/**
 * POST /api/telegram/webhook
 * Telegram Bot webhook handler
 */

import { json, error } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return error(res, 405, 'Method not allowed');
  }

  // Validate secret token
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (secret && headerSecret !== secret) {
    return error(res, 403, 'Invalid webhook secret');
  }

  try {
    let update = req.body;
    if (!update || typeof update !== 'object') {
      // Parse if needed
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      update = JSON.parse(raw || '{}');
    }

    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      // Ignore non-text or non-message updates
      return json(res, 200, { ok: true });
    }

    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    const botToken = process.env.BOT_TOKEN;
    const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : '';

    if (!botToken) {
      console.error('BOT_TOKEN missing');
      return json(res, 200, { ok: true });
    }

    let replyText = '';
    let replyMarkup = null;

    if (text.startsWith('/start')) {
      replyText =
        '👋 Selamat datang di *MimiGram*!\n\n' +
        'Media sosial di dalam Telegram. Bagikan foto, video, dan Reels dengan mudah.\n\n' +
        'Tekan tombol di bawah untuk membuka aplikasi.';
      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Buka MimiGram',
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      };
    } else if (text.startsWith('/help')) {
      replyText =
        '📖 *Cara menggunakan MimiGram*\n\n' +
        '1. Tekan *Buka MimiGram* untuk masuk otomatis lewat Telegram.\n' +
        '2. Lihat Feed di Home, jelajahi Explore, tonton Reels.\n' +
        '3. Tekan Create untuk upload foto, video, atau Reel.\n' +
        '4. Follow teman, like, komentar, dan simpan konten.\n\n' +
        'Semua data tersimpan aman. Tidak perlu email atau password.';
      replyMarkup = {
        inline_keyboard: [
          [{ text: '🚀 Buka MimiGram', web_app: { url: miniAppUrl } }],
        ],
      };
    } else if (text.startsWith('/profile')) {
      replyText = '👤 Buka profil Anda di MimiGram:';
      replyMarkup = {
        inline_keyboard: [
          [{ text: '👤 Lihat Profil', web_app: { url: `${miniAppUrl}/profile` } }],
        ],
      };
    } else {
      replyText =
        'Gunakan /start untuk membuka MimiGram, /help untuk bantuan, atau /profile untuk profil.';
    }

    await sendTelegramMessage(botToken, chatId, replyText, replyMarkup);
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('webhook error:', err);
    // Always 200 to Telegram to avoid retries storm
    return json(res, 200, { ok: true });
  }
}

async function sendTelegramMessage(token, chatId, text, replyMarkup) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Telegram sendMessage failed:', errText);
  }
}
