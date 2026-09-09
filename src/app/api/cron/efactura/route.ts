import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { anafConfigured, anafEnv } from "@/lib/anaf";
import { AnafAuthError, getAccessToken, REAUTH_WARN_MS, REFRESH_AHEAD_MS, tokenStatus } from "@/lib/anaf/oauth";
import { sweepSubmissions } from "@/lib/anaf/send";
import { EFACTURA_SINCE, efacturaDeadline, efacturaScope, isFiled, workingDaysUntil } from "@/lib/anaf/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
 * O data pe zi (vercel.json). Fiecare pas e idempotent — cronul poate sari
 * sau se poate dubla.
 *
 *   1. token: refresh daca accesul mai are sub 14 zile — verificat pe
 *      expirarea de dupa, nu pe lipsa unei exceptii (getAccessToken poate
 *      cadea inapoi pe accesul vechi); alerta daca refresh-ul mai are sub 30
 *      de zile sau a murit (atunci e nevoie iar de certificat).
 *   2. maturare, cu buget de timp (150 s): stareMesaj pe ce e pe drum,
 *      descarcare pe ce lipseste din arhiva, impacare pe continut pentru
 *      randurile ramase in "uploading", mutare in S3 a arhivelor inline.
 *      Daca ANAF e lent, se opreste la timp ca alertele sa plece oricum.
 *   3. termene: facturi obligatorii de dupa EFACTURA_SINCE fara depunere (ok
 *      pe prod sau via Oblio) cu <= 2 zile lucratoare ramase, sau depasite → email.
 */
export async function GET(req: Request) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!anafConfigured()) return NextResponse.json({ skipped: "ANAF not configured" });

  const settings = await getSettings();
  const alerts: string[] = [];
  const report: Record<string, unknown> = { env: anafEnv() };

  // 1. token
  const status = await tokenStatus(true);
  if (status.connected) {
    if (status.needsReauth) {
      alerts.push("ANAF refresh token is expired or rejected. Reconnect with the certificate: Settings → ANAF e-Factura → Connect.");
    } else {
      if ((status.accessExpiresAt?.getTime() ?? 0) - Date.now() < REFRESH_AHEAD_MS) {
        const before = status.accessExpiresAt?.getTime() ?? 0;
        try {
          await getAccessToken({ forceRefresh: true });
        } catch (err) {
          const dead = err instanceof AnafAuthError && err.needsReauth;
          alerts.push(
            dead
              ? "ANAF token refresh failed: refresh token expired. Reconnect with the certificate."
              : `ANAF token refresh failed: ${err instanceof Error ? err.message : "unknown"}`,
          );
        }
        const after = await tokenStatus(true);
        const moved = (after.accessExpiresAt?.getTime() ?? 0) > before;
        report.tokenRefreshed = moved;
        if (!moved && !after.needsReauth) {
          alerts.push(
            `ANAF token refresh did not happen (old access token still in use, ${after.accessDaysLeft} days left): ${after.lastError ?? "unknown"}`,
          );
        }
      }
      if ((status.refreshExpiresAt?.getTime() ?? 0) - Date.now() < REAUTH_WARN_MS) {
        alerts.push(`ANAF refresh token expires in ${status.refreshDaysLeft} days. Reconnect with the certificate before then.`);
      }
    }
  } else {
    report.token = "not connected";
  }

  // 2. maturare
  const fresh = await tokenStatus(true);
  if (fresh.connected && !fresh.needsReauth) {
    try {
      const sweep = await sweepSubmissions(settings.issuerCif, { stopAt: startedAt + 150_000 });
      report.sweep = sweep;
      if (sweep.notes.length) alerts.push(`e-Factura reconciliation:\n${sweep.notes.join("\n")}`);
      if (sweep.truncated) alerts.push("e-Factura sweep stopped early (ANAF slow); the remaining rows are checked tomorrow.");
    } catch (err) {
      report.sweepError = err instanceof Error ? err.message : "sweep failed";
    }
  }

  // 3. termene
  const since = new Date(Math.max(EFACTURA_SINCE.getTime(), Date.now() - 45 * 86_400_000));
  const recent = await db.invoice.findMany({
    where: {
      status: { in: ["issued", "paid"] },
      efacturaPolicy: { not: "skip" },
      issuedAt: { gte: since },
    },
    include: { efacturaCurrent: { select: { state: true, env: true } } },
  });
  const now = new Date();
  const due: string[] = [];
  const archivePending: string[] = [];
  for (const i of recent) {
    if (efacturaScope(i).scope !== "required") continue;
    const cur = i.efacturaCurrent;
    if (cur?.state === "download_failed" && cur.env === "prod") archivePending.push(`${i.series} ${i.number}`);
    const done = i.oblioNumber != null || (cur != null && cur.env === "prod" && isFiled(cur.state));
    if (done) continue;
    const left = workingDaysUntil(efacturaDeadline(i.issuedAt), now);
    if (left <= 2) {
      due.push(
        `${i.series} ${i.number} (${i.clientCompany}) — ${left < 0 ? `OVERDUE by ${-left} working days` : `${left} working days left`} · state: ${cur?.state ?? "not sent"}${cur && cur.env !== "prod" ? ` (${cur.env})` : ""}`,
      );
    }
  }
  if (due.length) alerts.push(`e-Factura deadlines:\n${due.join("\n")}`);
  if (archivePending.length) {
    alerts.push(`e-Factura validated but the ANAF zip is not archived yet (descarcare/S3 failing):\n${archivePending.join("\n")}`);
  }
  report.deadlines = due.length;

  // email
  const to = process.env.ANAF_ALERT_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (alerts.length && to && key && settings.senderEmail) {
    try {
      const resend = new Resend(key);
      await resend.emails.send({
        from: settings.senderName ? `${settings.senderName} <${settings.senderEmail}>` : settings.senderEmail,
        to,
        subject: `[House Cefani] ANAF e-Factura: ${alerts.length} alert${alerts.length > 1 ? "s" : ""}`,
        text: alerts.join("\n\n"),
      });
      report.emailed = true;
    } catch (err) {
      report.emailError = err instanceof Error ? err.message : "send failed";
    }
  }
  report.alerts = alerts;
  report.durationMs = Date.now() - startedAt;
  return NextResponse.json(report);
}
