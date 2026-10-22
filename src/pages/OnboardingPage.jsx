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

const pageStyle = {
  minHeight: '100%',
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '28px 24px',
  boxSizing: 'border-box',
  background: 'var(--color-bg, #fafafa)',
};

const cardStyle = {
  width: '100%',
  maxWidth: 380,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const logoStyle = {
  fontSize: 28,
  fontWeight: 800,
  color: '#FF4D6D',
  marginBottom: 20,
  letterSpacing: '-0.02em',
};

const h1Style = {
  fontSize: 22,
  fontWeight: 700,
  color: 'var(--color-text, #1a1a1a)',
  margin: '0 0 10px',
  lineHeight: 1.3,
  width: '100%',
};

const pStyle = {
  color: 'var(--color-text-secondary, #6b7280)',
  fontSize: 14,
  lineHeight: 1.5,
  margin: '0 0 28px',
  width: '100%',
};

const btnStyle = {
  width: '100%',
  padding: '14px 20px',
  fontSize: 16,
  fontWeight: 600,
  borderRadius: 12,
  border: 'none',
  background: '#FF4D6D',
  color: '#fff',
  cursor: 'pointer',
  display: 'block',
  boxSizing: 'border-box',
};

const skipStyle = {
  marginTop: 14,
  background: 'none',
  border: 'none',
  color: 'var(--color-text-secondary, #6b7280)',
  fontSize: 14,
  fontWeight: 500,
  padding: '8px 12px',
  cursor: 'pointer',
};

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
    <div style={pageStyle}>
      <div style={cardStyle}>
        {step === 0 && (
          <>
            <div style={logoStyle}>MimiGram</div>
            <h1 style={h1Style}>
              Selamat datang{name ? `, ${name}` : ''}{' '}
              <span aria-hidden>👋</span>
            </h1>
            <p style={pStyle}>
              Bagikan momen, tonton Reels, dan terhubung dengan teman — langsung dari Telegram.
            </p>
            <button type="button" style={btnStyle} onClick={() => setStep(1)}>
              Lanjut
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h1 style={h1Style}>Pilih tema</h1>
            <p style={pStyle}>Bisa diganti lagi nanti.</p>
            <div
              style={{
                display: 'flex',
                gap: 12,
                width: '100%',
                marginBottom: 28,
              }}
            >
              <button
                type="button"
                onClick={() => setTheme('light')}
                style={{
                  flex: 1,
                  border: theme === 'light' ? '2px solid #FF4D6D' : '2px solid #e5e7eb',
                  borderRadius: 14,
                  padding: '14px 10px',
                  background: 'var(--color-surface, #fff)',
                  color: 'var(--color-text, #1a1a1a)',
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: '100%',
                    height: 52,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #fafafa, #e5e7eb)',
                    border: '1px solid #ddd',
                  }}
                />
                Terang
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                style={{
                  flex: 1,
                  border: theme === 'dark' ? '2px solid #FF4D6D' : '2px solid #e5e7eb',
                  borderRadius: 14,
                  padding: '14px 10px',
                  background: 'var(--color-surface, #fff)',
                  color: 'var(--color-text, #1a1a1a)',
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: '100%',
                    height: 52,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #1a1a1a, #333)',
                  }}
                />
                Gelap
              </button>
            </div>
            <button type="button" style={btnStyle} onClick={() => setStep(2)}>
              Lanjut
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={h1Style}>Foto profil</h1>
            <p style={pStyle}>Opsional — bisa diganti kapan saja di Edit profil.</p>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                margin: '0 0 24px',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <img
                src={
                  preview ||
                  user?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=FF4D6D&color=fff&size=128`
                }
                alt=""
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #e5e7eb',
                  background: '#f3f4f6',
                }}
              />
              <span style={{ color: '#FF4D6D', fontWeight: 600, fontSize: 14 }}>
                {uploading ? 'Mengunggah…' : 'Ganti foto'}
              </span>
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

            {error && (
              <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 12px', width: '100%' }}>
                {error}
              </p>
            )}

            <button
              type="button"
              style={{ ...btnStyle, opacity: uploading ? 0.6 : 1 }}
              onClick={completeOnboarding}
              disabled={uploading}
            >
              Masuk ke MimiGram
            </button>
            <button type="button" style={skipStyle} onClick={completeOnboarding} disabled={uploading}>
              Lewati
            </button>
          </>
        )}
      </div>
    </div>
  );
}
