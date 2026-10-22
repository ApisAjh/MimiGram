import { useState, useRef } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../services/api';

export default function OnboardingPage() {
  const { user, setUser, setTheme, completeOnboarding, theme } = useAuth();
  const [step, setStep] = useState(0); // 0 welcome, 1 theme, 2 avatar
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(user?.avatar_url || null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const uploadAvatar = async (file) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setError('Pilih file gambar');
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
        try {
          publicUrl = `${new URL(up.signedUrl).origin}/storage/v1/object/public/media/${up.path}`;
        } catch {
          throw new Error('URL foto tidak valid');
        }
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

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setPreview(URL.createObjectURL(f));
      uploadAvatar(f);
    }
  };

  return (
    <div className="onboard-page">
      {step === 0 && (
        <div className="onboard-card">
          <div className="onboard-logo">MimiGram</div>
          <h1>Selamat datang{user?.display_name ? `, ${user.display_name}` : ''}! 👋</h1>
          <p>
            Bagikan momen, tonton Reels, dan terhubung dengan teman — langsung dari Telegram.
          </p>
          <button type="button" className="btn btn-primary onboard-btn" onClick={() => setStep(1)}>
            Lanjut
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="onboard-card">
          <h1>Pilih tema</h1>
          <p>Kamu bisa mengubahnya lagi nanti di pengaturan perangkat.</p>
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
        </div>
      )}

      {step === 2 && (
        <div className="onboard-card">
          <h1>Foto profil</h1>
          <p>Opsional — kamu bisa ganti kapan saja di Edit profil.</p>
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
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.display_name || 'U')}&background=FF4D6D&color=fff&size=128`
              }
              alt=""
            />
            <span>{uploading ? 'Mengunggah…' : 'Ganti foto'}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={onFile}
          />
          {error && <p className="onboard-error">{error}</p>}
          <button type="button" className="btn btn-primary onboard-btn" onClick={completeOnboarding} disabled={uploading}>
            Masuk ke MimiGram
          </button>
          <button type="button" className="text-btn" style={{ marginTop: 12 }} onClick={completeOnboarding}>
            Lewati
          </button>
        </div>
      )}
    </div>
  );
}
