const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { hashPassword } = require('../services/auth');

function upsertUser({ name, phone, email, password, role }) {
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (user) return user;
  const id = uuidv4();
  db.prepare(
    `INSERT INTO users (id, name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, phone, email, hashPassword(password), role);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// Central Kampala reference point for realistic demo coordinates.
const KAMPALA = { lat: 0.3476, lng: 32.5825 };

function offsetKm(origin, northKm, eastKm) {
  return {
    lat: origin.lat + northKm / 111.32,
    lng: origin.lng + eastKm / (111.32 * Math.cos((origin.lat * Math.PI) / 180)),
  };
}

function seed() {
console.log('Seeding AfriResQ demo data...');

// Organizations
const orgs = [
  { name: 'Mulago National Referral Hospital', type: 'health_facility', lat: 0.3406, lng: 32.5763 },
  { name: 'Kampala Central Police Station', type: 'police', lat: 0.3155, lng: 32.5822 },
  { name: 'Uganda Red Cross - Kampala Branch', type: 'ngo', lat: 0.3312, lng: 32.5701 },
  { name: 'Kampala Capital City Fire Brigade', type: 'fire', lat: 0.3178, lng: 32.5911 },
];
const orgIds = {};
for (const o of orgs) {
  const existing = db.prepare('SELECT id FROM organizations WHERE name = ?').get(o.name);
  if (existing) {
    orgIds[o.name] = existing.id;
    continue;
  }
  const id = uuidv4();
  db.prepare(
    `INSERT INTO organizations (id, name, type, lat, lng, verified) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(id, o.name, o.type, o.lat, o.lng);
  orgIds[o.name] = id;
}

// Admin + coordinator
const admin = upsertUser({ name: 'System Admin', phone: '+256700000001', email: 'admin@afriresq.org', password: 'AdminPass123!', role: 'admin' });
const coordinator = upsertUser({
  name: 'Grace Nakato (Coordinator)',
  phone: '+256700000002',
  email: 'coordinator@afriresq.org',
  password: 'CoordPass123!',
  role: 'coordinator',
});

// Responders with varied skills, all verified & available near Kampala for demo purposes
const responderDefs = [
  { name: 'Okello Peter', phone: '+256700000010', skills: ['medical', 'first_aid'], org: 'Mulago National Referral Hospital', north: 0.4, east: 0.2 },
  { name: 'Namuli Sarah', phone: '+256700000011', skills: ['medical', 'paramedic'], org: 'Uganda Red Cross - Kampala Branch', north: 1.1, east: -0.6 },
  { name: 'Ssebunya John', phone: '+256700000012', skills: ['fire', 'rescue'], org: 'Kampala Capital City Fire Brigade', north: -1.8, east: 1.4 },
  { name: 'Amina Nabirye', phone: '+256700000013', skills: ['security', 'police'], org: 'Kampala Central Police Station', north: -2.4, east: 0.1 },
  { name: 'Kato Emmanuel', phone: '+256700000014', skills: ['community_volunteer', 'first_aid'], org: null, north: 1.6, east: 1.2 },
  { name: 'Nabakooza Ritah', phone: '+256700000015', skills: ['search_rescue', 'community_volunteer'], org: null, north: -2.0, east: -1.8 },
];

for (const r of responderDefs) {
  const user = upsertUser({ name: r.name, phone: r.phone, email: null, password: 'ResponderPass123!', role: 'responder' });
  const pos = offsetKm(KAMPALA, r.north, r.east);
  const existingProfile = db.prepare('SELECT user_id FROM responder_profiles WHERE user_id = ?').get(user.id);
  if (existingProfile) {
    db.prepare(
      `UPDATE responder_profiles
       SET organization_id = ?, skills = ?, verification_status = 'verified', availability_status = 'available',
           current_lat = ?, current_lng = ?, last_location_at = datetime('now')
       WHERE user_id = ?`
    ).run(r.org ? orgIds[r.org] : null, JSON.stringify(r.skills), pos.lat, pos.lng, user.id);
    continue;
  }
  db.prepare(
    `INSERT INTO responder_profiles
       (user_id, organization_id, skills, verification_status, availability_status, current_lat, current_lng, last_location_at)
     VALUES (?, ?, ?, 'verified', 'available', ?, ?, datetime('now'))`
  ).run(user.id, r.org ? orgIds[r.org] : null, JSON.stringify(r.skills), pos.lat, pos.lng);
}

// Sample citizen
const citizen = upsertUser({ name: 'Demo Citizen', phone: '+256700000099', email: 'citizen@example.com', password: 'CitizenPass123!', role: 'citizen' });

const medic = db.prepare('SELECT id FROM users WHERE phone = ?').get('+256700000010');
const existingSample = db.prepare(`SELECT id FROM emergencies WHERE description = ?`).get('Demo: pedestrian struck near Nakasero market, bleeding controlled.');
if (medic && citizen && !existingSample) {
  const eid = uuidv4();
  db.prepare(
    `INSERT INTO emergencies (id, reporter_id, reporter_phone, category, description, severity, priority_score, status, lat, lng, address_text, channel, assigned_responder_id, first_notified_at, accepted_at, resolved_at)
     VALUES (?, ?, ?, 'road_accident', ?, 'high', 75, 'resolved', 0.3472, 32.5820, 'Nakasero Market', 'web', ?, datetime('now','-2 hours'), datetime('now','-1 hours','-50 minutes'), datetime('now','-1 hours'))`
  ).run(eid, citizen.id, citizen.phone, 'Demo: pedestrian struck near Nakasero market, bleeding controlled.', medic.id);
}

console.log('Seed complete.');
console.log('Demo logins:');
console.log('  Admin:       +256700000001 / AdminPass123!');
console.log('  Coordinator: +256700000002 / CoordPass123!');
console.log('  Citizen:     +256700000099 / CitizenPass123!');
console.log('  Responders:  +256700000010..15 / ResponderPass123!');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
