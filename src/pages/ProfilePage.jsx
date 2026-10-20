import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts');
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [me, postsData] = await Promise.all([
          api.me(),
          api.getPosts({ user_id: user.id, limit: 30 }),
        ]);
        setProfile(me.user);
        setDisplayName(me.user.display_name || '');
        setBio(me.user.bio || '');
        setPosts(postsData.posts || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const saveProfile = async () => {
    try {
      const data = await api.updateUser(user.id, { display_name: displayName, bio });
      setProfile((p) => ({ ...p, ...data.user }));
      await refreshUser();
      setEditing(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = posts.filter((p) =>
    tab === 'posts' ? p.post_type === 'post' : p.post_type === 'reel'
  );

  if (loading) {
    return (
      <main className="app-content">
        <div className="spinner" />
      </main>
    );
  }

  return (
    <>
      <header className="app-header">
        <h1 style={{ fontSize: 18 }}>{profile?.username || 'Profil'}</h1>
        <button onClick={logout} style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Keluar
        </button>
      </header>
      <main className="app-content">
        <div className="profile-header">
          <img
            className="avatar avatar-lg"
            src={
              profile?.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=FF4D6D&color=fff&size=128`
            }
            alt=""
          />
          {editing ? (
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nama tampilan"
                maxLength={50}
                style={{ marginBottom: 8 }}
              />
              <textarea
                className="input textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio"
                maxLength={150}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={saveProfile}>
                  Simpan
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ marginTop: 12, fontSize: 18 }}>{profile?.display_name}</h2>
              {profile?.bio && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
                  {profile.bio}
                </p>
              )}
              <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>
                Edit profil
              </button>
            </>
          )}

          <div className="profile-stats">
            <div className="stat">
              <strong>{profile?.posts_count ?? 0}</strong>
              <span>Postingan</span>
            </div>
            <div className="stat">
              <strong>{profile?.followers_count ?? 0}</strong>
              <span>Followers</span>
            </div>
            <div className="stat">
              <strong>{profile?.following_count ?? 0}</strong>
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
            <p>Bagikan {tab === 'posts' ? 'postingan' : 'Reel'} pertama Anda.</p>
            <Link to="/create" className="btn btn-primary" style={{ marginTop: 12 }}>
              Buat
            </Link>
          </div>
        ) : (
          <div className="profile-grid">
            {filtered.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
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
