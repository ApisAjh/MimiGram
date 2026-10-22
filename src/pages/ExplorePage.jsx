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
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'reels') {
        // Semua video (post video + reel)
        const r = await api.getReels({ limit: 40 });
        setPosts(r.reels || []);
      } else {
        // Semua postingan published (foto + video biasa)
        const data = await api.getPosts({ limit: 40 });
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal memuat');
      setPosts([]);
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
          style={{ flex: 1 }}
        />
      </header>
      <main className="app-content">
        {query.trim() ? (
          <div className="search-results">
            {searching && <div className="spinner" />}
            {!searching && users.length === 0 && (
              <div className="empty-state">
                <h3>Tidak ditemukan</h3>
                <p>Coba kata kunci lain.</p>
              </div>
            )}
            {users.map((u) => (
              <Link key={u.id} to={`/profile/${u.id}`} className="user-row">
                <img
                  className="avatar"
                  src={
                    u.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || 'U')}&background=FF4D6D&color=fff`
                  }
                  alt=""
                />
                <div>
                  <div className="user-row-name">{u.display_name}</div>
                  {u.username && <div className="user-row-user">@{u.username}</div>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <div className="profile-tabs">
              <button type="button" className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>
                Postingan
              </button>
              <button type="button" className={tab === 'reels' ? 'active' : ''} onClick={() => setTab('reels')}>
                Reels
              </button>
            </div>
            {loading ? (
              <div className="spinner" />
            ) : error ? (
              <div className="empty-state">
                <h3>Gagal memuat</h3>
                <p>{error}</p>
                <button type="button" className="btn btn-primary" onClick={load} style={{ marginTop: 12 }}>
                  Coba lagi
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="empty-state">
                <h3>Belum ada konten</h3>
                <p>{tab === 'reels' ? 'Belum ada video/reel.' : 'Belum ada postingan.'}</p>
              </div>
            ) : (
              <div className="explore-grid">
                {posts.map((p) => (
                  <Link
                    key={p.id}
                    to={p.user?.id ? `/profile/${p.user.id}` : '#'}
                    className="grid-cell"
                  >
                    {p.media_type === 'video' ? (
                      <>
                        <video src={p.media_url} muted playsInline preload="metadata" />
                        <span className="grid-badge">▶</span>
                      </>
                    ) : (
                      <img src={p.media_url} alt="" loading="lazy" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
