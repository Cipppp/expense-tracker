import "server-only";
import { encKeyConfigured } from "./crypto";

/*
 * Configurarea ANAF e-Factura, citita la fiecare cerere (nu la import), ca un
 * env schimbat pe Vercel sa se vada dupa redeploy fara alte surprize.
 */

export type AnafEnv = "test" | "prod";

/** test = api.anaf.ro/test/FCTEL — nimic nu ajunge la contrapartide. */
export function anafEnv(): AnafEnv {
  return process.env.ANAF_ENV === "prod" ? "prod" : "test";
}

/** Client ID + Secret + Redirect URI + cheia de criptare — toate patru. */
export function anafConfigured(): boolean {
  return Boolean(
    process.env.ANAF_CLIENT_ID &&
      process.env.ANAF_CLIENT_SECRET &&
      process.env.ANAF_REDIRECT_URI &&
      encKeyConfigured(),
  );
}

/**
 * ANAF e calea VIE pentru facturi: configurat SI pe prod. Cat timp suntem pe
 * test, Oblio ramane vizibil — o factura trimisa doar pe api.anaf.ro/test nu
 * ajunge la niciun client si termenul legal ar trece neobservat.
 */
export function anafLive(): boolean {
  return anafConfigured() && anafEnv() === "prod";
}

export function anafMissing(): string[] {
  const out: string[] = [];
  if (!process.env.ANAF_CLIENT_ID) out.push("ANAF_CLIENT_ID");
  if (!process.env.ANAF_CLIENT_SECRET) out.push("ANAF_CLIENT_SECRET");
  if (!process.env.ANAF_REDIRECT_URI) out.push("ANAF_REDIRECT_URI");
  if (!encKeyConfigured()) out.push("ANAF_TOKEN_ENC_KEY (32 bytes, base64)");
  return out;
}
