import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_REEL_DURATION = 90;

const icon = (children) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const OPTIONS = [
  {
    type: 'photo',
    title: 'Postingan Foto',
    desc: 'Bagikan foto ke feed',
    meta: 'JPG, PNG, WebP · maks 10 MB',
    icon: icon(
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </>
    ),
  },
  {
    type: 'video',
    title: 'Postingan Video',
    desc: 'Bagikan video ke feed',
    meta: 'MP4, WebM · maks 50 MB',
    icon: icon(
      <>
        <rect x="2" y="5" width="14" height="14" rx="3" />
        <path d="M16 10l6-3v10l-6-3" />
      </>
    ),
  },
  {
    type: 'reel',
    title: 'Reel',
    desc: 'Video vertikal singkat',
    meta: 'Maks 90 detik · maks 50 MB',
    icon: icon(
      <>
        <rect x="5" y="2" width="14" height="20" rx="3" />
        <path d="M10.5 9.5l4 2.5-4 2.5v-5z" fill="currentColor" stroke="none" />
      </>
    ),
  },
];

export default function CreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('choose'); // choose | form
  const [type, setType] = useState(null); // photo | video | reel
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const selectType = (t) => {
    setType(t);
    setStep('form');
    setError(null);
    setFile(null);
    setPreview(null);
    setCaption('');
    setTimeout(() => inputRef.current?.click(), 100);
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');

    if (type === 'photo' && !isImage) {
      setError('Pilih file gambar (JPEG, PNG, WebP)');
      return;
    }
    if ((type === 'video' || type === 'reel') && !isVideo) {
      setError('Pilih file video (MP4, WebM)');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(f.type)) {
      setError('Format tidak didukung');
      return;
    }
    if (isImage && f.size > MAX_IMAGE) {
      setError('Gambar maksimal 10 MB');
      return;
    }
    if (isVideo && f.size > MAX_VIDEO) {
      setError('Video maksimal 50 MB');
      return;
    }

    if (isVideo && type === 'reel') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > MAX_REEL_DURATION) {
          setError(`Reel maksimal ${MAX_REEL_DURATION} detik`);
          return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
        setError(null);
      };
      video.src = URL.createObjectURL(f);
    } else {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setError(null);
    }
  };

  const publish = async (asDraft = false) => {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 1. Get signed URL from our API
      let path, signedUrl, token, media_type;
      try {
        const up = await api.getUploadUrl({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        });
        path = up.path;
        signedUrl = up.signedUrl;
        token = up.token;
        media_type = up.media_type;
      } catch (e) {
        throw new Error(e.message || 'Gagal meminta URL upload ke server');
      }

      if (!signedUrl || !path) {
        throw new Error('Server tidak mengembalikan signed URL');
      }

      // 2. Upload file directly to Supabase Storage
      setProgress(20);
      let uploadRes;
      try {
        uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: file,
        });
      } catch (netErr) {
        console.error('Storage PUT failed:', netErr);
        throw new Error(
          'Gagal kirim file ke Storage (Failed to fetch). Cek policy bucket media + koneksi. Di Supabase SQL jalankan policy INSERT untuk storage.objects.'
        );
      }
      if (!uploadRes.ok) {
        const t = await uploadRes.text().catch(() => '');
        console.error('Storage status', uploadRes.status, t);
        throw new Error(`Upload Storage gagal (${uploadRes.status}). Cek policy bucket media.`);
      }
      setProgress(70);

      // 3. Create post metadata
      const postType = type === 'reel' ? 'reel' : 'post';
      let duration_seconds = null;

      await api.createPost({
        caption: caption.trim(),
        media_path: path,
        media_type,
        post_type: postType,
        duration_seconds,
        status: asDraft ? 'draft' : 'published',
      });
      setProgress(100);

      // Navigate
      if (postType === 'reel') {
        navigate('/reels');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal mempublikasikan');
    } finally {
      setUploading(false);
    }
  };

  if (step === 'choose') {
    return (
      <>
        <header className="app-header">
          <h1 style={{ fontSize: 18 }}>Buat</h1>
        </header>
        <main className="app-content">
          <div className="create-page">
            <div className="create-lead">Mau bagikan apa?</div>
            <p className="create-sub">Pilih jenis konten yang ingin kamu unggah.</p>

            <div className="create-list">
              {OPTIONS.map((o) => (
                <button key={o.type} type="button" className="create-card" onClick={() => selectType(o.type)}>
                  <span className="create-card-icon">{o.icon}</span>
                  <span className="create-card-body">
                    <span className="create-card-title">{o.title}</span>
                    <span className="create-card-desc">{o.desc}</span>
                    <span className="create-card-meta">{o.meta}</span>
                  </span>
                  <svg className="create-card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  const noun = type === 'photo' ? 'foto' : 'video';

  return (
    <>
      <header className="app-header">
        <button type="button" className="create-back" onClick={() => setStep('choose')} disabled={uploading}>
          Batal
        </button>
        <h1 style={{ fontSize: 18 }}>{type === 'photo' ? 'Foto' : type === 'video' ? 'Video' : 'Reel'}</h1>
        <span style={{ minWidth: 52 }} />
      </header>
      <main className="app-content">
        <div className="create-form">
          <input
            ref={inputRef}
            type="file"
            accept={type === 'photo' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'}
            style={{ display: 'none' }}
            onChange={onFileChange}
          />

          {error && <div className="create-error">{error}</div>}

          {!preview ? (
            <button type="button" className="create-dropzone" onClick={() => inputRef.current?.click()}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
              </svg>
              <strong>Pilih {noun}</strong>
              <span>
                {type === 'photo'
                  ? 'JPG, PNG, atau WebP · maks 10 MB'
                  : type === 'reel'
                  ? 'MP4 atau WebM · maks 50 MB · maks 90 detik'
                  : 'MP4 atau WebM · maks 50 MB'}
              </span>
            </button>
          ) : (
            <div className="create-preview">
              {type === 'photo' ? (
                <img src={preview} alt="Preview" style={{ width: '100%' }} />
              ) : (
                <video
                  src={preview}
                  controls
                  playsInline
                  style={{ width: '100%', maxHeight: type === 'reel' ? '60vh' : 360, objectFit: 'contain' }}
                />
              )}
              <button type="button" className="create-preview-change" onClick={() => inputRef.current?.click()} disabled={uploading}>
                Ganti
              </button>
            </div>
          )}

          <div className="create-field">
            <label htmlFor="caption">Caption</label>
            <textarea
              id="caption"
              className="input textarea"
              placeholder="Tulis caption…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={2200}
            />
            <div className="create-counter">{caption.length}/2200</div>
          </div>

          {uploading && (
            <div>
              <div className="create-progress">
                <div style={{ width: `${progress}%` }} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 8 }}>
                Mengunggah… {progress}%
              </p>
            </div>
          )}

          <div className="create-actions">
            <button type="button" className="btn btn-outline" onClick={() => publish(true)} disabled={!file || uploading}>
              Simpan draft
            </button>
            <button type="button" className="btn btn-primary" onClick={() => publish(false)} disabled={!file || uploading}>
              {uploading ? `${progress}%` : 'Bagikan'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
