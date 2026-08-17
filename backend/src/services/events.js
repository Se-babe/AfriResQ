const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');

function logEvent(emergencyId, eventType, actorId, details) {
  db.prepare(
    `INSERT INTO emergency_events (id, emergency_id, event_type, actor_id, details) VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), emergencyId, eventType, actorId || null, details ? JSON.stringify(details) : null);
}

module.exports = { logEvent };
