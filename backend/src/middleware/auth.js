const { verifyToken } = require('../services/auth');
const db = require('../db/db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });

  try {
    const payload = verifyToken(token);
    const user = db.prepare('SELECT id, name, phone, email, role, is_active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.is_active) return res.status(401).json({ error: 'Account not found or deactivated' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional auth: attaches req.user if a valid token is present, but does not reject otherwise.
// Used for public/anonymous emergency reporting where we still want to link a reporter if logged in.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = db.prepare('SELECT id, name, phone, email, role, is_active FROM users WHERE id = ?').get(payload.sub);
    if (user && user.is_active) req.user = user;
  } catch (_) {
    /* ignore invalid token in optional mode */
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires one of roles: ${roles.join(', ')}` });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
