const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const db = require('../db/db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { classify } = require('../services/classification');
const { runMatching } = require('../services/matching');
const { notifyUser, broadcastEvent } = require('../services/notification');
const { logEvent } = require('../services/events');
const { haversineKm } = require('../services/geo');

// Rough average travel speed used to turn a distance into an ETA for the
// reporter's "responder is N min away" indicator — not routed/traffic-aware,
// just a friendly estimate for boda-boda/car mixed urban traffic.
const ASSUMED_RESPONDER_SPEED_KMH = 25;

// Encoded (base64) size limit for a voice-note attachment. ~2MB decoded is
// generous for a <=60s recording at typical mobile codec bitrates.
const MAX_VOICE_NOTE_BASE64_CHARS = 2_800_000;

const router = express.Router();

const VALID_STATUS_TRANSITIONS = {
  reported: ['classified', 'cancelled'],
  classified: ['matching', 'cancelled'],
  matching: ['matched', 'cancelled'],
  matched: ['notified', 'cancelled'],
  notified: ['accepted', 'matching', 'cancelled'], // matching again = re-match if nobody accepts
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['resolved', 'cancelled'],
  resolved: ['closed'],
  closed: [],
  cancelled: [],
};

function setStatus(emergencyId, newStatus, actorId, details) {
  db.prepare(`UPDATE emergencies SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(newStatus, emergencyId);
  logEvent(emergencyId, 'status_changed', actorId, { status: newStatus, ...details });
}

const reportSchema = z.object({
  category: z.enum(['medical', 'road_accident', 'fire', 'security', 'missing_person', 'disaster', 'other']),
  description: z.string().max(2000).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  addressText: z.string().optional(),
  locationAccuracyM: z.number().optional(),
  channel: z.enum(['app', 'ussd', 'sms', 'web']).default('app'),
  reporterPhone: z.string().optional(), // used when reporting anonymously / via USSD
  voiceNote: z
    .object({
      audioBase64: z.string().max(MAX_VOICE_NOTE_BASE64_CHARS, 'Voice note is too large'),
      mimeType: z.string(),
      durationSeconds: z.number().optional(),
    })
    .optional(),
});

/**
 * Core pipeline: Report -> Classify -> Find Resources/Match -> Notify.
 * This single endpoint implements SRS Section 4 steps 1-6 synchronously so
 * the reporter gets an immediate, actionable response (matched responder
 * count + ETA-relevant distance), while a full audit trail is written at
 * every step for Section 8 (Evaluate).
 */
router.post('/', optionalAuth, async (req, res, next) => {
 try {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  if (!req.user && !data.reporterPhone) {
    return res.status(400).json({ error: 'reporterPhone is required for anonymous reports' });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO emergencies (id, reporter_id, reporter_phone, category, description, lat, lng, address_text, location_accuracy_m, channel, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reported')`
  ).run(
    id,
    req.user ? req.user.id : null,
    req.user ? req.user.phone : data.reporterPhone,
    data.category,
    data.description || null,
    data.lat,
    data.lng,
    data.addressText || null,
    data.locationAccuracyM || null,
    data.channel
  );
  logEvent(id, 'reported', req.user ? req.user.id : null, { category: data.category, channel: data.channel });

  if (data.voiceNote) {
    db.prepare(
      `INSERT INTO emergency_attachments (id, emergency_id, kind, mime_type, data, duration_seconds, uploaded_by)
       VALUES (?, ?, 'voice_note', ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      id,
      data.voiceNote.mimeType,
      Buffer.from(data.voiceNote.audioBase64, 'base64'),
      data.voiceNote.durationSeconds || null,
      req.user ? req.user.id : null
    );
    logEvent(id, 'voice_note_attached', req.user ? req.user.id : null, {});
  }

  // 1. Classify
  const result = classify({ category: data.category, description: data.description });
  db.prepare(`UPDATE emergencies SET severity = ?, priority_score = ? WHERE id = ?`).run(
    result.severity,
    result.priorityScore,
    id
  );
  setStatus(id, 'classified', null, { severity: result.severity, priorityScore: result.priorityScore, reasons: result.reasons });

  // 2. Match
  setStatus(id, 'matching', null, {});
  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(id);
  const { candidates, searchRadiusKm } = runMatching(emergency);

  if (candidates.length === 0) {
    logEvent(id, 'no_candidates_found', null, { searchRadiusKm });
    const fresh = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(id);
    broadcastEvent({ type: 'emergency_created', emergency: fresh, candidateCount: 0, needsEscalation: true });
    return res.status(201).json({
      emergency: fresh,
      classification: { severity: result.severity, priorityScore: result.priorityScore, reasons: result.reasons },
      matching: { candidates: [], searchRadiusKm, warning: 'No available verified responders found nearby. A coordinator has been flagged to escalate.' },
    });
  }
  setStatus(id, 'matched', null, { candidateCount: candidates.length, searchRadiusKm });

  // 3. Notify top candidates. High/critical cases also go out over SMS in
  // parallel with push — a real dual-channel alert, since a responder's
  // phone may have no connectivity for push but SMS still reaches it.
  setStatus(id, 'notified', null, {});
  db.prepare(`UPDATE emergencies SET first_notified_at = datetime('now') WHERE id = ?`).run(id);
  const categoryLabel = data.category.replace('_', ' ');
  const urgent = ['high', 'critical'].includes(result.severity);
  for (const c of candidates) {
    const message = `AfriResQ ALERT: ${result.severity.toUpperCase()} priority ${categoryLabel} reported ${c.distanceKm}km from you${
      data.addressText ? ` near ${data.addressText}` : ''
    }. Open the app to view details and accept.`;
    await notifyUser({ userId: c.responderId, emergencyId: id, channel: 'push', message });
    if (urgent) await notifyUser({ userId: c.responderId, emergencyId: id, channel: 'sms', message });
    db.prepare(`UPDATE matches SET status = 'notified' WHERE emergency_id = ? AND responder_id = ?`).run(id, c.responderId);
  }
  logEvent(id, 'notified', null, { notifiedResponderIds: candidates.map((c) => c.responderId) });

  const fresh = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(id);
  broadcastEvent({ type: 'emergency_created', emergency: fresh, candidateCount: candidates.length });
  res.status(201).json({
    emergency: fresh,
    classification: { severity: result.severity, priorityScore: result.priorityScore, reasons: result.reasons },
    matching: { candidates, searchRadiusKm },
  });
 } catch (err) {
   next(err);
 }
});

// Coordinator/admin dashboard listing, with filters.
router.get('/', requireAuth, requireRole('coordinator', 'admin'), (req, res) => {
  const { status, category, severity, limit = 50 } = req.query;
  let sql = `SELECT e.*, u.name as assigned_responder_name
             FROM emergencies e
             LEFT JOIN users u ON u.id = e.assigned_responder_id
             WHERE 1=1`;
  const params = [];
  if (status) {
    sql += ' AND e.status = ?';
    params.push(status);
  }
  if (category) {
    sql += ' AND e.category = ?';
    params.push(category);
  }
  if (severity) {
    sql += ' AND e.severity = ?';
    params.push(severity);
  }
  sql += ' ORDER BY e.priority_score DESC, e.created_at DESC LIMIT ?';
  params.push(Number(limit));
  res.json(db.prepare(sql).all(...params));
});

// Citizen's own reports.
router.get('/reported', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT e.*, u.name as assigned_responder_name
       FROM emergencies e
       LEFT JOIN users u ON u.id = e.assigned_responder_id
       WHERE e.reporter_id = ?
       ORDER BY e.created_at DESC LIMIT 100`
    )
    .all(req.user.id);
  res.json(rows);
});

// A responder's own notified/assigned cases.
router.get('/mine', requireAuth, requireRole('responder'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT e.*, m.status as match_status, m.distance_km, m.rank
       FROM matches m JOIN emergencies e ON e.id = m.emergency_id
       WHERE m.responder_id = ? AND e.status NOT IN ('closed','cancelled')
       ORDER BY e.priority_score DESC, e.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

router.get('/:id', requireAuth, (req, res) => {
  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Emergency not found' });

  const isOwner = emergency.reporter_id === req.user.id;
  const isAssigned = emergency.assigned_responder_id === req.user.id;
  const isPrivileged = ['coordinator', 'admin'].includes(req.user.role);
  const isCandidate = !!db
    .prepare('SELECT 1 FROM matches WHERE emergency_id = ? AND responder_id = ?')
    .get(req.params.id, req.user.id);

  if (!isOwner && !isAssigned && !isPrivileged && !isCandidate) {
    return res.status(403).json({ error: 'Not authorized to view this emergency' });
  }

  const events = db.prepare('SELECT * FROM emergency_events WHERE emergency_id = ? ORDER BY created_at ASC').all(req.params.id);
  const matches = db
    .prepare(
      `SELECT m.*, u.name, u.phone FROM matches m JOIN users u ON u.id = m.responder_id WHERE emergency_id = ? ORDER BY rank ASC`
    )
    .all(req.params.id);
  let assigned = emergency.assigned_responder_id
    ? db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(emergency.assigned_responder_id)
    : null;

  // Live location + a rough ETA for the reporter's "responder is N min away"
  // view. Only shared with people who are already allowed to see this case's
  // sensitive detail (owner/assigned responder/coordinator), not candidates.
  if (assigned && (isOwner || isAssigned || isPrivileged)) {
    const profile = db
      .prepare('SELECT current_lat, current_lng, last_location_at FROM responder_profiles WHERE user_id = ?')
      .get(assigned.id);
    if (profile?.current_lat != null && profile?.current_lng != null) {
      const distanceKm = haversineKm(emergency.lat, emergency.lng, profile.current_lat, profile.current_lng);
      assigned = {
        ...assigned,
        current_lat: profile.current_lat,
        current_lng: profile.current_lng,
        last_location_at: profile.last_location_at,
        distance_km: Math.round(distanceKm * 10) / 10,
        eta_minutes: Math.max(1, Math.round((distanceKm / ASSUMED_RESPONDER_SPEED_KMH) * 60)),
      };
    }
  }

  const hasVoiceNote = !!db
    .prepare(`SELECT 1 FROM emergency_attachments WHERE emergency_id = ? AND kind = 'voice_note'`)
    .get(req.params.id);
  const rating = db
    .prepare('SELECT stars, comment, created_at FROM emergency_ratings WHERE emergency_id = ?')
    .get(req.params.id);

  res.json({
    emergency: { ...emergency, assigned_responder_name: assigned?.name || null, hasVoiceNote },
    events,
    matches: isPrivileged || isOwner ? matches : isCandidate ? matches.filter((m) => m.responder_id === req.user.id) : undefined,
    assignedResponder: assigned,
    rating: rating || null,
  });
});

// Streams the voice-note attachment (if any) as base64 JSON, keeping the
// whole API JSON-only rather than adding a separate binary/multipart path.
router.get('/:id/voice-note', requireAuth, (req, res) => {
  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Emergency not found' });

  const isOwner = emergency.reporter_id === req.user.id;
  const isAssigned = emergency.assigned_responder_id === req.user.id;
  const isPrivileged = ['coordinator', 'admin'].includes(req.user.role);
  const isCandidate = !!db
    .prepare('SELECT 1 FROM matches WHERE emergency_id = ? AND responder_id = ?')
    .get(req.params.id, req.user.id);
  if (!isOwner && !isAssigned && !isPrivileged && !isCandidate) {
    return res.status(403).json({ error: 'Not authorized to view this emergency' });
  }

  const attachment = db
    .prepare(`SELECT mime_type, data, duration_seconds FROM emergency_attachments WHERE emergency_id = ? AND kind = 'voice_note'`)
    .get(req.params.id);
  if (!attachment) return res.status(404).json({ error: 'No voice note on this report' });

  res.json({
    mimeType: attachment.mime_type,
    audioBase64: attachment.data.toString('base64'),
    durationSeconds: attachment.duration_seconds,
  });
});

const ratingSchema = z.object({ stars: z.number().int().min(1).max(5), comment: z.string().max(500).optional() });

// Reporter rates the responder once, after the case is resolved/closed.
router.post('/:id/rating', requireAuth, (req, res) => {
  const parsed = ratingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Emergency not found' });
  if (emergency.reporter_id !== req.user.id) return res.status(403).json({ error: 'Only the reporter can rate this case' });
  if (!['resolved', 'closed'].includes(emergency.status)) {
    return res.status(409).json({ error: 'This case has not been resolved yet' });
  }
  if (!emergency.assigned_responder_id) return res.status(409).json({ error: 'No responder was assigned to this case' });

  const existing = db.prepare('SELECT id FROM emergency_ratings WHERE emergency_id = ?').get(req.params.id);
  if (existing) return res.status(409).json({ error: 'You already rated this case' });

  const { stars, comment } = parsed.data;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO emergency_ratings (id, emergency_id, responder_id, reporter_id, stars, comment)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), req.params.id, emergency.assigned_responder_id, req.user.id, stars, comment || null);
    db.prepare(
      `UPDATE responder_profiles
       SET rating_avg = ((rating_avg * rating_count) + ?) / (rating_count + 1), rating_count = rating_count + 1
       WHERE user_id = ?`
    ).run(stars, emergency.assigned_responder_id);
  });
  tx();

  logEvent(req.params.id, 'rated', req.user.id, { stars });
  res.status(201).json({ ok: true, rating: { stars, comment: comment || null } });
});

// Coordinator re-runs matching if nobody accepted or no candidates were found.
router.post('/:id/rematch', requireAuth, requireRole('coordinator', 'admin'), async (req, res, next) => {
 try {
  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Emergency not found' });
  if (emergency.assigned_responder_id) {
    return res.status(409).json({ error: 'This emergency is already assigned and cannot be rematched' });
  }
  if (['resolved', 'closed', 'cancelled'].includes(emergency.status)) {
    return res.status(409).json({ error: `Cannot rematch a ${emergency.status} emergency` });
  }

  db.prepare(`UPDATE matches SET status = 'expired' WHERE emergency_id = ? AND status IN ('proposed','notified')`).run(req.params.id);
  setStatus(req.params.id, 'matching', req.user.id, { rematch: true });

  const { candidates, searchRadiusKm } = runMatching(emergency);
  if (candidates.length === 0) {
    logEvent(req.params.id, 'no_candidates_found', req.user.id, { searchRadiusKm, rematch: true });
    const fresh = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
    broadcastEvent({ type: 'emergency_status_changed', emergency: fresh, needsEscalation: true });
    return res.json({
      emergency: fresh,
      matching: { candidates: [], searchRadiusKm, warning: 'Still no available verified responders nearby.' },
    });
  }

  setStatus(req.params.id, 'matched', req.user.id, { candidateCount: candidates.length, searchRadiusKm, rematch: true });
  setStatus(req.params.id, 'notified', req.user.id, { rematch: true });
  db.prepare(`UPDATE emergencies SET first_notified_at = COALESCE(first_notified_at, datetime('now')) WHERE id = ?`).run(req.params.id);

  const categoryLabel = emergency.category.replace('_', ' ');
  const urgent = ['high', 'critical'].includes(emergency.severity);
  for (const c of candidates) {
    const message = `AfriResQ ALERT: ${emergency.severity.toUpperCase()} priority ${categoryLabel} reported ${c.distanceKm}km from you${
      emergency.address_text ? ` near ${emergency.address_text}` : ''
    }. Open the app to view details and accept.`;
    await notifyUser({ userId: c.responderId, emergencyId: emergency.id, channel: 'push', message });
    if (urgent) await notifyUser({ userId: c.responderId, emergencyId: emergency.id, channel: 'sms', message });
    db.prepare(`UPDATE matches SET status = 'notified' WHERE emergency_id = ? AND responder_id = ? AND status = 'proposed'`).run(
      emergency.id,
      c.responderId
    );
  }
  logEvent(req.params.id, 'notified', req.user.id, { notifiedResponderIds: candidates.map((c) => c.responderId), rematch: true });

  const fresh = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  broadcastEvent({ type: 'emergency_status_changed', emergency: fresh, candidateCount: candidates.length });
  res.json({ emergency: fresh, matching: { candidates, searchRadiusKm } });
 } catch (err) {
   next(err);
 }
});

// Responder accepts a proposed match -> assigns the case, notifies reporter, closes other candidates.
router.post('/:id/accept', requireAuth, requireRole('responder'), async (req, res, next) => {
 try {
  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Emergency not found' });

  const match = db
    .prepare(`SELECT * FROM matches WHERE emergency_id = ? AND responder_id = ?`)
    .get(req.params.id, req.user.id);
  if (!match) return res.status(403).json({ error: 'You were not proposed as a candidate for this emergency' });
  if (emergency.assigned_responder_id) {
    return res.status(409).json({ error: 'This emergency has already been accepted by another responder' });
  }

  const tx = db.transaction(() => {
    db.prepare(`UPDATE matches SET status = 'accepted', responded_at = datetime('now') WHERE id = ?`).run(match.id);
    db.prepare(`UPDATE matches SET status = 'expired' WHERE emergency_id = ? AND id != ? AND status IN ('proposed','notified')`).run(
      req.params.id,
      match.id
    );
    db.prepare(
      `UPDATE emergencies SET status = 'accepted', assigned_responder_id = ?, accepted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(req.user.id, req.params.id);
    db.prepare(`UPDATE responder_profiles SET active_case_count = active_case_count + 1 WHERE user_id = ?`).run(req.user.id);
  });
  tx();

  logEvent(req.params.id, 'accepted', req.user.id, { responderName: req.user.name });

  if (emergency.reporter_id) {
    await notifyUser({
      userId: emergency.reporter_id,
      emergencyId: req.params.id,
      channel: 'push',
      message: `Help is on the way: ${req.user.name} has accepted your emergency report and is responding.`,
    });
  }

  const updated = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  broadcastEvent({ type: 'emergency_accepted', emergency: updated });
  res.json({ ok: true, emergency: updated });
 } catch (err) {
   next(err);
 }
});

router.post('/:id/decline', requireAuth, requireRole('responder'), (req, res) => {
  const match = db.prepare(`SELECT * FROM matches WHERE emergency_id = ? AND responder_id = ?`).get(req.params.id, req.user.id);
  if (!match) return res.status(404).json({ error: 'No match found for this responder/emergency' });
  db.prepare(`UPDATE matches SET status = 'declined', responded_at = datetime('now') WHERE id = ?`).run(match.id);
  logEvent(req.params.id, 'declined', req.user.id, {});
  res.json({ ok: true });
});

const statusUpdateSchema = z.object({
  status: z.enum(['in_progress', 'resolved', 'closed', 'cancelled']),
  note: z.string().optional(),
});

router.post('/:id/status', requireAuth, (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  if (!emergency) return res.status(404).json({ error: 'Emergency not found' });

  const isAssigned = emergency.assigned_responder_id === req.user.id;
  const isPrivileged = ['coordinator', 'admin'].includes(req.user.role);
  if (!isAssigned && !isPrivileged) return res.status(403).json({ error: 'Not authorized to update this emergency' });

  const { status: newStatus, note } = parsed.data;
  const allowed = VALID_STATUS_TRANSITIONS[emergency.status] || [];
  if (!allowed.includes(newStatus)) {
    return res.status(409).json({ error: `Cannot transition from '${emergency.status}' to '${newStatus}'`, allowed });
  }

  const tx = db.transaction(() => {
    setStatus(req.params.id, newStatus, req.user.id, { note });
    if (newStatus === 'resolved') {
      db.prepare(`UPDATE emergencies SET resolved_at = datetime('now') WHERE id = ?`).run(req.params.id);
      if (emergency.assigned_responder_id) {
        db.prepare(
          `UPDATE responder_profiles SET active_case_count = MAX(0, active_case_count - 1) WHERE user_id = ?`
        ).run(emergency.assigned_responder_id);
      }
    }
  });
  tx();

  const updated = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
  broadcastEvent({ type: 'emergency_status_changed', emergency: updated });
  res.json({ ok: true, emergency: updated });
});

module.exports = router;
