// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _webpush: any | null = null;
try { _webpush = require("web-push"); } catch { _webpush = null; }
import { prisma } from "@/lib/prisma";

const PUBLIC_VAPID = process.env.WEB_PUSH_PUBLIC_KEY || "BBTCz4JGQmoGe9hFUqUJXxw50PDaHzwVhLtcm0PszYJKcZcrDvj682Mm7RcR8oX76hl5rXoHfOA6ATRMVBqM3Zw";
const PRIVATE_VAPID = process.env.WEB_PUSH_PRIVATE_KEY || "bP3JUv1evLPllCyZwN8DWonLT8re82Ygghj0JEwWTIU";
const VAPID_SUBJECT = process.env.WEB_PUSH_SUBJECT || "mailto:wallydibombepro@gmail.com";

let configured = false;
export function ensureVapid() {
  if (configured) return;
  if (_webpush && PUBLIC_VAPID && PRIVATE_VAPID) {
    _webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID, PRIVATE_VAPID);
    configured = true;
  }
}

export function getPublicVapidKey(): string { return PUBLIC_VAPID; }

export async function sendPushToUser(userEmail: string, payload: unknown) {
  ensureVapid();
  if (!configured) {
    console.log("[push] dry-run (no VAPID)", { to: userEmail, payload });
    return;
  }
  const subs = await (prisma as any).pushSubscription.findMany({ where: { userEmail } });
  const json = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map((s: any) =>
      _webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json
        )
        .catch(async (err: any) => {
          const gone = err?.statusCode === 404 || err?.statusCode === 410;
          if (gone) {
            try { await (prisma as any).pushSubscription.delete({ where: { endpoint: s.endpoint } }); } catch {}
          }
          throw err;
        })
    )
  );
}
