const prisma = require('../config/prisma');
const conversationService = require('../services/conversation.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { z } = require('zod');

const MESSAGE_PAGE_SIZE = 50;

const list = asyncHandler(async (req, res) => {
  const conversations = await conversationService.listForUser(req.user.id);
  res.json({ conversations });
});

const startDirect = asyncHandler(async (req, res) => {
  const result = z
    .object({ userId: z.string().uuid('Invalid user id') })
    .safeParse(req.body);

  if (!result.success) {
    throw ApiError.badRequest('Invalid user id', {
      userId: result.error.issues[0].message,
    });
  }

  const conversation = await conversationService.getOrCreateDirect(
    req.user.id,
    result.data.userId
  );
  res.status(201).json({ conversation: { id: conversation.id, type: conversation.type } });
});

const messages = asyncHandler(async (req, res) => {
  await conversationService.assertMember(req.params.id, req.user.id);

  const { cursor } = req.query;
  const take = Math.min(Number(req.query.limit) || MESSAGE_PAGE_SIZE, 100);

  // Keyset pagination on createdAt: more reliable than OFFSET once a
  // conversation has thousands of messages.
  const rows = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    include: { sender: true },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  res.json({
    messages: page.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      senderId: m.senderId,
      clientMessageId: m.clientMessageId,
      sender: {
        id: m.sender.id,
        username: m.sender.username,
        displayName: m.sender.displayName,
        avatarColor: m.sender.avatarColor,
      },
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

const markRead = asyncHandler(async (req, res) => {
  const membership = await conversationService.assertMember(req.params.id, req.user.id);
  const updated = await prisma.conversationMember.update({
    where: { id: membership.id },
    data: { lastReadAt: new Date() },
  });
  res.json({ conversationId: updated.conversationId, lastReadAt: updated.lastReadAt });
});

module.exports = { list, startDirect, messages, markRead };
