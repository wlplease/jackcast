import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const isSetup = req.nextUrl.pathname === "/setup" || req.nextUrl.pathname.startsWith("/setup/");
  const nonce = isSetup ? btoa(crypto.randomUUID()) : null;
  const requestHeaders = new Headers(req.headers);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const hasPassword = Boolean(process.env.APP_PASSWORD);

  // No password configured: fail closed in production, open in local dev.
  if (!hasPassword) {
    if (process.env.NODE_ENV === "production") {
      const response = new NextResponse("Set APP_PASSWORD to use this client.", { status: 500 });
      applySetupPolicy(response, nonce);
      return response;
    }
    return nextResponse(requestHeaders, nonce);
  }

  if (await isValidSessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return nextResponse(requestHeaders, nonce);

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const response = NextResponse.redirect(url);
  applySetupPolicy(response, nonce);
  return response;
}

function nextResponse(requestHeaders: Headers, nonce: string | null) {
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  applySetupPolicy(response, nonce);
  return response;
}

function applySetupPolicy(response: NextResponse, nonce: string | null) {
  if (!nonce) return;
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `style-src 'self' 'nonce-${nonce}'`,
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "manifest-src 'self'",
      "form-action 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  response.headers.set("Referrer-Policy", "no-referrer");
}

export const config = {
  matcher: ["/((?!login|i/|brand/|_next/static|_next/image|jackcaster-icon.svg|icon-|apple-touch-icon|favicon|manifest.webmanifest).*)"],
};
