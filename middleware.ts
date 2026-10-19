import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const expected = await sessionToken();

  // No password configured: fail closed in production, open in local dev.
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Set APP_PASSWORD to use this client.", { status: 500 });
    }
    return NextResponse.next();
  }

  if (req.cookies.get(SESSION_COOKIE)?.value === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|i/|brand/|_next/static|_next/image|jackcaster-icon.svg|icon-|apple-touch-icon|favicon|manifest.webmanifest).*)"],
};
