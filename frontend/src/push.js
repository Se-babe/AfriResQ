import { api } from './api';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : 'unsupported';
}

// Web Push subscriptions need the VAPID public key as a Uint8Array, but the
// server hands it over base64url-encoded (the standard wire format).
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Requests notification permission (if needed), subscribes this browser to
 * push, and registers the subscription with the API so the backend can
 * target it. Throws with a readable message on failure — callers should
 * surface it, not swallow it.
 */
export async function enablePush(token) {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device/browser.');

  const { publicKey } = await api('/notifications/vapid-public-key');
  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api('/notifications/subscribe', { method: 'POST', token, body: sub.toJSON() });
  return sub;
}

export async function disablePush(token) {
  const sub = await currentSubscription();
  if (!sub) return;
  await api('/notifications/unsubscribe', { method: 'POST', token, body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}
