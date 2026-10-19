import { get } from "@vercel/blob";
import type { NextRequest } from "next/server";

// Public, cacheable copies of photos you uploaded to a *private* Vercel Blob store.
// Other Farcaster clients can't open private-store links, so casts point here instead.
// Only casts/ and pfp/ (things you've chosen to publish) are served. The middleware
// leaves /i/ outside the password gate on purpose.

const PATH = /^(casts|pfp)\/[\w.-]{1,200}$/;
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", mp4: "video/mp4", webm: "video/webm" };

async function serve(req: NextRequest, path: string[], head: boolean) {
  const pathname = path.join("/");
  if (!PATH.test(pathname)) return new Response("Not found", { status: 404 });
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext]) return new Response("Not found", { status: 404 });

  try {
    const res = await get(pathname, {
      access: "private",
      oidcToken: req.headers.get("x-vercel-oidc-token") ?? undefined,
    });
    if (!res || res.statusCode !== 200) return new Response("Not found", { status: 404 });
    const storedType = res.blob.contentType?.toLowerCase().split(";")[0].trim();
    if (storedType && storedType !== TYPES[ext]) return new Response("Not found", { status: 404 });
    const headers = {
      "content-type": TYPES[ext],
      "content-length": String(res.blob.size),
      // Uploads get a random suffix and never change, so caches can keep them forever.
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    };
    if (head) {
      res.stream.cancel().catch(() => {});
      return new Response(null, { headers });
    }
    return new Response(res.stream, { headers });
  } catch (e) {
    console.error("photo route:", pathname, (e as Error)?.message);
    return new Response("Not found", { status: 404 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return serve(req, (await params).path, false);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return serve(req, (await params).path, true);
}
