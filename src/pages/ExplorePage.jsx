import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import PostViewer from '../components/PostViewer';

export default function ExplorePage() {
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPosts([]);
    try {
      if (tab === 'reels') {
        const r = await api.getReels({ limit: 40 });
        setPosts(Array.isArray(r.reels) ? r.reels : []);
      } else {
        const data = await api.getPosts({ limit: 40 });
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      }
    } catch (err) {
      console.error('Explore load:', err);
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
    <div className="explore-page">
      <header className="app-header">
        <input
          className="input"
          placeholder="Cari pengguna…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
          autoComplete="off"
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
                  {u.username ? <div className="user-row-user">@{u.username}</div> : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <div className="explore-tabs">
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
                <h3>Gagal memuat Explore</h3>
                <p style={{ wordBreak: 'break-word' }}>{error}</p>
                <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
                  Coba lagi
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="empty-state explore-empty">
                <h3>Explore masih kosong</h3>
                <p>
                  {tab === 'reels'
                    ? 'Belum ada video di komunitas.'
                    : 'Belum ada postingan publik. Buat dari tab Create.'}
                </p>
                <Link to="/create" className="btn btn-primary" style={{ marginTop: 12 }}>
                  Buat postingan
                </Link>
              </div>
            ) : (
              <div className="explore-grid">
                {posts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="grid-cell"
                    onClick={() => setSelected(p)}
                    style={{ border: 0, padding: 0, cursor: 'pointer' }}
                  >
                    {p.media_type === 'video' ? (
                      <>
                        <video src={p.media_url} muted playsInline preload="metadata" />
                        <span className="grid-badge">▶</span>
                      </>
                    ) : (
                      <img src={p.media_url} alt="" loading="lazy" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {selected && <PostViewer post={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
