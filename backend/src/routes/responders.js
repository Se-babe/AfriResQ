const express = require('express');
const { z } = require('zod');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const locationSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

router.patch('/me/location', requireAuth, requireRole('responder'), (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  db.prepare(
    `UPDATE responder_profiles SET current_lat = ?, current_lng = ?, last_location_at = datetime('now') WHERE user_id = ?`
  ).run(parsed.data.lat, parsed.data.lng, req.user.id);
  res.json({ ok: true });
});

const availabilitySchema = z.object({ status: z.enum(['available', 'busy', 'offline']) });

router.patch('/me/availability', requireAuth, requireRole('responder'), (req, res) => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  db.prepare(`UPDATE responder_profiles SET availability_status = ? WHERE user_id = ?`).run(parsed.data.status, req.user.id);
  res.json({ ok: true });
});

router.patch('/me/skills', requireAuth, requireRole('responder'), (req, res) => {
  const skills = Array.isArray(req.body.skills) ? req.body.skills : [];
  db.prepare(`UPDATE responder_profiles SET skills = ? WHERE user_id = ?`).run(JSON.stringify(skills), req.user.id);
  res.json({ ok: true, skills });
});

// Coordinator/admin: list responders pending verification.
router.get('/pending', requireAuth, requireRole('coordinator', 'admin'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.phone, u.email, rp.skills, rp.organization_id, rp.verification_status, rp.created_at,
              o.name as organization_name
       FROM responder_profiles rp
       JOIN users u ON u.id = rp.user_id
       LEFT JOIN organizations o ON o.id = rp.organization_id
       WHERE rp.verification_status = 'pending'
       ORDER BY rp.created_at ASC`
    )
    .all();
  res.json(rows.map((r) => ({ ...r, skills: JSON.parse(r.skills || '[]') })));
});

const verifySchema = z.object({ status: z.enum(['verified', 'rejected']), notes: z.string().optional() });

router.post('/:userId/verify', requireAuth, requireRole('coordinator', 'admin'), (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = db
    .prepare(`UPDATE responder_profiles SET verification_status = ?, verification_notes = ? WHERE user_id = ?`)
    .run(parsed.data.status, parsed.data.notes || null, req.params.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Responder profile not found' });
  res.json({ ok: true });
});

router.get('/', requireAuth, requireRole('coordinator', 'admin'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.phone, rp.skills, rp.verification_status, rp.availability_status,
              rp.current_lat, rp.current_lng, rp.active_case_count, rp.rating_avg, rp.organization_id,
              o.name as organization_name
       FROM responder_profiles rp
       JOIN users u ON u.id = rp.user_id
       LEFT JOIN organizations o ON o.id = rp.organization_id
       ORDER BY u.name ASC`
    )
    .all();
  res.json(rows.map((r) => ({ ...r, skills: JSON.parse(r.skills || '[]') })));
});

module.exports = router;
