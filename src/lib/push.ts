import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

let configured: boolean | null = null;

/** Configure web-push once from env. Returns false if VAPID keys are missing. */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@cefani.com",
    pub,
    priv,
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Send a notification to every stored subscription, optionally skipping the
 * person who triggered it (so you don't get buzzed for your own action).
 * Dead subscriptions (404/410) are pruned. Never throws.
 */
export async function sendPushToAll(
  payload: PushPayload,
  exceptPerson?: string | null,
): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await db.pushSubscription.findMany().catch(() => []);
  if (subs.length === 0) return;
  const data = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      if (exceptPerson && s.person === exceptPerson) return;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await db.pushSubscription
            .delete({ where: { endpoint: s.endpoint } })
            .catch(() => {});
        }
      }
    }),
  );
}
