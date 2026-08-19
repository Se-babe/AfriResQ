const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { hashPassword } = require('../services/auth');

// Creates exactly one real admin account from env vars, so production
// deployments don't have to run the demo seed (with its public passwords)
// just to get a first coordinator/admin login. No-ops if the vars are
// unset (local dev) or the account already exists (repeat deploys).
function bootstrapAdmin() {
  const { ADMIN_NAME, ADMIN_PHONE, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_PHONE || !ADMIN_PASSWORD) {
    console.log('Skipping admin bootstrap: ADMIN_PHONE / ADMIN_PASSWORD not set.');
    return;
  }
  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(ADMIN_PHONE);
  if (existing) {
    console.log(`Admin bootstrap: ${ADMIN_PHONE} already exists, leaving it as-is.`);
    return;
  }
  const id = uuidv4();
  db.prepare(
    `INSERT INTO users (id, name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?, 'admin')`
  ).run(id, ADMIN_NAME || 'Admin', ADMIN_PHONE, ADMIN_EMAIL || null, hashPassword(ADMIN_PASSWORD));
  console.log(`Admin bootstrap: created admin account for ${ADMIN_PHONE}.`);
}

if (require.main === module) {
  bootstrapAdmin();
}

module.exports = { bootstrapAdmin };
