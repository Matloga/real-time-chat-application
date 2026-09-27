import { io } from 'socket.io-client';
import { getToken } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket = null;

/**
 * Returns the shared socket, creating it on first call.
 *
 * The token is read at connect time and re-read on reconnect, so an expired
 * session fails loudly rather than silently retrying with a stale token.
 */
export const getSocket = () => {
  if (socket) return socket;

  socket = io(API_URL, {
    autoConnect: true,
    auth: (cb) => cb({ token: getToken() }),
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Must match SOCKET_EVENT in server/utils/constants.js
export const SOCKET_EVENT = {
  SEND_MESSAGE: 'send_message',
  JOIN_CONVERSATION: 'join_conversation',
  MARK_READ: 'mark_read',
  MESSAGE_RECEIVED: 'message_received',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
};
