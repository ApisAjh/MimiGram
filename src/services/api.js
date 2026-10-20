/**
 * API client - all requests include credentials for session cookie
 */

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  authTelegram: (initData) =>
    request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Posts
  getPosts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/posts${q ? `?${q}` : ''}`);
  },
  createPost: (body) => request('/posts', { method: 'POST', body: JSON.stringify(body) }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
  getPost: (id) => request(`/posts/${id}`),
  toggleLike: (id) => request(`/posts/${id}/like`, { method: 'POST' }),
  toggleBookmark: (id) => request(`/posts/${id}/bookmark`, { method: 'POST' }),
  getComments: (id) => request(`/posts/${id}/comments`),
  addComment: (id, content) =>
    request(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  deleteComment: (id, commentId) =>
    request(`/posts/${id}/comments?comment_id=${commentId}`, { method: 'DELETE' }),
  getUploadUrl: (body) =>
    request('/posts/upload-url', { method: 'POST', body: JSON.stringify(body) }),

  // Reels
  getReels: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reels${q ? `?${q}` : ''}`);
  },

  // Users
  getUser: (id) => request(`/users/${id}`),
  updateUser: (id, body) =>
    request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  toggleFollow: (id) => request(`/users/${id}/follow`, { method: 'POST' }),
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationsRead: (body) =>
    request('/notifications', { method: 'POST', body: JSON.stringify(body) }),
};
