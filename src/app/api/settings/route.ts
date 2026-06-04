import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { baniFromRon } from "@/lib/format";

const Body = z.object({
  fxRonToUsd: z.coerce.number().positive(),
  bsBasRon: z.coerce.number().nonnegative(),         // MAJOR units, in RON
  camRon: z.coerce.number().nonnegative(),           // MAJOR units, in RON
  microPct: z.coerce.number().min(0).max(1),
  dividendePct: z.coerce.number().min(0).max(1),
  redThresholdRon: z.coerce.number().nonnegative(),  // MAJOR units, in RON
  senderEmail: z.string().email().or(z.literal("")).optional(),
  senderName: z.string().optional(),
  invoiceStartNumber: z.coerce.number().int().min(1).optional(),
});

/** Lightweight body for one-off display preferences (used by the
 * currency dropdown on the Dashboard, which doesn't need the rest of
 * the form). All fields optional — pass the subset you want to change. */
const PartialBody = z.object({
  displayCurrency: z.enum(["USD", "RON"]).optional(),
  // Time-log API token management. "generate" mints a new token; "revoke"
  // clears it (disables the external API).
  timelogTokenAction: z.enum(["generate", "revoke"]).optional(),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => null);
  const keys = Object.keys(json ?? {});
  // Try the partial body first — single-key updates (e.g. currency switch,
  // token mint) shouldn't have to re-send every tax/fx field.
  const partial = PartialBody.safeParse(json);
  if (partial.success && keys.length === 1 && partial.data.displayCurrency) {
    await db.settings.upsert({
      where: { id: 1 },
      update: { displayCurrency: partial.data.displayCurrency },
      create: { id: 1, displayCurrency: partial.data.displayCurrency },
    });
    return NextResponse.json({ ok: true });
  }
  if (partial.success && keys.length === 1 && partial.data.timelogTokenAction) {
    const token =
      partial.data.timelogTokenAction === "generate"
        ? `tl_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`
        : null;
    await db.settings.upsert({
      where: { id: 1 },
      update: { timelogToken: token },
      create: { id: 1, timelogToken: token },
    });
    return NextResponse.json({ ok: true, token });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;
  await db.settings.upsert({
    where: { id: 1 },
    update: {
      fxRonToUsd: v.fxRonToUsd,
      bsBasRon: baniFromRon(v.bsBasRon),
      camRon: baniFromRon(v.camRon),
      microPct: v.microPct,
      dividendePct: v.dividendePct,
      redThresholdRon: baniFromRon(v.redThresholdRon),
      ...(v.senderEmail !== undefined ? { senderEmail: v.senderEmail } : {}),
      ...(v.senderName !== undefined ? { senderName: v.senderName } : {}),
      ...(v.invoiceStartNumber !== undefined ? { invoiceStartNumber: v.invoiceStartNumber } : {}),
    },
    create: {
      id: 1,
      fxRonToUsd: v.fxRonToUsd,
      bsBasRon: baniFromRon(v.bsBasRon),
      camRon: baniFromRon(v.camRon),
      microPct: v.microPct,
      dividendePct: v.dividendePct,
      redThresholdRon: baniFromRon(v.redThresholdRon),
      senderEmail: v.senderEmail ?? "",
      senderName: v.senderName ?? "PROJECT CIP S.R.L.",
      invoiceStartNumber: v.invoiceStartNumber ?? 1,
    },
  });
  return NextResponse.json({ ok: true });
}
