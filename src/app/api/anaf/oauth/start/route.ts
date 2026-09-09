import { NextResponse } from "next/server";
import { anafConfigured, anafMissing } from "@/lib/anaf";
import { authorizeUrl } from "@/lib/anaf/oauth";
import { getAnafOauthSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Pasul cu certificatul. Trebuie pornit din browserul in care e tokenul USB /
 * certificatul instalat: logincert.anaf.ro cere certificatul la TLS
 * ("Selectati un certificat"), apoi PIN-ul, apoi redirectioneaza la callback
 * cu ?code=.
 *
 * POST, nu GET: un GET ar putea fi declansat de orice pagina straina printr-o
 * navigare de nivel superior (cookie SameSite=Lax), care ar "arma" marcajul in
 * browserul victimei si ar lasa un atacator sa-i lege contul de certificatul
 * lui. Cookie-ul de login nu pleaca pe un POST cross-site, iar
 * Sec-Fetch-Site e al doilea zavor. Raspunsul e 303, ca browserul sa continue
 * cu GET la ANAF.
 */
export async function POST(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ error: "cross-site start refused" }, { status: 403 });
  }
  if (!anafConfigured()) {
    return NextResponse.json(
      { error: "ANAF is not configured on this deployment.", missing: anafMissing() },
      { status: 422 },
    );
  }
  const marker = await getAnafOauthSession();
  marker.startedAt = Date.now();
  await marker.save();
  return NextResponse.redirect(authorizeUrl(), 303);
}
