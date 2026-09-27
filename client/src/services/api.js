const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'chat.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Thin fetch wrapper. Sends the JWT, parses JSON, and turns non-2xx responses
 * into a thrown Error carrying the server's field-level validation details so
 * forms can render them inline.
 */
const request = async (path, { method = 'GET', body, auth = true } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }

  return payload;
};

export const api = {
  register: (data) => request('/auth/register', { method: 'POST', body: data, auth: false }),
  login: (data) => request('/auth/login', { method: 'POST', body: data, auth: false }),
  me: () => request('/auth/me'),
  listUsers: (search = '') =>
    request(`/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  listConversations: () => request('/conversations'),
  startDirect: (userId) => request('/conversations/direct', { method: 'POST', body: { userId } }),
  listMessages: (conversationId, cursor) =>
    request(
      `/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ''}`
    ),
  markRead: (conversationId) =>
    request(`/conversations/${conversationId}/read`, { method: 'POST' }),
};
