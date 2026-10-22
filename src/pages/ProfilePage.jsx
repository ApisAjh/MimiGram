import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import PostViewer from '../components/PostViewer';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [tab, setTab] = useState('posts');
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarRef = useRef(null);

  const uploadAvatar = async (file) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      alert('Pilih file gambar');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Foto maksimal 5 MB');
      return;
    }
    setAvatarBusy(true);
    try {
      const up = await api.getUploadUrl({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });
      const put = await fetch(up.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          ...(up.token ? { Authorization: `Bearer ${up.token}` } : {}),
        },
        body: file,
      });
      if (!put.ok) throw new Error('Upload gagal');
      let publicUrl = up.publicUrl;
      if (!publicUrl) {
        publicUrl = `${new URL(up.signedUrl).origin}/storage/v1/object/public/media/${up.path}`;
      }
      const data = await api.updateUser(user.id, { avatar_url: publicUrl });
      setProfile((p) => ({ ...p, ...data.user }));
      await refreshUser();
    } catch (err) {
      alert(err.message || 'Gagal ganti foto');
    } finally {
      setAvatarBusy(false);
    }
  };

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [me, postsData, draftsData] = await Promise.all([
        api.me(),
        api.getPosts({ user_id: user.id, limit: 50 }),
        api.getPosts({ user_id: user.id, status: 'draft', limit: 50 }),
      ]);
      setProfile(me.user);
      setDisplayName(me.user.display_name || '');
      setBio(me.user.bio || '');
      setPosts(postsData.posts || []);
      setDrafts(draftsData.posts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleDelete = async () => {
    if (!selected || !confirm('Hapus postingan ini?')) return;
    setBusy(true);
    try {
      await api.deletePost(selected.id);
      setPosts((list) => list.filter((p) => p.id !== selected.id));
      setDrafts((list) => list.filter((p) => p.id !== selected.id));
      setSelected(null);
      setProfile((p) =>
        p
          ? {
              ...p,
              posts_count: Math.max(0, (p.posts_count || 1) - (selected.status === 'published' ? 1 : 0)),
            }
          : p
      );
    } catch (err) {
      alert(err.message || 'Gagal menghapus');
    } finally {
      setBusy(false);
    }
  };

  const publishDraft = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.updatePost(selected.id, { status: 'published' });
      setSelected(null);
      await load();
      await refreshUser();
    } catch (err) {
      alert(err.message || 'Gagal mempublikasikan');
    } finally {
      setBusy(false);
    }
  };

  const filtered =
    tab === 'drafts'
      ? drafts
      : tab === 'posts'
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
              <button
                type="button"
                className="onboard-avatar-btn"
                style={{ marginBottom: 12 }}
                onClick={() => avatarRef.current?.click()}
                disabled={avatarBusy}
              >
                <img
                  className="avatar avatar-lg"
                  src={
                    profile?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=FF4D6D&color=fff&size=128`
                  }
                  alt=""
                />
                <span>{avatarBusy ? 'Mengunggah…' : 'Ganti foto profil'}</span>
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                }}
              />
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
              <button
                type="button"
                className="btn btn-outline btn-sm profile-edit-btn"
                onClick={() => setEditing(true)}
              >
                Edit profil
              </button>
            </div>
          )}
        </section>

        <div className="profile-tabs">
          <button type="button" className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>
            Postingan
          </button>
          <button type="button" className={tab === 'reels' ? 'active' : ''} onClick={() => setTab('reels')}>
            Video
          </button>
          <button type="button" className={tab === 'drafts' ? 'active' : ''} onClick={() => setTab('drafts')}>
            Draft{drafts.length ? ` (${drafts.length})` : ''}
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{tab === 'drafts' ? 'Tidak ada draft' : 'Belum ada konten'}</h3>
            <p>
              {tab === 'drafts'
                ? 'Simpan sebagai draft saat membuat postingan.'
                : `Bagikan ${tab === 'posts' ? 'postingan' : 'video'} pertama Anda.`}
            </p>
            {tab !== 'drafts' && (
              <Link to="/create" className="btn btn-primary" style={{ marginTop: 12 }}>
                Buat
              </Link>
            )}
          </div>
        ) : (
          <div className="profile-grid">
            {filtered.map((p) => (
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
                {p.status === 'draft' && <span className="grid-badge draft-badge">Draft</span>}
              </button>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <PostViewer
          post={selected}
          onClose={() => setSelected(null)}
          isOwner
          busy={busy}
          onDelete={handleDelete}
          onPublish={selected.status === 'draft' ? publishDraft : undefined}
        />
      )}
    </>
  );
}
