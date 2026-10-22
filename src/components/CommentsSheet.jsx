import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

const avatarFor = (u) =>
  u?.avatar_url ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.display_name || u?.username || 'U')}&background=FF4D6D&color=fff`;

function timeShort(iso) {
  if (!iso) return '';
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: false, locale: localeId });
  } catch {
    return '';
  }
}

/**
 * Bottom sheet komentar — layout Instagram normal.
 */
export default function CommentsSheet({ postId, onClose, onCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getComments(postId);
        if (alive) setComments(data.comments || []);
      } catch {
        if (alive) setError('Gagal memuat komentar');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [postId]);

  useEffect(() => {
    // Kunci scroll + pause semua video di belakang sheet
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const videos = document.querySelectorAll('video');
    const states = [];
    videos.forEach((v) => {
      states.push({ el: v, paused: v.paused });
      try {
        v.pause();
      } catch {
        /* ignore */
      }
    });
    const t = setTimeout(() => inputRef.current?.focus?.(), 300);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
      states.forEach(({ el, paused }) => {
        if (!paused) {
          try {
            el.play?.();
          } catch {
            /* ignore */
          }
        }
      });
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await api.addComment(postId, content);
      setComments((c) => [...c, data.comment]);
      setText('');
      onCountChange?.(1);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      });
    } catch (err) {
      setError(err.message || 'Gagal menambah komentar');
    } finally {
      setSending(false);
    }
  };

  const remove = async (c) => {
    if (!confirm('Hapus komentar ini?')) return;
    const snapshot = comments;
    setComments((list) => list.filter((x) => x.id !== c.id));
    try {
      await api.deleteComment(postId, c.id);
      onCountChange?.(-1);
    } catch {
      setComments(snapshot);
    }
  };

  const mine = (c) => user && (c.user?.id === user.id || c.user_id === user.id);

  return createPortal(
    <div className="cs-backdrop" onClick={onClose} role="presentation">
      <div className="cs-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Komentar">
        <div className="cs-handle-wrap">
          <div className="cs-handle" />
        </div>

        <div className="cs-header">
          <span className="cs-title">Komentar</span>
          <button type="button" className="cs-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="cs-list" ref={listRef}>
          {loading && (
            <div className="cs-loading">
              <div className="spinner" />
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="cs-empty">
              <strong>Belum ada komentar</strong>
              <span>Jadilah yang pertama.</span>
            </div>
          )}

          {comments.map((c) => (
            <div className="cs-item" key={c.id}>
              <img className="cs-avatar" src={avatarFor(c.user)} alt="" />
              <div className="cs-body">
                <div className="cs-top">
                  <span className="cs-name">{c.user?.display_name || c.user?.username || 'Pengguna'}</span>
                  <span className="cs-time">{timeShort(c.created_at)}</span>
                  {mine(c) && (
                    <button type="button" className="cs-del" onClick={() => remove(c)}>
                      Hapus
                    </button>
                  )}
                </div>
                <p className="cs-text">{c.content}</p>
              </div>
            </div>
          ))}
        </div>

        {error && <div className="cs-error">{error}</div>}

        <form className="cs-form" onSubmit={submit}>
          <img className="cs-form-avatar" src={avatarFor(user)} alt="" />
          <input
            ref={inputRef}
            className="cs-input"
            placeholder="Tambahkan komentar…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            enterKeyHint="send"
          />
          <button type="submit" className="cs-send" disabled={!text.trim() || sending}>
            Kirim
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
