const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * Implements the measurable indicators from SRS Section 14:
 * - avg time submission -> first notification
 * - avg time submission -> acceptance
 * - classification distribution
 * - matching success rate (emergencies that found >=1 candidate)
 */
router.get('/summary', requireAuth, requireRole('coordinator', 'admin'), (req, res) => {
  const totals = db.prepare('SELECT COUNT(*) as count FROM emergencies').get();

  const avgNotifySeconds = db
    .prepare(
      `SELECT AVG((julianday(first_notified_at) - julianday(created_at)) * 86400) as avg_seconds
       FROM emergencies WHERE first_notified_at IS NOT NULL`
    )
    .get();

  const avgAcceptSeconds = db
    .prepare(
      `SELECT AVG((julianday(accepted_at) - julianday(created_at)) * 86400) as avg_seconds
       FROM emergencies WHERE accepted_at IS NOT NULL`
    )
    .get();

  const byCategory = db
    .prepare('SELECT category, COUNT(*) as count FROM emergencies GROUP BY category ORDER BY count DESC')
    .all();

  const bySeverity = db
    .prepare('SELECT severity, COUNT(*) as count FROM emergencies GROUP BY severity ORDER BY count DESC')
    .all();

  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM emergencies GROUP BY status').all();

  const noCandidateCount = db
    .prepare(
      `SELECT COUNT(DISTINCT emergency_id) as count FROM emergency_events WHERE event_type = 'no_candidates_found'`
    )
    .get();

  const matchingSuccessRate =
    totals.count > 0 ? Number((1 - noCandidateCount.count / totals.count).toFixed(3)) : null;

  const activeCount = db
    .prepare(`SELECT COUNT(*) as count FROM emergencies WHERE status NOT IN ('resolved','closed','cancelled')`)
    .get();
  const availableResponders = db
    .prepare(
      `SELECT COUNT(*) as count FROM responder_profiles WHERE verification_status = 'verified' AND availability_status = 'available'`
    )
    .get();
  const pendingVerification = db
    .prepare(`SELECT COUNT(*) as count FROM responder_profiles WHERE verification_status = 'pending'`)
    .get();

  res.json({
    totalEmergencies: totals.count,
    activeEmergencies: activeCount.count,
    availableResponders: availableResponders.count,
    pendingVerification: pendingVerification.count,
    avgSecondsToFirstNotification: avgNotifySeconds.avg_seconds,
    avgSecondsToAcceptance: avgAcceptSeconds.avg_seconds,
    matchingSuccessRate,
    byCategory,
    bySeverity,
    byStatus,
  });
});

module.exports = router;
