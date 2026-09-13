import { getSettings } from "@/lib/queries";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anafConfigured, anafEnv, anafMissing } from "@/lib/anaf";
import { getAccessToken, hello, recordHealth, tokenStatus } from "@/lib/anaf/oauth";
import { EFACTURA_SINCE, efacturaDeadline, efacturaScope, isFiled, workingDaysUntil } from "@/lib/anaf/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// tranzactie (15s) + proba TestOauth (15s) + interogari; niciodata taiat la mijloc.
export const maxDuration = 60;

/*
 * Starea legaturii cu ANAF, read-only. Acelasi Bearer ca /api/timelog, ca sa
 * poata fi supravegheata din afara (UptimeRobot pe 200/non-200).
 *
 * `ok` e false cand: nu e configurat, nu e conectat, tokenul cere
 * reautorizare, proba TestOauth nu intoarce 200, sau exista facturi
 * obligatorii cu termenul depasit fara depunere (ok pe prod sau via Oblio).
 * "Depasit" se judeca pe zile calendaristice Bucuresti, ca in cron si in
 * lista — nu pe ora din issuedAt.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const s = await getSettings();
  if (!s?.timelogToken || token !== s.timelogToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = anafConfigured();
  const status = await tokenStatus(configured);
  const env = anafEnv();

  let probe: { ok: boolean; status: number; serial: string | null } | null = null;
  if (configured && status.connected && !status.needsReauth) {
    try {
      // Proba e read-only: nu are voie sa porneasca un refresh (un monitor
      // extern omorat la mijloc ar putea consuma refresh tokenul). Daca
      // accesul e expirat, proba pica si `ok` e false — corect.
      const at = await getAccessToken({ allowRefresh: false });
      const h = await hello(at);
      probe = { ok: h.ok, status: h.status, serial: h.serial };
      await recordHealth(h.ok, h.serial, h.ok ? undefined : `TestOauth hello → HTTP ${h.status}`);
    } catch (err) {
      probe = { ok: false, status: 0, serial: null };
      await recordHealth(false, null, err instanceof Error ? err.message : "probe failed");
    }
  }

  const [inProgress, recent] = await Promise.all([
    db.efacturaSubmission.count({ where: { env, state: { in: ["uploading", "in_prelucrare"] } } }),
    db.invoice.findMany({
      where: {
        status: { in: ["issued", "paid"] },
        efacturaPolicy: { not: "skip" },
        issuedAt: { gte: new Date(Math.max(EFACTURA_SINCE.getTime(), Date.now() - 60 * 86_400_000)) },
      },
      include: { efacturaCurrent: { select: { state: true, env: true } } },
    }),
  ]);
  const now = new Date();
  const overdue = recent.filter((i) => {
    if (efacturaScope(i).scope !== "required") return false;
    const cur = i.efacturaCurrent;
    const done = i.oblioNumber != null || (cur != null && cur.env === "prod" && isFiled(cur.state));
    return !done && workingDaysUntil(efacturaDeadline(i.issuedAt), now) < 0;
  });

  const ok =
    configured &&
    status.connected &&
    !status.needsReauth &&
    (probe?.ok ?? false) &&
    overdue.length === 0;

  return NextResponse.json(
    {
      ok,
      env,
      configured,
      missing: configured ? [] : anafMissing(),
      token: status,
      probe,
      submissionsInProgress: inProgress,
      overdueRequired: overdue.map((i) => ({
        id: i.id,
        number: `${i.series} ${i.number}`,
        issuedAt: i.issuedAt,
        deadline: efacturaDeadline(i.issuedAt),
        state: i.efacturaCurrent?.state ?? null,
      })),
    },
    { status: ok ? 200 : 503 },
  );
}
