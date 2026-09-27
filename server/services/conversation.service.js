const prisma = require('../config/prisma');
const { CONVERSATION_TYPE } = require('../utils/constants');
const ApiError = require('../utils/ApiError');

/**
 * Deterministic key for a pair of users, so the unique index on
 * conversations.directKey makes "one direct chat per pair" a database
 * guarantee rather than an application convention.
 */
const directKeyFor = (userIdA, userIdB) => [userIdA, userIdB].sort().join(':');

/**
 * Fetches the caller's conversations with their members, the latest message in
 * each, and an unread count.
 *
 * The unread pass is a single query rather than one COUNT per conversation:
 * we read every message newer than the *oldest* lastReadAt among the
 * conversations, then bucket them in JS against each conversation's own
 * lastReadAt. That keeps this at two round trips instead of N.
 */
const listForUser = async (userId) => {
  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: true } },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { sender: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (conversations.length === 0) return [];

  const membershipByConversation = new Map();
  for (const conversation of conversations) {
    membershipByConversation.set(
      conversation.id,
      conversation.members.find((m) => m.userId === userId)
    );
  }

  const oldestReadAt = conversations.reduce(
    (earliest, c) => {
      const readAt = membershipByConversation.get(c.id).lastReadAt;
      return readAt < earliest ? readAt : earliest;
    },
    new Date(8.64e15)
  );

  const recentMessages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderId: { not: userId },
      createdAt: { gt: oldestReadAt },
    },
    select: { conversationId: true, createdAt: true },
  });

  const unreadByConversation = new Map();
  for (const message of recentMessages) {
    const readAt = membershipByConversation.get(message.conversationId).lastReadAt;
    if (message.createdAt > readAt) {
      unreadByConversation.set(
        message.conversationId,
        (unreadByConversation.get(message.conversationId) || 0) + 1
      );
    }
  }

  return conversations.map((conversation) => {
    const me = membershipByConversation.get(conversation.id);
    const other =
      conversation.type === CONVERSATION_TYPE.DIRECT
        ? conversation.members.find((m) => m.userId !== userId)
        : null;

    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.type === CONVERSATION_TYPE.DIRECT ? null : conversation.name,
      lastReadAt: me.lastReadAt,
      unreadCount: unreadByConversation.get(conversation.id) || 0,
      lastMessage: conversation.messages[0]
        ? {
            id: conversation.messages[0].id,
            body: conversation.messages[0].body,
            createdAt: conversation.messages[0].createdAt,
            senderId: conversation.messages[0].senderId,
            sender: {
              username: conversation.messages[0].sender.username,
              displayName: conversation.messages[0].sender.displayName,
            },
          }
        : null,
      // What the sidebar row should show as the conversation title.
      counterpart: other
        ? {
            id: other.user.id,
            username: other.user.username,
            displayName: other.user.displayName,
            avatarColor: other.user.avatarColor,
            lastSeenAt: other.user.lastSeenAt,
          }
        : null,
      memberCount: conversation.members.length,
    };
  });
};

/**
 * Returns the existing DIRECT conversation between two users, creating it and
 * its two memberships if this is the first message between them.
 *
 * Two concurrent requests can both pass the "does it exist" check. The unique
 * index on directKey is what actually serialises them: the loser gets a P2002
 * and then reads the row the winner created.
 */
const getOrCreateDirect = async (currentUserId, otherUserId) => {
  if (currentUserId === otherUserId) {
    throw ApiError.badRequest('You cannot start a chat with yourself');
  }

  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!otherUser) throw ApiError.notFound('That user does not exist');

  const directKey = directKeyFor(currentUserId, otherUserId);

  const existing = await prisma.conversation.findUnique({
    where: { directKey },
    include: { members: { include: { user: true } } },
  });
  if (existing) return existing;

  try {
    return await prisma.conversation.create({
      data: {
        type: CONVERSATION_TYPE.DIRECT,
        directKey,
        createdById: currentUserId,
        members: {
          create: [{ userId: currentUserId }, { userId: otherUserId }],
        },
      },
      include: { members: { include: { user: true } } },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      const raced = await prisma.conversation.findUnique({
        where: { directKey },
        include: { members: { include: { user: true } } },
      });
      if (raced) return raced;
    }
    throw err;
  }
};

/** Throws 403 unless the user is a member of the conversation. */
const assertMember = async (conversationId, userId) => {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: true },
  });
  if (!membership) throw ApiError.forbidden('You are not a member of this conversation');
  return membership;
};

module.exports = { listForUser, getOrCreateDirect, assertMember, directKeyFor };
