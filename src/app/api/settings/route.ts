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
});

/** Lightweight body for one-off display preferences (used by the
 * currency dropdown on the Dashboard, which doesn't need the rest of
 * the form). All fields optional — pass the subset you want to change. */
const PartialBody = z.object({
  displayCurrency: z.enum(["USD", "RON"]).optional(),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => null);
  // Try the partial body first — single-key updates (e.g. currency switch)
  // shouldn't have to re-send every tax/fx field.
  const partial = PartialBody.safeParse(json);
  if (
    partial.success &&
    partial.data.displayCurrency &&
    Object.keys(json ?? {}).length === 1
  ) {
    await db.settings.upsert({
      where: { id: 1 },
      update: { displayCurrency: partial.data.displayCurrency },
      create: { id: 1, displayCurrency: partial.data.displayCurrency },
    });
    return NextResponse.json({ ok: true });
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
    },
    create: {
      id: 1,
      fxRonToUsd: v.fxRonToUsd,
      bsBasRon: baniFromRon(v.bsBasRon),
      camRon: baniFromRon(v.camRon),
      microPct: v.microPct,
      dividendePct: v.dividendePct,
      redThresholdRon: baniFromRon(v.redThresholdRon),
    },
  });
  return NextResponse.json({ ok: true });
}
