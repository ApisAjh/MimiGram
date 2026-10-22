import { useState } from 'react';
import { Link } from 'react-router-dom';
import CommentsSheet from './CommentsSheet';

/**
 * Bottom sheet post viewer (Instagram-style).
 * props:
 *  - post
 *  - onClose
 *  - isOwner?: boolean
 *  - onDelete?: () => void
 *  - onPublish?: () => void  // for drafts
 *  - busy?: boolean
 */
export default function PostViewer({ post, onClose, isOwner, onDelete, onPublish, busy }) {
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post?.comments_count || 0);

  if (!post) return null;

  const user = post.user;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()} role="presentation">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          {user ? (
            <Link to={`/profile/${user.id}`} className="modal-user" onClick={(e) => e.stopPropagation()}>
              <img
                className="avatar"
                src={
                  user.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name || 'U')}&background=FF4D6D&color=fff`
                }
                alt=""
              />
              <div>
                <div className="modal-user-name">{user.display_name || user.username || 'Pengguna'}</div>
                {user.username ? <div className="modal-user-handle">@{user.username}</div> : null}
              </div>
            </Link>
          ) : (
            <strong>{post.status === 'draft' ? 'Draft' : 'Postingan'}</strong>
          )}
          <button type="button" className="text-btn" onClick={onClose} disabled={busy}>
            Tutup
          </button>
        </div>

        <div className="modal-media">
          {post.media_type === 'video' ? (
            <video src={post.media_url} controls playsInline autoPlay />
          ) : (
            <img src={post.media_url} alt="" />
          )}
        </div>

        {post.caption ? <p className="modal-caption">{post.caption}</p> : null}

        <div className="modal-stats">
          <span className="modal-stat">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {post.likes_count > 0 ? post.likes_count : ''}
          </span>
          <button
            type="button"
            className="modal-stat modal-stat-btn"
            onClick={() => setShowComments(true)}
            aria-label="Komentar"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {commentsCount > 0 ? commentsCount : ''}
          </button>
        </div>

        {commentsCount > 0 && (
          <button type="button" className="post-view-comments modal-view-comments" onClick={() => setShowComments(true)}>
            Lihat semua {commentsCount} komentar
          </button>
        )}

        {isOwner && (
          <div className="modal-actions">
            {post.status === 'draft' && onPublish && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onPublish}>
                Publikasikan
              </button>
            )}
            {onDelete && (
              <button type="button" className="btn btn-danger" disabled={busy} onClick={onDelete}>
                Hapus postingan
              </button>
            )}
          </div>
        )}
      </div>

      {showComments && post.status !== 'draft' && (
        <CommentsSheet
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCountChange={(d) => setCommentsCount((c) => Math.max(0, c + d))}
        />
      )}
    </div>
  );
}
