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

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => null);
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
