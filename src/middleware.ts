import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  // Passkey ceremonies don't require a session (they ARE the session)
  "/api/auth/passkey/login/options",
  "/api/auth/passkey/login/verify",
  // PWA assets — must be public so iPhone can install
  "/manifest.webmanifest",
]);

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (PUBLIC_PATHS.has(url.pathname)) return NextResponse.next();

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.isAuthed) {
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
