const { z } = require('zod');
const { register, login, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  email: z.string().trim().email('Enter a valid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().trim().min(1).max(64).optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
});

// Turns a ZodError into a 400 whose body is easy for the client to render.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = {};
    for (const issue of result.error.issues) {
      details[issue.path.join('.')] = issue.message;
    }
    return res.status(400).json({ message: 'Validation failed', details });
  }
  req.body = result.data;
  return next();
};

const router = require('express').Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', requireAuth, me);

module.exports = router;
