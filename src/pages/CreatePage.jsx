import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_REEL_DURATION = 90;

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

  const publish = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 1. Get signed URL
      const { path, signedUrl, media_type } = await api.getUploadUrl({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      // 2. Upload to Supabase Storage
      setProgress(20);
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Upload gagal. Coba lagi.');
      }
      setProgress(70);

      // 3. Create post metadata
      const postType = type === 'reel' ? 'reel' : 'post';
      let duration_seconds = null;
      if (media_type === 'video') {
        // optional: could compute duration
      }

      await api.createPost({
        caption: caption.trim(),
        media_path: path,
        media_type,
        post_type: postType,
        duration_seconds,
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
          <div className="create-options">
            <button className="create-option" onClick={() => selectType('photo')}>
              <div className="icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div>
                <strong>Photo Post</strong>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Bagikan foto ke feed</div>
              </div>
            </button>
            <button className="create-option" onClick={() => selectType('video')}>
              <div className="icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <div>
                <strong>Video Post</strong>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Bagikan video ke feed</div>
              </div>
            </button>
            <button className="create-option" onClick={() => selectType('reel')}>
              <div className="icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="4" />
                  <path d="M10 8l6 4-6 4V8z" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <div>
                <strong>Create Reel</strong>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Video vertikal singkat (max 90s)</div>
              </div>
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="app-header">
        <button onClick={() => setStep('choose')} style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
          Batal
        </button>
        <h1 style={{ fontSize: 18 }}>
          {type === 'photo' ? 'Photo' : type === 'video' ? 'Video' : 'Reel'}
        </h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={publish}
          disabled={!file || uploading}
        >
          {uploading ? `${progress}%` : 'Bagikan'}
        </button>
      </header>
      <main className="app-content" style={{ padding: 16 }}>
        <input
          ref={inputRef}
          type="file"
          accept={type === 'photo' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'}
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        {error && (
          <p style={{ color: 'var(--color-danger)', marginBottom: 12, fontSize: 14 }}>{error}</p>
        )}

        {!preview ? (
          <button
            className="btn btn-outline"
            style={{ width: '100%', padding: 40 }}
            onClick={() => inputRef.current?.click()}
          >
            Pilih {type === 'photo' ? 'foto' : 'video'}
          </button>
        ) : (
          <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            {type === 'photo' ? (
              <img src={preview} alt="Preview" style={{ width: '100%' }} />
            ) : (
              <video
                src={preview}
                controls
                playsInline
                style={{ width: '100%', maxHeight: type === 'reel' ? '70vh' : 400, objectFit: 'contain' }}
              />
            )}
          </div>
        )}

        <textarea
          className="input textarea"
          placeholder="Tulis caption…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2200}
        />

        {uploading && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                height: 6,
                background: 'var(--color-border)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--color-primary)',
                  transition: 'width 0.2s',
                }}
              />
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 8 }}>
              Mengunggah… {progress}%
            </p>
          </div>
        )}
      </main>
    </>
  );
}
