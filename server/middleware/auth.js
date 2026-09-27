const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

/**
 * Verifies the Bearer token and populates req.user.
 * req.user is deliberately minimal - never trust client claims for authorisation.
 */
const verifyToken = (token) => {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Session expired, please log in again');
    }
    throw ApiError.unauthorized('Invalid authentication token');
  }
  return { id: payload.sub, username: payload.username };
};

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing Bearer token'));
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { signToken, verifyToken, requireAuth };
