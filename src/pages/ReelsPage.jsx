import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';

export default function ReelsPage() {
  const { user } = useAuth();
  const [reels, setReels] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const videoRefs = useRef({});

  const load = useCallback(async (nextCursor = null, append = false) => {
    try {
      if (!append) setLoading(true);
      const params = { limit: 8 };
      if (nextCursor) params.cursor = nextCursor;
      const data = await api.getReels(params);
      setReels((prev) => (append ? [...prev, ...data.reels] : data.reels));
      setCursor(data.nextCursor);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // IntersectionObserver for active reel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = parseInt(entry.target.dataset.index, 10);
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: [0.6] }
    );

    const items = container.querySelectorAll('.reel-item');
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels]);

  // Play/pause videos
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, video]) => {
      if (!video) return;
      if (parseInt(idx, 10) === activeIndex) {
        video.muted = muted;
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeIndex, muted]);

  // Load more when near end
  useEffect(() => {
    if (activeIndex >= reels.length - 2 && cursor) {
      load(cursor, true);
    }
  }, [activeIndex, reels.length, cursor, load]);

  const toggleLike = async (reel) => {
    try {
      const res = await api.toggleLike(reel.id);
      setReels((prev) =>
        prev.map((r) =>
          r.id === reel.id
            ? {
                ...r,
                liked_by_me: res.liked,
                likes_count: r.likes_count + (res.liked ? 1 : -1),
              }
            : r
        )
      );
    } catch {
      // ignore
    }
  };

  const toggleFollow = async (userId) => {
    try {
      const res = await api.toggleFollow(userId);
      setReels((prev) =>
        prev.map((r) =>
          r.user?.id === userId ? { ...r, is_following: res.following } : r
        )
      );
    } catch {
      // ignore
    }
  };

  if (loading && reels.length === 0) {
    return (
      <div className="reels-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ borderTopColor: '#fff' }} />
      </div>
    );
  }

  if (!loading && reels.length === 0) {
    return (
      <div className="reels-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div className="empty-state" style={{ color: '#fff' }}>
          <h3>Belum ada Reels</h3>
          <p>Jadilah yang pertama membuat Reel!</p>
          <Link to="/create" className="btn btn-primary" style={{ marginTop: 12 }}>
            Buat Reel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="reels-container"
      style={{
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        height: '100vh',
      }}
    >
      {reels.map((reel, idx) => (
        <div
          key={reel.id}
          className="reel-item"
          data-index={idx}
          style={{ height: '100vh', scrollSnapAlign: 'start' }}
        >
          <video
            ref={(el) => {
              if (el) videoRefs.current[idx] = el;
            }}
            className="reel-video"
            src={reel.media_url}
            poster={reel.thumbnail_url || undefined}
            loop
            playsInline
            muted={muted}
            preload={idx <= activeIndex + 1 ? 'auto' : 'none'}
          />
          <div className="reel-overlay">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Link to={`/profile/${reel.user?.id}`}>
                <img
                  className="avatar"
                  src={
                    reel.user?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.user?.display_name || 'U')}&background=FF4D6D&color=fff`
                  }
                  alt=""
                />
              </Link>
              <div style={{ flex: 1, color: '#fff' }}>
                <div style={{ fontWeight: 600 }}>{reel.user?.display_name}</div>
              </div>
              {reel.user?.id !== user?.id && (
                <button
                  className="btn btn-sm"
                  style={{
                    background: reel.is_following ? 'transparent' : 'var(--color-primary)',
                    color: '#fff',
                    border: reel.is_following ? '1px solid #fff' : 'none',
                  }}
                  onClick={() => toggleFollow(reel.user.id)}
                >
                  {reel.is_following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            {reel.caption && (
              <p style={{ color: '#fff', fontSize: 14, marginBottom: 8, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {reel.caption}
              </p>
            )}
          </div>

          <div className="reel-side-actions">
            <button onClick={() => toggleLike(reel)}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill={reel.liked_by_me ? '#FF4D6D' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              <span>{reel.likes_count || ''}</span>
            </button>
            <button>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <span>{reel.comments_count || ''}</span>
            </button>
            <button onClick={() => setMuted((m) => !m)}>
              {muted ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                </svg>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
