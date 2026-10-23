/**
 * GET  /api/chat?scope=global&cursor=
 * GET  /api/chat?scope=dms
 * GET  /api/chat?conversation_id=&cursor=
 * POST /api/chat  { content, conversation_id? }  // default global
 * POST /api/chat  { content, peer_id }           // open/create DM then send
 */
import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../lib/http.js';

const GLOBAL_ID = '00000000-0000-4000-8000-000000000001';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method === 'GET') return getChat(req, res);
  if (req.method === 'POST') return postChat(req, res);
  return error(res, 405, 'Method not allowed', null, req);
}

async function ensureGlobal(supabase) {
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('type', 'global')
    .maybeSingle();
  if (data) return data.id;
  const { data: created, error: err } = await supabase
    .from('conversations')
    .insert({ id: GLOBAL_ID, type: 'global' })
    .select('id')
    .single();
  if (err) {
    // race: fetch again
    const { data: again } = await supabase
      .from('conversations')
      .select('id')
      .eq('type', 'global')
      .maybeSingle();
    return again?.id || GLOBAL_ID;
  }
  return created.id;
}

async function getOrCreateDm(supabase, userId, peerId) {
  // Find existing DM with both members
  const { data: myMemberships } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations!inner(id, type)')
    .eq('user_id', userId);

  const dmIds = (myMemberships || [])
    .filter((m) => m.conversations?.type === 'dm')
    .map((m) => m.conversation_id);

  if (dmIds.length) {
    const { data: peerMemberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', peerId)
      .in('conversation_id', dmIds);
    if (peerMemberships?.length) return peerMemberships[0].conversation_id;
  }

  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .insert({ type: 'dm' })
    .select('id')
    .single();
  if (cErr) throw cErr;

  await supabase.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: userId },
    { conversation_id: conv.id, user_id: peerId },
  ]);
  return conv.id;
}

function mapMessage(m) {
  const { profiles, ...rest } = m;
  return { ...rest, user: profiles || null };
}

async function getChat(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const supabase = getServiceClient();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const scope = url.searchParams.get('scope');
    const conversationId = url.searchParams.get('conversation_id');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '40', 10), 80);

    // List DM conversations
    if (scope === 'dms') {
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id, conversations!inner(id, type, created_at)')
        .eq('user_id', user.id);

      const dms = (memberships || []).filter((m) => m.conversations?.type === 'dm');
      const ids = dms.map((m) => m.conversation_id);
      if (!ids.length) return json(res, 200, { conversations: [] }, req);

      const { data: members } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id, profiles:user_id(id, username, display_name, avatar_url)')
        .in('conversation_id', ids);

      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('id, conversation_id, content, created_at, sender_id')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(100);

      const lastByConv = {};
      for (const m of lastMsgs || []) {
        if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
      }

      const conversations = ids.map((id) => {
        const peers = (members || []).filter((m) => m.conversation_id === id && m.user_id !== user.id);
        const peer = peers[0]?.profiles || null;
        return {
          id,
          type: 'dm',
          peer,
          last_message: lastByConv[id] || null,
        };
      });

      conversations.sort((a, b) => {
        const ta = a.last_message?.created_at || '';
        const tb = b.last_message?.created_at || '';
        return tb.localeCompare(ta);
      });

      return json(res, 200, { conversations }, req);
    }

    let convId = conversationId;
    if (scope === 'global' || !convId) {
      convId = await ensureGlobal(supabase);
    }

    let query = supabase
      .from('messages')
      .select(
        `
        id, conversation_id, sender_id, content, created_at,
        profiles:sender_id (id, username, display_name, avatar_url)
      `
      )
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) query = query.lt('created_at', cursor);

    const { data, error: qErr } = await query;
    if (qErr) {
      console.error(qErr);
      return error(res, 500, 'Failed to load messages', null, req);
    }

    const hasMore = (data || []).length > limit;
    const items = (hasMore ? data.slice(0, limit) : data || []).reverse();
    const nextCursor = hasMore ? items[0]?.created_at : null;

    return json(
      res,
      200,
      {
        conversation_id: convId,
        messages: items.map(mapMessage),
        nextCursor,
      },
      req
    );
  } catch (err) {
    console.error('getChat:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}

async function postChat(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!rateLimit(`chat:${user.id}`, 30, 60000)) {
      return error(res, 429, 'Too many messages', null, req);
    }

    const body = await parseBody(req);
    const content = (body.content || '').trim();
    if (!content) return error(res, 400, 'content required', null, req);
    if (content.length > 2000) return error(res, 400, 'Message too long', null, req);

    const supabase = getServiceClient();
    let convId = body.conversation_id;

    if (body.peer_id) {
      if (body.peer_id === user.id) {
        return error(res, 400, 'Cannot DM yourself', null, req);
      }
      convId = await getOrCreateDm(supabase, user.id, body.peer_id);
    } else if (!convId || body.scope === 'global') {
      convId = await ensureGlobal(supabase);
    }

    const { data: msg, error: insErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: user.id,
        content,
      })
      .select(
        `
        id, conversation_id, sender_id, content, created_at,
        profiles:sender_id (id, username, display_name, avatar_url)
      `
      )
      .single();

    if (insErr) {
      console.error(insErr);
      return error(res, 500, 'Failed to send', null, req);
    }

    return json(res, 200, { message: mapMessage(msg), conversation_id: convId }, req);
  } catch (err) {
    console.error('postChat:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}
