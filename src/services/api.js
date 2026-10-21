const BASE = '/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    const err = new Error('Network error — periksa koneksi');
    err.status = 0;
    throw err;
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    let message = data.error || data.message;
    if (!message) {
      if (res.status === 404) {
        message = 'API tidak ditemukan (404). Redeploy versi terbaru ke Vercel.';
      } else if (res.status === 401) {
        message = 'Unauthorized';
      } else if (res.status === 500) {
        message = 'Server error — cek environment variables di Vercel';
      } else {
        message = res.statusText || `HTTP ${res.status}`;
      }
    }
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  authTelegram: (initData) =>
    request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  getPosts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/posts${q ? `?${q}` : ''}`);
  },
  createPost: (body) => request('/posts', { method: 'POST', body: JSON.stringify(body) }),

  toggleLike: (postId) =>
    request('/like', { method: 'POST', body: JSON.stringify({ post_id: postId }) }),
  toggleBookmark: (postId) =>
    request('/bookmark', { method: 'POST', body: JSON.stringify({ post_id: postId }) }),

  getComments: (postId) => request(`/comments?post_id=${encodeURIComponent(postId)}`),
  addComment: (postId, content) =>
    request('/comments', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId, content }),
    }),
  deleteComment: (postId, commentId) =>
    request(`/comments?comment_id=${encodeURIComponent(commentId)}`, { method: 'DELETE' }),

  getUploadUrl: (body) =>
    request('/upload-url', { method: 'POST', body: JSON.stringify(body) }),

  getReels: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reels${q ? `?${q}` : ''}`);
  },

  getUser: (id) => request(`/user?id=${encodeURIComponent(id)}`),
  updateUser: (id, body) =>
    request(`/user?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  toggleFollow: (id) =>
    request(`/user?id=${encodeURIComponent(id)}&action=follow`, { method: 'POST' }),
  searchUsers: (q) =>
    request(`/user?action=search&q=${encodeURIComponent(q)}`),

  getNotifications: () => request('/notifications'),
  markNotificationsRead: (body) =>
    request('/notifications', { method: 'POST', body: JSON.stringify(body || {}) }),
};
