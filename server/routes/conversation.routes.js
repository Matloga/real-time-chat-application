const express = require('express');
const { list, startDirect, messages, markRead } = require('../controllers/conversation.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', list);
router.post('/direct', startDirect);
router.get('/:id/messages', messages);
router.post('/:id/read', markRead);

module.exports = router;
