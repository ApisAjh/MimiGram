import { json, handleOptions } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);

  const env = {
    has_bot_token: Boolean(process.env.BOT_TOKEN),
    has_supabase_url: Boolean(process.env.SUPABASE_URL),
    has_supabase_service: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    has_supabase_anon: Boolean(process.env.SUPABASE_ANON_KEY),
    node: process.version,
  };

  return json(
    res,
    200,
    {
      ok: true,
      service: 'mimigram',
      env,
    },
    req
  );
}
