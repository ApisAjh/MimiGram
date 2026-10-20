import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [u, postsData] = await Promise.all([
          api.getUser(id),
          api.getPosts({ user_id: id, limit: 30 }),
        ]);
        setProfile(u.user);
        setPosts(postsData.posts || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleFollow = async () => {
    try {
      const res = await api.toggleFollow(id);
      setProfile((p) => ({
        ...p,
        is_following: res.following,
        followers_count: (p.followers_count || 0) + (res.following ? 1 : -1),
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <main className="app-content">
        <div className="spinner" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="app-content">
        <div className="empty-state">
          <h3>Pengguna tidak ditemukan</h3>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
            Kembali
          </Link>
        </div>
      </main>
    );
  }

  const filtered = posts.filter((p) =>
    tab === 'posts' ? p.post_type === 'post' : p.post_type === 'reel'
  );

  return (
    <>
      <header className="app-header">
        <Link to={-1} style={{ fontSize: 14 }}>
          ← Kembali
        </Link>
        <h1 style={{ fontSize: 18 }}>{profile.username || profile.display_name}</h1>
        <span />
      </header>
      <main className="app-content">
        <div className="profile-header">
          <img
            className="avatar avatar-lg"
            src={
              profile.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || 'U')}&background=FF4D6D&color=fff&size=128`
            }
            alt=""
          />
          <h2 style={{ marginTop: 12, fontSize: 18 }}>{profile.display_name}</h2>
          {profile.bio && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
              {profile.bio}
            </p>
          )}
          {!profile.is_me && (
            <button
              className={`btn btn-sm ${profile.is_following ? 'btn-outline' : 'btn-primary'}`}
              style={{ marginTop: 12 }}
              onClick={toggleFollow}
            >
              {profile.is_following ? 'Following' : 'Follow'}
            </button>
          )}
          {profile.is_me && (
            <Link to="/profile" className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>
              Edit profil
            </Link>
          )}

          <div className="profile-stats">
            <div className="stat">
              <strong>{profile.posts_count ?? 0}</strong>
              <span>Postingan</span>
            </div>
            <div className="stat">
              <strong>{profile.followers_count ?? 0}</strong>
              <span>Followers</span>
            </div>
            <div className="stat">
              <strong>{profile.following_count ?? 0}</strong>
              <span>Following</span>
            </div>
          </div>
        </div>

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

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Belum ada konten</h3>
          </div>
        ) : (
          <div className="profile-grid">
            {filtered.map((p) => (
              <div key={p.id}>
                {p.media_type === 'video' ? (
                  <video src={p.media_url} muted playsInline preload="metadata" />
                ) : (
                  <img src={p.media_url} alt="" loading="lazy" />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
