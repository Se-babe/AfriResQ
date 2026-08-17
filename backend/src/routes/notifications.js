const express = require('express');
const { z } = require('zod');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { getVapidPublicKey, saveSubscription, removeSubscription } = require('../services/providers/push');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(req.user.id);
  res.json(rows);
});

// Public: the frontend needs this to call PushManager.subscribe(). Not a
// secret — VAPID public keys are meant to be exposed to clients.
router.get('/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) return res.status(404).json({ error: 'Push notifications are not configured on this server' });
  res.json({ publicKey });
});

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

router.post('/subscribe', requireAuth, (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    saveSubscription(req.user.id, parsed.data);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

router.post('/unsubscribe', requireAuth, (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  removeSubscription(parsed.data.endpoint);
  res.json({ ok: true });
});

module.exports = router;
