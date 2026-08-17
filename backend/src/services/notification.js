const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const logger = require('../logger');
const { sendSms } = require('./providers/sms');
const { sendPush } = require('./providers/push');

/**
 * Notification abstraction (SRS FR-3.6 / FR-3.9). Every notification is
 * always persisted first (so the audit trail and dashboard are fully real
 * regardless of delivery outcome), then dispatched to a real transport:
 *  - 'push'  -> Web Push to the user's subscribed browsers (providers/push.js)
 *  - 'sms'   -> Africa's Talking SMS (providers/sms.js)
 * Both providers no-op gracefully (falling back to a console log) when
 * unconfigured, so the pilot runs with zero external accounts by default.
 */

let broadcastFn = null;
function setBroadcaster(fn) {
  broadcastFn = fn;
}

async function dispatch(channel, message, { userId, phone } = {}) {
  if (channel === 'sms') {
    const result = await sendSms(phone, message);
    return result.ok;
  }
  if (channel === 'push') {
    const result = await sendPush(userId, message);
    // A push with no registered subscriptions isn't a delivery failure —
    // the in-app/WebSocket channel still carries the notification.
    if (!result.simulated && result.sent === 0) {
      logger.info({ userId }, 'no push subscriptions for user; delivered in-app only');
    }
    return true;
  }
  logger.info({ channel, message }, '[notify] no real transport for this channel; recorded in-app only');
  return true;
}

async function notifyUser({ userId, emergencyId, channel = 'in_app', message }) {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO notifications (id, user_id, emergency_id, channel, message, status) VALUES (?, ?, ?, ?, ?, 'queued')`
  ).run(id, userId, emergencyId, channel, message);

  let phone = null;
  if (channel === 'sms') {
    const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(userId);
    phone = user?.phone || null;
  }

  const ok = await dispatch(channel, message, { userId, phone });
  db.prepare(`UPDATE notifications SET status = ? WHERE id = ?`).run(ok ? 'sent' : 'failed', id);

  if (broadcastFn) {
    broadcastFn({ type: 'notification', userId, emergencyId, channel, message });
  }
  return id;
}

function broadcastEvent(payload) {
  if (broadcastFn) broadcastFn(payload);
}

module.exports = { notifyUser, setBroadcaster, broadcastEvent };
