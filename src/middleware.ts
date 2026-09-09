import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  // Passkey ceremonies don't require a session (they ARE the session)
  "/api/auth/passkey/login/options",
  "/api/auth/passkey/login/verify",
  // External time-log API — authenticated by its own Bearer token, not the
  // browser session, so agents (Conductor) can POST hours without a cookie.
  "/api/timelog",
  // Verificarea legaturii cu Oblio — autentificata cu acelasi Bearer ca
  // /api/timelog. E strict GET si nu emite nimic, dar citeste date de cont,
  // deci nu ramane deschisa: fara token corect intoarce 401.
  "/api/oblio/health",
  // Proba cu proforma — acelasi Bearer. Emite doar proforme, niciodata facturi.
  "/api/oblio/proforma-test",
  // Starea legaturii cu ANAF e-Factura — acelasi Bearer ca /api/timelog, ca sa
  // poata fi supravegheata din afara (UptimeRobot, curl). Read-only.
  "/api/anaf/health",
  // Cron-ul Vercel: refresh de token, verificare stari, descarcare arhive.
  // Autentificat cu CRON_SECRET, pe care Vercel il trimite singur.
  "/api/cron/efactura",
  // Ruta isi verifica singura CRON_SECRET; middleware-ul ar redirecta-o spre
  // /login si cronul Vercel n-ar ajunge niciodata la ea.
  "/api/cron/fx",
  // PWA assets — must be public so iPhone can install
  "/manifest.webmanifest",
  // Service worker path — kept public so the self-unregistering stub (push
  // notifications were removed) is fetchable to clean up installed PWAs.
  "/sw.js",
]);

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (PUBLIC_PATHS.has(url.pathname)) return NextResponse.next();

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.userId) {
    const login = url.clone();
    login.pathname = "/login";
    if (url.pathname !== "/") login.searchParams.set("next", url.pathname);
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|webmanifest)).*)",
  ],
};
