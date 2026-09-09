import { NextResponse } from "next/server";
import { exchangeCode, hello, recordHealth, storeTokens } from "@/lib/anaf/oauth";
import { getAnafOauthSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// schimbul codului (20s) + proba TestOauth (15s) + scrieri: sa nu fie taiat
// dupa ce tokenurile sunt deja salvate.
export const maxDuration = 60;

/*
 * ANAF redirectioneaza aici cu ?code=... Codul e bun 60 de secunde, deci
 * schimbul se face imediat, in aceeasi cerere.
 *
 * Ruta ramane in spatele sesiunii de login (middleware): redirectul e un GET
 * de nivel superior din acelasi browser, deci cookie-urile SameSite=Lax vin cu
 * el. Marcajul `et_anaf_oauth` (10 minute, pus de /start) e inlocuitorul lui
 * `state`, pe care procedura ANAF cere sa-l lasam gol; se consuma aici.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  const marker = await getAnafOauthSession();
  const started = marker.startedAt;
  marker.destroy();

  const origin = (() => {
    try {
      return new URL(process.env.ANAF_REDIRECT_URI ?? "").origin;
    } catch {
      return url.origin;
    }
  })();
  const back = (result: string, reason?: string) => {
    const to = new URL("/settings", origin);
    to.searchParams.set("anaf", result);
    if (reason) to.searchParams.set("reason", reason.slice(0, 200));
    return NextResponse.redirect(to);
  };

  if (!started || Date.now() - started > 10 * 60_000) return back("stale");
  if (oauthError) return back("denied", oauthError);
  if (!code) return back("denied", "no code in callback");

  try {
    const tr = await exchangeCode(code);
    await storeTokens(tr, { kind: "authorize" });
    // Proba din procedura ANAF: 200 + seria certificatului in ecou.
    try {
      const h = await hello(tr.access_token);
      await recordHealth(h.ok, h.serial, h.ok ? undefined : `TestOauth hello → HTTP ${h.status}`);
    } catch {
      /* health e informativ; tokenul e salvat */
    }
    return back("connected");
  } catch (err) {
    return back("failed", err instanceof Error ? err.message : "token exchange failed");
  }
}
