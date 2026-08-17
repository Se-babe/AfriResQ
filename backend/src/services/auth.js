const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

const DEFAULT_SECRET = 'dev-secret-change-me-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

// Fail fast rather than silently running a "real" deployment with a
// guessable secret — this must be checked wherever the process boots
// (server.js), not just here, so tests and scripts still work.
function isDefaultSecret() {
  return JWT_SECRET === DEFAULT_SECRET;
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a new opaque refresh token for a user and persists only its hash
 * (see db.js schema comment). Returns the raw token — this is the only
 * moment the raw value exists; callers must return it to the client and
 * never log it.
 */
function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`).run(
    hashRefreshToken(raw),
    userId,
    expiresAt
  );
  return raw;
}

/**
 * Validates a raw refresh token against the store. Returns the user row on
 * success, or null if the token is missing, unknown, or expired (expired
 * rows are opportunistically cleaned up).
 */
function consumeRefreshToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const hashed = hashRefreshToken(rawToken);
  const row = db.prepare(`SELECT * FROM refresh_tokens WHERE token = ?`).get(hashed);
  if (!row) return null;

  // Always revoke the presented token — rotation on every use limits the
  // blast radius of a stolen refresh token to a single use.
  db.prepare(`DELETE FROM refresh_tokens WHERE token = ?`).run(hashed);

  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user || !user.is_active) return null;
  return user;
}

function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  db.prepare(`DELETE FROM refresh_tokens WHERE token = ?`).run(hashRefreshToken(rawToken));
}

function revokeAllRefreshTokens(userId) {
  db.prepare(`DELETE FROM refresh_tokens WHERE user_id = ?`).run(userId);
}

/**
 * Issues a fresh access token + refresh token pair for a logged-in user.
 */
function issueSession(user) {
  return {
    token: signToken(user),
    refreshToken: issueRefreshToken(user.id),
  };
}

// --- Login brute-force protection -----------------------------------
// Deliberately in-memory: this is a pilot-scale single-process deployment
// (SQLite, one server instance), so a process-local map is enough to stop
// naive credential-stuffing without adding infra. It resets on restart,
// which is an accepted tradeoff — document it if this ever runs behind a
// load balancer with multiple instances (would need a shared store then).
const FAILED_LOGIN_LIMIT = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedLogins = new Map(); // phone -> { count, firstAt, lockedUntil }

function isLockedOut(phone) {
  const entry = failedLogins.get(phone);
  if (!entry || !entry.lockedUntil) return false;
  if (entry.lockedUntil > Date.now()) return true;
  failedLogins.delete(phone);
  return false;
}

function lockoutRemainingMs(phone) {
  const entry = failedLogins.get(phone);
  if (!entry || !entry.lockedUntil) return 0;
  return Math.max(0, entry.lockedUntil - Date.now());
}

function recordFailedLogin(phone) {
  const entry = failedLogins.get(phone) || { count: 0, firstAt: Date.now() };
  entry.count += 1;
  if (entry.count >= FAILED_LOGIN_LIMIT) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  failedLogins.set(phone, entry);
}

function clearFailedLogins(phone) {
  failedLogins.delete(phone);
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  issueSession,
  issueRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  isDefaultSecret,
  isLockedOut,
  lockoutRemainingMs,
  recordFailedLogin,
  clearFailedLogins,
  JWT_SECRET,
};
