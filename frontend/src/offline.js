const KEY = 'afriresq_offline_queue';

export function enqueueReport(report) {
  const queue = JSON.parse(localStorage.getItem(KEY) || '[]');
  queue.push({ ...report, queuedAt: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(queue));
}

export function peekQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export async function flushQueue(submitFn) {
  const queue = peekQueue();
  if (!queue.length) return { sent: 0, remaining: 0 };
  const remaining = [];
  let sent = 0;
  for (const item of queue) {
    try {
      await submitFn(item);
      sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(KEY, JSON.stringify(remaining));
  return { sent, remaining: remaining.length };
}
