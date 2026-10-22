import { Link } from 'react-router-dom';

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

        {(post.likes_count > 0 || post.comments_count > 0) && (
          <div className="modal-stats">
            {post.likes_count > 0 ? <span>♥ {post.likes_count}</span> : null}
            {post.comments_count > 0 ? <span>💬 {post.comments_count}</span> : null}
          </div>
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
    </div>
  );
}
