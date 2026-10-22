import { useState, useRef } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../services/api';

function displayNameOf(user) {
  if (!user) return '';
  const n = (user.display_name || '').trim();
  if (n && n !== '.' && !n.startsWith('User ')) return n;
  const u = (user.username || '').trim();
  if (u) return u;
  return '';
}

export default function OnboardingPage() {
  const { user, setUser, setTheme, completeOnboarding, theme } = useAuth();
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(user?.avatar_url || null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const name = displayNameOf(user);

  const uploadAvatar = async (file) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setError('Pilih file gambar (JPEG/PNG/WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Foto maksimal 5 MB');
      return;
    }
    setUploading(true);
    setError(null);
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
      setUser(data.user);
      setPreview(publicUrl);
    } catch (err) {
      setError(err.message || 'Gagal upload foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="onboard-page">
      <div className="onboard-card">
        {step === 0 && (
          <>
            <div className="onboard-logo">MimiGram</div>
            <h1>
              Selamat datang{name ? `, ${name}` : ''}
              <span aria-hidden> 👋</span>
            </h1>
            <p>
              Bagikan momen, tonton Reels, dan terhubung dengan teman — langsung dari Telegram.
            </p>
            <button type="button" className="btn btn-primary onboard-btn" onClick={() => setStep(1)}>
              Lanjut
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h1>Pilih tema</h1>
            <p>Bisa diganti lagi nanti lewat Edit profil / pengaturan perangkat.</p>
            <div className="theme-picks">
              <button
                type="button"
                className={`theme-pick ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <span className="theme-preview light" />
                Terang
              </button>
              <button
                type="button"
                className={`theme-pick ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <span className="theme-preview dark" />
                Gelap
              </button>
            </div>
            <button type="button" className="btn btn-primary onboard-btn" onClick={() => setStep(2)}>
              Lanjut
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1>Foto profil</h1>
            <p>Opsional — bisa diganti kapan saja di Edit profil.</p>

            <button
              type="button"
              className="onboard-avatar-btn"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <img
                className="avatar avatar-xl"
                src={
                  preview ||
                  user?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=FF4D6D&color=fff&size=128`
                }
                alt=""
              />
              <span className="onboard-avatar-label">{uploading ? 'Mengunggah…' : 'Ganti foto'}</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPreview(URL.createObjectURL(f));
                  uploadAvatar(f);
                }
              }}
            />

            {error && <p className="onboard-error">{error}</p>}

            <button
              type="button"
              className="btn btn-primary onboard-btn"
              onClick={completeOnboarding}
              disabled={uploading}
            >
              Masuk ke MimiGram
            </button>
            <button
              type="button"
              className="onboard-skip"
              onClick={completeOnboarding}
              disabled={uploading}
            >
              Lewati
            </button>
          </>
        )}
      </div>
    </div>
  );
}
