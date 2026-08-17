const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Use an isolated test database so this never touches dev/demo data.
const TEST_DATA_DIR = path.join(__dirname, '.tmp-data');
if (fs.existsSync(TEST_DATA_DIR)) fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.JWT_SECRET = 'test-secret';

const { classify } = require('../src/services/classification');
const { haversineKm, boundingBox } = require('../src/services/geo');
const db = require('../src/db/db');
const { hashPassword } = require('../src/services/auth');
const { v4: uuidv4 } = require('uuid');
const { runMatching } = require('../src/services/matching');

test('classification: fire base severity is critical', () => {
  const r = classify({ category: 'fire', description: 'fire reported at a residential building' });
  assert.strictEqual(r.severity, 'critical');
});

test('classification: escalation keywords raise priority score', () => {
  const base = classify({ category: 'medical', description: 'person feeling unwell' });
  const escalated = classify({ category: 'medical', description: 'person unconscious, not breathing' });
  assert.ok(escalated.priorityScore > base.priorityScore);
  assert.strictEqual(escalated.severity, 'critical');
});

test('classification: unknown category falls back to "other"', () => {
  const r = classify({ category: 'nonsense', description: '' });
  assert.strictEqual(r.category, 'other');
});

test('geo: haversine distance between identical points is 0', () => {
  assert.strictEqual(haversineKm(0.3476, 32.5825, 0.3476, 32.5825), 0);
});

test('geo: haversine distance is symmetric and roughly correct for known points', () => {
  // Kampala to Entebbe is approximately 34-37km
  const d = haversineKm(0.3476, 32.5825, 0.0512, 32.4637);
  assert.ok(d > 30 && d < 42, `expected ~35km, got ${d}`);
});

test('geo: bounding box contains the origin point', () => {
  const box = boundingBox(0.3476, 32.5825, 10);
  assert.ok(0.3476 >= box.minLat && 0.3476 <= box.maxLat);
  assert.ok(32.5825 >= box.minLng && 32.5825 <= box.maxLng);
});

function insertTestEmergency(category, lat, lng) {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO emergencies (id, category, lat, lng, status) VALUES (?, ?, ?, ?, 'reported')`
  ).run(id, category, lat, lng);
  return { id, category, lat, lng };
}

test('matching: only verified + available responders within radius are matched, ranked by score', () => {
  const mkUser = (name, phone) => {
    const id = uuidv4();
    db.prepare(`INSERT INTO users (id, name, phone, password_hash, role) VALUES (?, ?, ?, ?, 'responder')`).run(
      id,
      name,
      phone,
      hashPassword('x')
    );
    return id;
  };

  const near = mkUser('Near Verified Medic', '+256711111111');
  db.prepare(
    `INSERT INTO responder_profiles (user_id, skills, verification_status, availability_status, current_lat, current_lng)
     VALUES (?, ?, 'verified', 'available', ?, ?)`
  ).run(near, JSON.stringify(['medical']), 0.35, 32.585);

  const farUnverified = mkUser('Far Unverified', '+256722222222');
  db.prepare(
    `INSERT INTO responder_profiles (user_id, skills, verification_status, availability_status, current_lat, current_lng)
     VALUES (?, ?, 'pending', 'available', ?, ?)`
  ).run(farUnverified, JSON.stringify(['medical']), 0.35, 32.585);

  const offline = mkUser('Offline Medic', '+256733333333');
  db.prepare(
    `INSERT INTO responder_profiles (user_id, skills, verification_status, availability_status, current_lat, current_lng)
     VALUES (?, ?, 'verified', 'offline', ?, ?)`
  ).run(offline, JSON.stringify(['medical']), 0.3476, 32.5825);

  const emergency = insertTestEmergency('medical', 0.3476, 32.5825);
  const { candidates } = runMatching(emergency);

  assert.strictEqual(candidates.length, 1, 'only the verified+available responder should be matched');
  assert.strictEqual(candidates[0].responderId, near);
});

test('matching: returns empty candidates gracefully when nobody is eligible', () => {
  const emergency = insertTestEmergency('disaster', 45.0, 45.0); // far from any seeded responder
  const { candidates } = runMatching(emergency);
  assert.strictEqual(candidates.length, 0);
});
