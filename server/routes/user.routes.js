const express = require('express');
const prisma = require('../config/prisma');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { toPublicUser } = require('../controllers/auth.controller');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = (req.query.search || '').trim();

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        ...(search
          ? {
              OR: [
                { username: { contains: search } },
                { displayName: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarColor: true,
        lastSeenAt: true,
      },
      orderBy: { displayName: 'asc' },
      take: 50,
    });

    res.json({ users: users.map(toPublicUser) });
  })
);

module.exports = router;
