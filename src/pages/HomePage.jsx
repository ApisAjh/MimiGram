import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import CommentsSheet from '../components/CommentsSheet';

function HeartIcon({ filled }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function PostCard({ post, onUpdate }) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [bookmarked, setBookmarked] = useState(post.bookmarked_by_me);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);

  const toggleLike = async () => {
    const prev = liked;
    setLiked(!prev);
    setLikes((c) => (prev ? c - 1 : c + 1));
    try {
      const res = await api.toggleLike(post.id);
      setLiked(res.liked);
    } catch {
      setLiked(prev);
      setLikes((c) => (prev ? c + 1 : c - 1));
    }
  };

  const toggleBookmark = async () => {
    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const res = await api.toggleBookmark(post.id);
      setBookmarked(res.bookmarked);
    } catch {
      setBookmarked(prev);
    }
  };

  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: localeId })
    : '';

  return (
    <article className="post-card">
      <div className="post-card-header">
        <Link to={`/profile/${post.user?.id}`}>
          <img
            className="avatar"
            src={post.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.display_name || 'U')}&background=FF4D6D&color=fff`}
            alt=""
          />
        </Link>
        <div className="meta">
          <Link to={`/profile/${post.user?.id}`} className="name">
            {post.user?.display_name || post.user?.username || 'Pengguna'}
          </Link>
          <div className="time">{timeAgo}</div>
        </div>
      </div>

      {post.media_type === 'video' ? (
        <video
          className="post-media video"
          src={post.media_url}
          poster={post.thumbnail_url || undefined}
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <img className="post-media" src={post.media_url} alt="" loading="lazy" />
      )}

      <div className="post-actions">
        <button className={liked ? 'liked' : ''} onClick={toggleLike} aria-label="Like">
          <HeartIcon filled={liked} />
          <span>{likes > 0 ? likes : ''}</span>
        </button>
        <button onClick={() => setShowComments(true)} aria-label="Komentar">
          <CommentIcon />
          <span>{commentsCount > 0 ? commentsCount : ''}</span>
        </button>
        <button onClick={toggleBookmark} aria-label="Simpan" style={{ marginLeft: 'auto' }}>
          <BookmarkIcon filled={bookmarked} />
        </button>
      </div>

      {post.caption?.trim() ? (
        <div className="post-caption">
          <span className="name">{post.user?.display_name || post.user?.username}</span>
          {' '}
          {post.caption.trim()}
        </div>
      ) : null}

      {commentsCount > 0 && (
        <button type="button" className="post-view-comments" onClick={() => setShowComments(true)}>
          Lihat semua {commentsCount} komentar
        </button>
      )}

      {showComments && (
        <CommentsSheet
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCountChange={(d) => {
            setCommentsCount((c) => Math.max(0, c + d));
            onUpdate?.();
          }}
        />
      )}
    </article>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const load = useCallback(async (nextCursor = null, append = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      const params = { limit: 15 };
      if (nextCursor) params.cursor = nextCursor;
      const data = await api.getPosts(params);
      setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err.message || 'Gagal memuat feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor && !loadingMore) {
          load(cursor, true);
        }
      },
      { rootMargin: '200px' }
    );
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [cursor, loadingMore, load]);

  return (
    <>
      <header className="app-header home-header">
        <h1 className="brand-title">MimiGram</h1>
        <Link to="/notifications" className="header-icon-btn" aria-label="Notifikasi">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </Link>
      </header>
      <main className="app-content">
        {loading && (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ padding: 16 }}>
                <div className="skeleton" style={{ height: 40, width: '60%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 300, marginBottom: 12 }} />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="empty-state">
            <h3>Gagal memuat</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => load()} style={{ marginTop: 12 }}>
              Coba lagi
            </button>
          </div>
        )}
        {!loading && !error && posts.length === 0 && (
          <div className="empty-state">
            <h3>Belum ada postingan</h3>
            <p>Ikuti pengguna lain atau buat postingan pertama Anda.</p>
            <Link to="/create" className="btn btn-primary" style={{ marginTop: 12 }}>
              Buat Postingan
            </Link>
          </div>
        )}
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {loadingMore && <div className="spinner" />}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </main>
    </>
  );
}
