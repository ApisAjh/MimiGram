import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

export default function UserProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [followingBusy, setFollowingBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (user?.id === id) {
      navigate('/profile', { replace: true });
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [u, postsData] = await Promise.all([
          api.getUser(id),
          api.getPosts({ user_id: id, limit: 50 }),
        ]);
        setProfile(u.user);
        setPosts(postsData.posts || []);
      } catch (err) {
        console.error(err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user?.id, navigate]);

  const toggleFollow = async () => {
    if (followingBusy) return;
    setFollowingBusy(true);
    try {
      const res = await api.toggleFollow(id);
      setProfile((p) => ({
        ...p,
        is_following: res.following,
        followers_count: Math.max(0, (p.followers_count || 0) + (res.following ? 1 : -1)),
      }));
    } catch (err) {
      alert(err.message);
    } finally {
      setFollowingBusy(false);
    }
  };

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

  if (!profile) {
    return (
      <main className="app-content">
        <div className="empty-state">
          <h3>Pengguna tidak ditemukan</h3>
          <Link to="/explore" className="btn btn-primary" style={{ marginTop: 12 }}>
            Kembali
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="app-header">
        <button type="button" className="text-btn" onClick={() => navigate(-1)}>
          ← Kembali
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>
          {profile.username ? `@${profile.username}` : profile.display_name}
        </h1>
        <span style={{ width: 64 }} />
      </header>

      <main className="app-content profile-page">
        <section className="profile-card">
          <div className="profile-top">
            <img
              className="avatar avatar-lg"
              src={
                profile.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || 'U')}&background=FF4D6D&color=fff&size=128`
              }
              alt=""
            />
            <div className="profile-stats-row">
              <div className="stat">
                <strong>{profile.posts_count ?? posts.length}</strong>
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
          <div className="profile-info">
            <h2>{profile.display_name || 'Pengguna'}</h2>
            {profile.bio ? <p className="bio">{profile.bio}</p> : null}
            <button
              type="button"
              className={`btn btn-sm profile-edit-btn ${profile.is_following ? 'btn-outline' : 'btn-primary'}`}
              onClick={toggleFollow}
              disabled={followingBusy}
            >
              {followingBusy ? '…' : profile.is_following ? 'Following' : 'Follow'}
            </button>
          </div>
        </section>

        <div className="profile-tabs">
          <button type="button" className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>
            Postingan
          </button>
          <button type="button" className={tab === 'reels' ? 'active' : ''} onClick={() => setTab('reels')}>
            Video / Reels
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Belum ada konten</h3>
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
