const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Use an isolated test database, separate from pipeline.test.js's — node's
// test runner runs each file in its own process, but keep this explicit.
const TEST_DATA_DIR = path.join(__dirname, '.tmp-data-api');
if (fs.existsSync(TEST_DATA_DIR)) fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.JWT_SECRET = 'test-secret-api';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const { app } = require('../src/server');
const db = require('../src/db/db');
const { hashPassword, signToken } = require('../src/services/auth');

function makeUser({ name, phone, role, password = 'Password123!' }) {
  const id = uuidv4();
  db.prepare(`INSERT INTO users (id, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    name,
    phone,
    hashPassword(password),
    role
  );
  return { id, name, phone, role };
}

test('GET /api/health reports ok with a reachable db', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.strictEqual(res.body.db, 'ok');
});

test('register issues an access token and a refresh token', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test Citizen', phone: '+256711000001', password: 'Password123!', role: 'citizen' });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.token, 'expected an access token');
  assert.ok(res.body.refreshToken, 'expected a refresh token');
  assert.strictEqual(res.body.user.role, 'citizen');
});

test('duplicate phone number is rejected on register', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'First', phone: '+256711000002', password: 'Password123!', role: 'citizen' });
  const dup = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Second', phone: '+256711000002', password: 'Password123!', role: 'citizen' });
  assert.strictEqual(dup.status, 409);
});

test('login: wrong password fails repeatedly, then the account is locked out', async () => {
  makeUser({ name: 'Locky', phone: '+256711000003', role: 'citizen', password: 'CorrectPass123!' });

  for (let i = 0; i < 5; i += 1) {
    const res = await request(app).post('/api/auth/login').send({ phone: '+256711000003', password: 'wrong-password' });
    assert.strictEqual(res.status, 401, `attempt ${i + 1} should be a plain auth failure`);
  }

  const lockedOut = await request(app)
    .post('/api/auth/login')
    .send({ phone: '+256711000003', password: 'CorrectPass123!' }); // even the right password is refused while locked
  assert.strictEqual(lockedOut.status, 429);
});

test('refresh token rotates on use and cannot be replayed', async () => {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Refresh Test', phone: '+256711000004', password: 'Password123!', role: 'citizen' });
  const { refreshToken } = reg.body;

  const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
  assert.strictEqual(refreshed.status, 200);
  assert.ok(refreshed.body.token);
  assert.notStrictEqual(refreshed.body.refreshToken, refreshToken, 'refresh token must rotate');

  const replay = await request(app).post('/api/auth/refresh').send({ refreshToken });
  assert.strictEqual(replay.status, 401, 'a spent refresh token must not be reusable');
});

test('anonymous emergency report without a reporter phone is rejected', async () => {
  const res = await request(app).post('/api/emergencies').send({ category: 'fire', lat: 0.3, lng: 32.5 });
  assert.strictEqual(res.status, 400);
});

test('full case lifecycle: report -> classify -> match -> accept -> resolve, with audit trail', async () => {
  const responder = makeUser({ name: 'Nearby Medic', phone: '+256711000010', role: 'responder' });
  db.prepare(
    `INSERT INTO responder_profiles (user_id, skills, verification_status, availability_status, current_lat, current_lng)
     VALUES (?, ?, 'verified', 'available', ?, ?)`
  ).run(responder.id, JSON.stringify(['medical']), 0.3476, 32.5825);
  const responderToken = signToken(responder);

  const coordinator = makeUser({ name: 'Coord', phone: '+256711000011', role: 'coordinator' });
  const coordinatorToken = signToken(coordinator);

  const report = await request(app).post('/api/emergencies').send({
    category: 'medical',
    description: 'unconscious, not breathing',
    lat: 0.3476,
    lng: 32.5825,
    reporterPhone: '+256711000099',
  });
  assert.strictEqual(report.status, 201);
  assert.strictEqual(report.body.classification.severity, 'critical');
  assert.strictEqual(report.body.matching.candidates.length, 1);
  const emergencyId = report.body.emergency.id;

  const accept = await request(app)
    .post(`/api/emergencies/${emergencyId}/accept`)
    .set('Authorization', `Bearer ${responderToken}`);
  assert.strictEqual(accept.status, 200);
  assert.strictEqual(accept.body.emergency.status, 'accepted');

  const inProgress = await request(app)
    .post(`/api/emergencies/${emergencyId}/status`)
    .set('Authorization', `Bearer ${responderToken}`)
    .send({ status: 'in_progress' });
  assert.strictEqual(inProgress.status, 200);

  const resolved = await request(app)
    .post(`/api/emergencies/${emergencyId}/status`)
    .set('Authorization', `Bearer ${responderToken}`)
    .send({ status: 'resolved' });
  assert.strictEqual(resolved.status, 200);
  assert.strictEqual(resolved.body.emergency.status, 'resolved');

  const detail = await request(app)
    .get(`/api/emergencies/${emergencyId}`)
    .set('Authorization', `Bearer ${coordinatorToken}`);
  assert.strictEqual(detail.status, 200);
  assert.ok(detail.body.events.length >= 4, 'expected reported/classified/.../resolved events');
});

test('a pending (unverified) responder is not matched, but shows in the verification queue', async () => {
  // Far from every other test's coordinates (>50km, past the widest search
  // radius) so this test's matching result isn't polluted by responders
  // other tests seeded into this same shared test database.
  const FAR_LAT = 1.6;
  const FAR_LNG = 33.6;

  const pending = makeUser({ name: 'Pending Medic', phone: '+256711000020', role: 'responder' });
  db.prepare(
    `INSERT INTO responder_profiles (user_id, skills, verification_status, availability_status, current_lat, current_lng)
     VALUES (?, ?, 'pending', 'available', ?, ?)`
  ).run(pending.id, JSON.stringify(['fire']), FAR_LAT, FAR_LNG);

  const coordinator = makeUser({ name: 'Coord2', phone: '+256711000021', role: 'coordinator' });
  const coordinatorToken = signToken(coordinator);

  const queue = await request(app).get('/api/responders/pending').set('Authorization', `Bearer ${coordinatorToken}`);
  assert.strictEqual(queue.status, 200);
  assert.ok(queue.body.some((r) => r.id === pending.id));

  const report = await request(app)
    .post('/api/emergencies')
    .send({ category: 'fire', lat: FAR_LAT, lng: FAR_LNG, reporterPhone: '+256711000098' });
  assert.strictEqual(report.body.matching.candidates.length, 0, 'unverified responders must not be matched');

  const verify = await request(app)
    .post(`/api/responders/${pending.id}/verify`)
    .set('Authorization', `Bearer ${coordinatorToken}`)
    .send({ status: 'verified' });
  assert.strictEqual(verify.status, 200);
});

test('push: vapid key endpoint 404s when unconfigured; subscribe payload is validated', async () => {
  const user = makeUser({ name: 'Push User', phone: '+256711000030', role: 'citizen' });
  const token = signToken(user);

  const vapid = await request(app).get('/api/notifications/vapid-public-key');
  assert.strictEqual(vapid.status, 404); // no VAPID_* env vars configured in tests

  const badSubscription = await request(app)
    .post('/api/notifications/subscribe')
    .set('Authorization', `Bearer ${token}`)
    .send({ endpoint: 'not-a-url' });
  assert.strictEqual(badSubscription.status, 400);
});

test('unauthenticated requests to protected routes are rejected', async () => {
  const res = await request(app).get('/api/emergencies');
  assert.strictEqual(res.status, 401);
});

test('voice note attach + retrieve, live responder distance/ETA, and post-resolve rating', async () => {
  const citizen = makeUser({ name: 'Voice Reporter', phone: '+256711000040', role: 'citizen' });
  const citizenToken = signToken(citizen);

  const responder = makeUser({ name: 'Tracked Medic', phone: '+256711000041', role: 'responder' });
  db.prepare(
    `INSERT INTO responder_profiles (user_id, skills, verification_status, availability_status, current_lat, current_lng)
     VALUES (?, ?, 'verified', 'available', ?, ?)`
  ).run(responder.id, JSON.stringify(['medical']), 0.35, 32.59); // ~3km from the report
  const responderToken = signToken(responder);

  const audioBase64 = Buffer.from('fake-audio-bytes').toString('base64');
  const report = await request(app)
    .post('/api/emergencies')
    .set('Authorization', `Bearer ${citizenToken}`)
    .send({
      category: 'medical',
      lat: 0.3476,
      lng: 32.5825,
      voiceNote: { audioBase64, mimeType: 'audio/m4a', durationSeconds: 12 },
    });
  assert.strictEqual(report.status, 201);
  const emergencyId = report.body.emergency.id;

  const detailAfterReport = await request(app)
    .get(`/api/emergencies/${emergencyId}`)
    .set('Authorization', `Bearer ${citizenToken}`);
  assert.strictEqual(detailAfterReport.body.emergency.hasVoiceNote, true);

  const voiceNote = await request(app)
    .get(`/api/emergencies/${emergencyId}/voice-note`)
    .set('Authorization', `Bearer ${citizenToken}`);
  assert.strictEqual(voiceNote.status, 200);
  assert.strictEqual(voiceNote.body.audioBase64, audioBase64);
  assert.strictEqual(voiceNote.body.mimeType, 'audio/m4a');

  await request(app).post(`/api/emergencies/${emergencyId}/accept`).set('Authorization', `Bearer ${responderToken}`);

  const detailAfterAccept = await request(app)
    .get(`/api/emergencies/${emergencyId}`)
    .set('Authorization', `Bearer ${citizenToken}`);
  assert.ok(detailAfterAccept.body.assignedResponder.distance_km > 0);
  assert.ok(detailAfterAccept.body.assignedResponder.eta_minutes >= 1);

  // Responder moves closer; broadcast happens but we only assert the polled state here.
  await request(app)
    .patch('/api/responders/me/location')
    .set('Authorization', `Bearer ${responderToken}`)
    .send({ lat: 0.348, lng: 32.583 });
  const detailAfterMove = await request(app)
    .get(`/api/emergencies/${emergencyId}`)
    .set('Authorization', `Bearer ${citizenToken}`);
  assert.ok(detailAfterMove.body.assignedResponder.distance_km < detailAfterAccept.body.assignedResponder.distance_km);

  // Rating is rejected before resolution.
  const tooEarly = await request(app)
    .post(`/api/emergencies/${emergencyId}/rating`)
    .set('Authorization', `Bearer ${citizenToken}`)
    .send({ stars: 5 });
  assert.strictEqual(tooEarly.status, 409);

  await request(app).post(`/api/emergencies/${emergencyId}/status`).set('Authorization', `Bearer ${responderToken}`).send({ status: 'in_progress' });
  await request(app).post(`/api/emergencies/${emergencyId}/status`).set('Authorization', `Bearer ${responderToken}`).send({ status: 'resolved' });

  const rating = await request(app)
    .post(`/api/emergencies/${emergencyId}/rating`)
    .set('Authorization', `Bearer ${citizenToken}`)
    .send({ stars: 4, comment: 'Quick response' });
  assert.strictEqual(rating.status, 201);

  const duplicateRating = await request(app)
    .post(`/api/emergencies/${emergencyId}/rating`)
    .set('Authorization', `Bearer ${citizenToken}`)
    .send({ stars: 3 });
  assert.strictEqual(duplicateRating.status, 409);

  const profile = db.prepare('SELECT rating_avg, rating_count FROM responder_profiles WHERE user_id = ?').get(responder.id);
  assert.strictEqual(profile.rating_count, 1);
  assert.strictEqual(profile.rating_avg, 4);
});
