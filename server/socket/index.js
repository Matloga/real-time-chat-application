const { Server } = require('socket.io');
const prisma = require('../config/prisma');
const config = require('../config/env');
const { verifyToken } = require('../middleware/auth');
const conversationService = require('../services/conversation.service');
const { CONVERSATION_TYPE, SOCKET_EVENT } = require('../utils/constants');

/**
 * userId -> Set<socketId>
 *
 * A Set rather than a single socket id so that a user signed in on a phone and
 * a laptop is only reported offline when the *last* socket disconnects.
 */
const onlineUsers = new Map();

const isOnline = (userId) => onlineUsers.has(userId);

const userRoom = (userId) => `user:${userId}`;
const conversationRoom = (conversationId) => `conversation:${conversationId}`;

/**
 * Everyone else needs to know about presence changes, so we broadcast to all
 * connected sockets. Fine at this scale; at real scale you would only notify
 * users who share a conversation with the person whose status changed.
 */
const broadcastPresence = (io, userId, online) => {
  io.emit(online ? SOCKET_EVENT.USER_ONLINE : SOCKET_EVENT.USER_OFFLINE, {
    userId,
    lastSeenAt: new Date().toISOString(),
  });
};

/** Wire format for a message, shared by the ack, the broadcast and the sender's other devices. */
const shapeMessage = (message) => ({
  id: message.id,
  conversationId: message.conversationId,
  body: message.body,
  createdAt: message.createdAt,
  senderId: message.senderId,
  clientMessageId: message.clientMessageId,
  sender: {
    id: message.sender.id,
    username: message.sender.username,
    displayName: message.sender.displayName,
    avatarColor: message.sender.avatarColor,
  },
});

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
  });

  // Reject unauthenticated sockets before any event handler runs.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      socket.user = verifyToken(token);
      return next();
    } catch (err) {
      return next(new Error(err.message));
    }
  });

  io.on('connection', async (socket) => {
    const { id: userId, username } = socket.user;
    const wasOffline = !isOnline(userId);

    const sockets = onlineUsers.get(userId) || new Set();
    sockets.add(socket.id);
    onlineUsers.set(userId, sockets);

    socket.join(userRoom(userId));
    console.log(`[socket] connected: ${username} (${socket.id})`);

    if (wasOffline) {
      prisma.user
        .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
        .catch((err) => console.error('[socket] lastSeen update failed', err));
      broadcastPresence(io, userId, true);
    }

    // Load every conversation this user belongs to so the server can push to
    // them without the client having to re-subscribe after a refresh.
    try {
      const memberships = await prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      await socket.join(memberships.map((m) => conversationRoom(m.conversationId)));
    } catch (err) {
      console.error('[socket] failed to join conversation rooms', err);
    }

    socket.on(SOCKET_EVENT.JOIN_CONVERSATION, async ({ conversationId }, ack) => {
      try {
        await conversationService.assertMember(conversationId, userId);
        await socket.join(conversationRoom(conversationId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on(SOCKET_EVENT.LEAVE_CONVERSATION, async ({ conversationId }) => {
      await socket.leave(conversationRoom(conversationId));
    });

    socket.on(SOCKET_EVENT.SEND_MESSAGE, async (payload, ack) => {
      try {
        const { conversationId, body, clientMessageId } = payload || {};

        if (typeof body !== 'string' || body.trim().length === 0) {
          throw new Error('Message body cannot be empty');
        }
        if (body.length > 4000) {
          throw new Error('Message is too long (4000 character limit)');
        }
        if (!clientMessageId) {
          throw new Error('clientMessageId is required');
        }

        // Authorisation before insert: a non-member must not be able to write
        // into an arbitrary conversation.
        await conversationService.assertMember(conversationId, userId);

        let message;
        try {
          message = await prisma.message.create({
            data: { conversationId, senderId: userId, body: body.trim(), clientMessageId },
            include: { sender: true },
          });
        } catch (err) {
          if (err.code === 'P2002') {
            // The client retried an emit it had already sent. Return the row
            // that won the race instead of creating a second copy.
            const existing = await prisma.message.findUnique({
              where: { conversationId_clientMessageId: { conversationId, clientMessageId } },
              include: { sender: true },
            });
            ack?.({ ok: true, duplicate: true, message: shapeMessage(existing) });
            socket.emit(SOCKET_EVENT.MESSAGE_RECEIVED, shapeMessage(existing));
            return;
          }
          throw err;
        }

        const shaped = shapeMessage(message);

        // Everyone viewing the conversation gets it...
        io.to(conversationRoom(conversationId)).emit(SOCKET_EVENT.MESSAGE_RECEIVED, shaped);
        // ...and the sender's other devices get it too, so a message sent from
        // the laptop also appears on the phone.
        socket.to(userRoom(userId)).emit(SOCKET_EVENT.MESSAGE_RECEIVED, shaped);

        ack?.({ ok: true, message: shaped });

        // The sender has by definition read their own message.
        prisma.conversationMember
          .updateMany({
            where: { conversationId, userId },
            data: { lastReadAt: message.createdAt },
          })
          .catch((err) => console.error('[socket] lastRead update failed', err));
      } catch (err) {
        console.error('[socket] send_message failed', err.message);
        ack?.({ ok: false, error: err.message });
        socket.emit(SOCKET_EVENT.SOCKET_ERROR, { event: SOCKET_EVENT.SEND_MESSAGE, error: err.message });
      }
    });

    socket.on(SOCKET_EVENT.MARK_READ, async ({ conversationId }, ack) => {
      try {
        await conversationService.assertMember(conversationId, userId);
        const updated = await prisma.conversationMember.updateMany({
          where: { conversationId, userId },
          data: { lastReadAt: new Date() },
        });
        ack?.({ ok: true, count: updated.count });
        socket.to(conversationRoom(conversationId)).emit(SOCKET_EVENT.MARK_READ, {
          conversationId,
          userId,
        });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', async (reason) => {
      const remaining = onlineUsers.get(userId);
      if (remaining) {
        remaining.delete(socket.id);
        if (remaining.size === 0) {
          onlineUsers.delete(userId);
          broadcastPresence(io, userId, false);
          prisma.user
            .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
            .catch((err) => console.error('[socket] lastSeen update failed', err));
        }
      }
      console.log(`[socket] disconnected: ${username} (${reason})`);
    });
  });

  return io;
};

module.exports = { initSocket, isOnline, onlineUsers, CONVERSATION_TYPE };
