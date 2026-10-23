import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

const avatarFor = (u) =>
  u?.avatar_url ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.display_name || u?.username || 'U')}&background=FF4D6D&color=fff`;

function timeLabel(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'dm' ? 'dm' : 'global';
  const peerId = params.get('peer');

  const [messages, setMessages] = useState([]);
  const [dms, setDms] = useState([]);
  const [convId, setConvId] = useState(null);
  const [peer, setPeer] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const pollRef = useRef(null);

  const scrollBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const loadGlobal = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.getChat({ scope: 'global' });
      setMessages(data.messages || []);
      setConvId(data.conversation_id);
      setPeer(null);
      scrollBottom();
    } catch (err) {
      setError(err.message || 'Gagal memuat chat');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadDms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getChat({ scope: 'dms' });
      setDms(data.conversations || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat DM');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDmThread = useCallback(async (conversationId, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.getChat({ conversation_id: conversationId });
      setMessages(data.messages || []);
      setConvId(data.conversation_id);
      scrollBottom();
    } catch (err) {
      setError(err.message || 'Gagal memuat pesan');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (tab === 'global') {
      loadGlobal();
      pollRef.current = setInterval(() => loadGlobal(true), 8000);
    } else if (peerId && convId) {
      loadDmThread(convId);
      pollRef.current = setInterval(() => loadDmThread(convId, true), 8000);
    } else if (peerId) {
      // open DM by sending empty path - just set peer from list or wait first message
      setMessages([]);
      setConvId(null);
      setLoading(false);
      // try find existing
      (async () => {
        setLoading(true);
        try {
          const data = await api.getChat({ scope: 'dms' });
          const found = (data.conversations || []).find((c) => c.peer?.id === peerId);
          if (found) {
            setPeer(found.peer);
            setConvId(found.id);
            await loadDmThread(found.id);
            pollRef.current = setInterval(() => loadDmThread(found.id, true), 8000);
          } else {
            setPeer({ id: peerId });
            setLoading(false);
          }
        } catch (e) {
          setError(e.message);
          setLoading(false);
        }
      })();
    } else {
      loadDms();
    }
    return () => clearInterval(pollRef.current);
  }, [tab, peerId]); // eslint-disable-line

  const send = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      let res;
      if (tab === 'global') {
        res = await api.sendChat({ content, scope: 'global', conversation_id: convId });
      } else if (peerId) {
        res = await api.sendChat({
          content,
          peer_id: peerId,
          conversation_id: convId || undefined,
        });
        if (res.conversation_id) setConvId(res.conversation_id);
      } else {
        return;
      }
      setText('');
      if (res.message) {
        setMessages((m) => [...m, res.message]);
        scrollBottom();
      }
    } catch (err) {
      alert(err.message || 'Gagal mengirim');
    } finally {
      setSending(false);
    }
  };

  const inThread = tab === 'global' || (tab === 'dm' && peerId);

  return (
    <div className="chat-page">
      <header className="app-header chat-header">
        {tab === 'dm' && peerId ? (
          <button
            type="button"
            className="text-btn"
            onClick={() => setParams({ tab: 'dm' })}
            style={{ fontWeight: 600 }}
          >
            ← Kembali
          </button>
        ) : (
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Chat</h1>
        )}
        {tab === 'dm' && peerId && (
          <Link to={`/profile/${peerId}`} style={{ fontWeight: 600, fontSize: 14 }}>
            {peer?.display_name || peer?.username || 'Profil'}
          </Link>
        )}
      </header>

      {!peerId && (
        <div className="chat-tabs">
          <button
            type="button"
            className={tab === 'global' ? 'active' : ''}
            onClick={() => setParams({ tab: 'global' })}
          >
            Global
          </button>
          <button
            type="button"
            className={tab === 'dm' ? 'active' : ''}
            onClick={() => setParams({ tab: 'dm' })}
          >
            Pesan
          </button>
        </div>
      )}

      {tab === 'global' && (
        <div className="chat-global-banner">Grup publik · semua pengguna MimiGram</div>
      )}

      <div className="chat-body" ref={listRef}>
        {loading && <div className="spinner" />}
        {error && !loading && (
          <div className="empty-state">
            <p>{error}</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>
              Pastikan migration chat sudah dijalankan di Supabase.
            </p>
          </div>
        )}

        {tab === 'dm' && !peerId && !loading && (
          <div className="chat-dm-list">
            {dms.length === 0 && (
              <div className="empty-state">
                <h3>Belum ada pesan</h3>
                <p>Buka profil pengguna lain, lalu ketuk Pesan.</p>
              </div>
            )}
            {dms.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chat-dm-row"
                onClick={() => {
                  setPeer(c.peer);
                  setConvId(c.id);
                  setParams({ tab: 'dm', peer: c.peer?.id });
                }}
              >
                <img className="avatar" src={avatarFor(c.peer)} alt="" />
                <div className="chat-dm-meta">
                  <div className="chat-dm-name">{c.peer?.display_name || c.peer?.username || 'Pengguna'}</div>
                  <div className="chat-dm-preview">{c.last_message?.content || 'Mulai chat'}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {inThread &&
          !loading &&
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`chat-bubble-row ${mine ? 'mine' : ''}`}>
                {!mine && <img className="avatar chat-av" src={avatarFor(m.user)} alt="" />}
                <div className={`chat-bubble ${mine ? 'mine' : ''}`}>
                  {!mine && tab === 'global' && (
                    <div className="chat-bubble-name">{m.user?.display_name || 'Pengguna'}</div>
                  )}
                  <div className="chat-bubble-text">{m.content}</div>
                  <div className="chat-bubble-time">{timeLabel(m.created_at)}</div>
                </div>
              </div>
            );
          })}
      </div>

      {inThread && (
        <form className="chat-form" onSubmit={send}>
          <input
            className="chat-input"
            placeholder={tab === 'global' ? 'Tulis di global…' : 'Pesan…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" className="chat-send" disabled={!text.trim() || sending}>
            Kirim
          </button>
        </form>
      )}
    </div>
  );
}
