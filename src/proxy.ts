import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

const PUBLIC_PAGES = ["/login"];
const PUBLIC_API = ["/api/auth/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic =
    PUBLIC_PAGES.includes(pathname) || PUBLIC_API.includes(pathname);
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (session && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session || isPublic) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
