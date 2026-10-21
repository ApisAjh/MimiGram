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
          api.getPosts({ user_id: user.id, limit: 50 }),
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

  // posts tab: all non-reel (photo + video posts); reels tab: reels OR any video
  const filtered =
    tab === 'posts'
      ? posts.filter((p) => p.post_type !== 'reel')
      : posts.filter((p) => p.post_type === 'reel' || p.media_type === 'video');

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
        <h1 style={{ fontSize: 17, fontWeight: 700 }}>
          {profile?.username ? `@${profile.username}` : 'Profil'}
        </h1>
        <button type="button" className="text-btn" onClick={logout}>
          Keluar
        </button>
      </header>

      <main className="app-content profile-page">
        <section className="profile-card">
          <div className="profile-top">
            <img
              className="avatar avatar-lg"
              src={
                profile?.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=FF4D6D&color=fff&size=128`
              }
              alt=""
            />
            <div className="profile-stats-row">
              <div className="stat">
                <strong>{profile?.posts_count ?? posts.length}</strong>
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

          {editing ? (
            <div className="profile-edit">
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nama tampilan"
                maxLength={50}
              />
              <textarea
                className="input textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio"
                maxLength={150}
                rows={3}
              />
              <div className="profile-edit-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={saveProfile}>
                  Simpan
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-info">
              <h2>{profile?.display_name || 'Pengguna'}</h2>
              {profile?.bio ? <p className="bio">{profile.bio}</p> : null}
              <button type="button" className="btn btn-outline btn-sm profile-edit-btn" onClick={() => setEditing(true)}>
                Edit profil
              </button>
            </div>
          )}
        </section>

        <div className="profile-tabs">
          <button
            type="button"
            className={tab === 'posts' ? 'active' : ''}
            onClick={() => setTab('posts')}
          >
            Postingan
          </button>
          <button
            type="button"
            className={tab === 'reels' ? 'active' : ''}
            onClick={() => setTab('reels')}
          >
            Video / Reels
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Belum ada konten</h3>
            <p>Bagikan {tab === 'posts' ? 'postingan' : 'video'} pertama Anda.</p>
            <Link to="/create" className="btn btn-primary" style={{ marginTop: 12 }}>
              Buat
            </Link>
          </div>
        ) : (
          <div className="profile-grid">
            {filtered.map((p) => (
              <div key={p.id} className="grid-cell">
                {p.media_type === 'video' ? (
                  <>
                    <video src={p.media_url} muted playsInline preload="metadata" />
                    <span className="grid-badge">▶</span>
                  </>
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
