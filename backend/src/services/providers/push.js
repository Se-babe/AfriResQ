const { v4: uuidv4 } = require('uuid');
const db = require('../../db/db');
const logger = require('../../logger');

/**
 * Real browser push notifications over the standard Web Push protocol
 * (VAPID), delivered through each browser vendor's push service — no
 * third-party SDK or paid account needed, unlike Firebase Cloud Messaging.
 * Generate a keypair once with `npx web-push generate-vapid-keys` and put
 * the values in backend/.env. Without keys configured, push is a no-op and
 * everything else (in-app + WebSocket notifications) keeps working.
 */
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@afriresq.org';

let webpush = null;
let configured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush = require('web-push');
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
} else {
  logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications are disabled (run `npx web-push generate-vapid-keys`)');
}

function isConfigured() {
  return configured;
}

function getVapidPublicKey() {
  return configured ? VAPID_PUBLIC_KEY : null;
}

function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('Invalid push subscription payload');
  db.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(uuidv4(), userId, endpoint, keys.p256dh, keys.auth);
}

function removeSubscription(endpoint) {
  db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
}

/**
 * Sends a push notification to every subscription a user has registered
 * (they may have more than one device/browser). Expired/invalid
 * subscriptions (410 Gone / 404) are pruned automatically.
 * @returns {Promise<{ok: boolean, simulated: boolean, sent: number}>}
 */
async function sendPush(userId, message) {
  if (!configured) return { ok: false, simulated: true, sent: 0 };

  const subs = db.prepare(`SELECT * FROM push_subscriptions WHERE user_id = ?`).all(userId);
  if (subs.length === 0) return { ok: false, simulated: false, sent: 0 };

  const payload = JSON.stringify({ title: 'AfriResQ', body: message });
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          removeSubscription(sub.endpoint);
        } else {
          logger.warn({ err: err.message, userId }, 'web push send failed');
        }
      }
    })
  );
  return { ok: sent > 0, simulated: false, sent };
}

module.exports = { isConfigured, getVapidPublicKey, saveSubscription, removeSubscription, sendPush };
