const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { signToken } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const SALT_ROUNDS = 12;

// Never leak passwordHash through an API response.
const toPublicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  avatarColor: user.avatarColor,
  lastSeenAt: user.lastSeenAt,
});

const register = asyncHandler(async (req, res) => {
  const { username, email, password, displayName } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { username }] },
    select: { email: true, username: true },
  });

  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'email' : 'username';
    throw ApiError.conflict(`That ${field} is already registered`, { field });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username,
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || username,
    },
  });

  res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
});

const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
    },
  });

  // Same message and comparable work for both branches so the response cannot
  // be used to enumerate which accounts exist.
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu');

  if (!user || !passwordMatches) {
    throw ApiError.unauthorized('Incorrect username/email or password');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  res.json({ token: signToken(user), user: toPublicUser(user) });
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw ApiError.notFound('User no longer exists');
  res.json({ user: toPublicUser(user) });
});

module.exports = { register, login, me, toPublicUser };
