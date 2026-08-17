const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const db = require('../db/db');
const {
  hashPassword,
  verifyPassword,
  issueSession,
  consumeRefreshToken,
  revokeRefreshToken,
  isLockedOut,
  lockoutRemainingMs,
  recordFailedLogin,
  clearFailedLogins,
} = require('../services/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['citizen', 'responder']).default('citizen'), // coordinator/admin created by admin only
  preferredLanguage: z.string().optional(),
  // responder-only optional fields
  skills: z.array(z.string()).optional(),
  organizationId: z.string().optional(),
});

router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, phone, email, password, role, preferredLanguage, skills, organizationId } = parsed.data;

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) return res.status(409).json({ error: 'A user with this phone number already exists' });

  const id = uuidv4();
  db.prepare(
    `INSERT INTO users (id, name, phone, email, password_hash, role, preferred_language)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, phone, email || null, hashPassword(password), role, preferredLanguage || 'en');

  if (role === 'responder') {
    db.prepare(
      `INSERT INTO responder_profiles (user_id, organization_id, skills, verification_status) VALUES (?, ?, ?, 'pending')`
    ).run(id, organizationId || null, JSON.stringify(skills || []));
  }

  const user = { id, name, role };
  const { token, refreshToken } = issueSession(user);
  res.status(201).json({
    token,
    refreshToken,
    user: { id, name, phone, email, role },
    note:
      role === 'responder'
        ? 'Registered as responder. Your account requires verification by a coordinator before you can be matched to emergencies.'
        : undefined,
  });
});

const loginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(1),
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { phone, password } = parsed.data;

  if (isLockedOut(phone)) {
    const minutes = Math.ceil(lockoutRemainingMs(phone) / 60000);
    return res.status(429).json({ error: `Too many failed attempts. Try again in about ${minutes} minute(s).` });
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    recordFailedLogin(phone);
    return res.status(401).json({ error: 'Invalid phone number or password' });
  }

  clearFailedLogins(phone);
  const { token, refreshToken } = issueSession(user);
  res.json({ token, refreshToken, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role } });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

// Exchanges a still-valid refresh token for a new short-lived access token
// (and rotates the refresh token itself, single-use). Lets the frontend
// keep a session alive across the access token's short expiry without
// forcing the user to re-enter their password.
router.post('/refresh', (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = consumeRefreshToken(parsed.data.refreshToken);
  if (!user) return res.status(401).json({ error: 'Refresh token is invalid or expired' });

  const { token, refreshToken } = issueSession(user);
  res.json({ token, refreshToken, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role } });
});

// Best-effort revocation; the frontend should discard local tokens
// regardless of whether this succeeds.
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) revokeRefreshToken(refreshToken);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  let profile = null;
  if (req.user.role === 'responder') {
    profile = db.prepare('SELECT * FROM responder_profiles WHERE user_id = ?').get(req.user.id);
    if (profile) profile.skills = JSON.parse(profile.skills || '[]');
  }
  res.json({ user: req.user, responderProfile: profile });
});

module.exports = router;
