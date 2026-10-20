import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

export default function ExplorePage() {
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPosts({
        type: tab === 'reels' ? 'reel' : 'post',
        limit: 30,
      });
      setPosts(data.posts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchUsers(query.trim());
        setUsers(data.users || []);
      } catch {
        setUsers([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <>
      <header className="app-header">
        <input
          className="input"
          placeholder="Cari pengguna…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, marginRight: 8 }}
        />
      </header>
      <main className="app-content">
        {query.trim() ? (
          <div style={{ padding: 8 }}>
            {searching && <div className="spinner" />}
            {!searching && users.length === 0 && (
              <div className="empty-state">
                <h3>Tidak ditemukan</h3>
                <p>Coba kata kunci lain.</p>
              </div>
            )}
            {users.map((u) => (
              <Link
                key={u.id}
                to={`/profile/${u.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <img
                  className="avatar"
                  src={
                    u.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || 'U')}&background=FF4D6D&color=fff`
                  }
                  alt=""
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{u.display_name}</div>
                  {u.username && (
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      @{u.username}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
              <button
                style={{
                  flex: 1,
                  padding: 12,
                  fontWeight: 600,
                  borderBottom: tab === 'posts' ? '2px solid var(--color-primary)' : 'none',
                  color: tab === 'posts' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                }}
                onClick={() => setTab('posts')}
              >
                Postingan
              </button>
              <button
                style={{
                  flex: 1,
                  padding: 12,
                  fontWeight: 600,
                  borderBottom: tab === 'reels' ? '2px solid var(--color-primary)' : 'none',
                  color: tab === 'reels' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                }}
                onClick={() => setTab('reels')}
              >
                Reels
              </button>
            </div>
            {loading ? (
              <div className="spinner" />
            ) : posts.length === 0 ? (
              <div className="empty-state">
                <h3>Belum ada konten</h3>
              </div>
            ) : (
              <div className="explore-grid">
                {posts.map((p) => (
                  <div key={p.id} style={{ position: 'relative', aspectRatio: 1 }}>
                    {p.media_type === 'video' ? (
                      <video src={p.media_url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <img src={p.media_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
