export async function ensurePushSubscription() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false };
  const reg = await navigator.serviceWorker.ready;
  const vapid = await fetch('/api/push/vapid').then(r => r.json()).catch(() => ({ key: '' }));
  if (!vapid?.key) return { ok: false };
  const existing = await reg.pushManager.getSubscription();
  if (existing) return { ok: true };
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid.key) });
  await fetch('/api/push/subscribe', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys, userAgent: navigator.userAgent })
  }).catch(() => {});
  return { ok: true };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}
