import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { api } from '../services/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getNotifications();
        setNotifications(data.notifications || []);
        if (data.unread_count > 0) {
          await api.markNotificationsRead({ all: true });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const label = (n) => {
    const name = n.actor?.display_name || 'Seseorang';
    if (n.type === 'follow') return `${name} mulai mengikuti Anda`;
    if (n.type === 'like') return `${name} menyukai postingan Anda`;
    if (n.type === 'comment') return `${name} mengomentari postingan Anda`;
    return 'Notifikasi baru';
  };

  return (
    <>
      <header className="app-header">
        <Link to="/" style={{ fontSize: 14 }}>
          ← Kembali
        </Link>
        <h1 style={{ fontSize: 18 }}>Notifikasi</h1>
        <span />
      </header>
      <main className="app-content">
        {loading && <div className="spinner" />}
        {!loading && notifications.length === 0 && (
          <div className="empty-state">
            <h3>Belum ada notifikasi</h3>
            <p>Interaksi akan muncul di sini.</p>
          </div>
        )}
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: n.is_read ? 'transparent' : 'rgba(255,77,109,0.05)',
            }}
          >
            <Link to={`/profile/${n.actor?.id}`}>
              <img
                className="avatar"
                src={
                  n.actor?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(n.actor?.display_name || 'U')}&background=FF4D6D&color=fff`
                }
                alt=""
              />
            </Link>
            <div style={{ flex: 1, fontSize: 14 }}>
              <div>{label(n)}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {n.created_at
                  ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: localeId })
                  : ''}
              </div>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
