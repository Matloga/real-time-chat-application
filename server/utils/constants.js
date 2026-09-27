// Prisma does not support native enums on SQL Server, so these values are the
// single source of truth for the string columns in prisma/schema.prisma.

const CONVERSATION_TYPE = {
  DIRECT: 'DIRECT',
  GROUP: 'GROUP',
};

const SOCKET_EVENT = {
  // client -> server
  SEND_MESSAGE: 'send_message',
  JOIN_CONVERSATION: 'join_conversation',
  LEAVE_CONVERSATION: 'leave_conversation',
  MARK_READ: 'mark_read',
  // server -> client
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_ACK: 'message_ack',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  CONVERSATION_UPDATED: 'conversation_updated',
  SOCKET_ERROR: 'socket_error',
};

module.exports = { CONVERSATION_TYPE, SOCKET_EVENT };
