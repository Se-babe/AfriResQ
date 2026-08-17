const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM organizations ORDER BY name ASC').all());
});

const orgSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['health_facility', 'police', 'fire', 'ngo', 'community_group', 'ambulance', 'other']),
  phone: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  addressText: z.string().optional(),
});

router.post('/', requireAuth, requireRole('coordinator', 'admin'), (req, res) => {
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const id = uuidv4();
  const d = parsed.data;
  db.prepare(
    `INSERT INTO organizations (id, name, type, phone, lat, lng, address_text, verified) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(id, d.name, d.type, d.phone || null, d.lat ?? null, d.lng ?? null, d.addressText || null);
  res.status(201).json({ id, ...d });
});

module.exports = router;
