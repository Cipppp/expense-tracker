import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout"];
  const isPublic = publicPaths.some((p) => url.pathname === p);

  if (isPublic) return NextResponse.next();

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)).*)"],
};
