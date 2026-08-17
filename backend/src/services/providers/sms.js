const logger = require('../../logger');

/**
 * SMS delivery via Africa's Talking (widely used across East Africa,
 * including Uganda — matches AfriResQ's target market and the +2567...
 * numbers seeded in the demo data). This is the real transport referenced
 * in the README as "out of pilot scope" — it now works end-to-end as soon
 * as credentials are supplied via env vars; with no credentials it falls
 * back to the same simulated console log the rest of the pilot already
 * relies on, so local/demo usage needs no account.
 *
 * Get sandbox credentials free at https://africastalking.com (Sandbox app).
 */
const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;
const AT_SENDER_ID = process.env.AT_SENDER_ID; // optional; sandbox works without one
const AT_BASE_URL = AT_USERNAME === 'sandbox'
  ? 'https://api.sandbox.africastalking.com/version1/messaging'
  : 'https://api.africastalking.com/version1/messaging';

function isConfigured() {
  return Boolean(AT_USERNAME && AT_API_KEY);
}

/**
 * @param {string} phone E.164-ish phone number (e.g. +256700000010)
 * @param {string} message
 * @returns {Promise<{ok: boolean, simulated: boolean, error?: string}>}
 */
async function sendSms(phone, message) {
  if (!phone) return { ok: false, simulated: true, error: 'no phone number on file' };

  if (!isConfigured()) {
    logger.info({ channel: 'sms', phone, message }, '[simulated sms] set AT_USERNAME/AT_API_KEY to send for real');
    return { ok: true, simulated: true };
  }

  try {
    const body = new URLSearchParams({ username: AT_USERNAME, to: phone, message });
    if (AT_SENDER_ID) body.set('from', AT_SENDER_ID);

    const res = await fetch(AT_BASE_URL, {
      method: 'POST',
      headers: {
        apiKey: AT_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    const data = await res.json().catch(() => ({}));
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    const ok = res.ok && (!recipient || recipient.status === 'Success' || recipient.statusCode === 101);
    if (!ok) logger.warn({ phone, status: res.status, data }, 'Africa\'s Talking SMS send failed');
    return { ok, simulated: false };
  } catch (err) {
    logger.error({ err, phone }, 'Africa\'s Talking SMS request threw');
    return { ok: false, simulated: false, error: err.message };
  }
}

module.exports = { sendSms, isConfigured };
