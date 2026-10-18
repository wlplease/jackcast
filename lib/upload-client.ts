"use client";

import { upload, uploadPresigned } from "@vercel/blob/client";

type Mode = "presigned" | "token" | null;
let modeOnce: Promise<Mode> | null = null;

function uploadMode(): Promise<Mode> {
  modeOnce ??= fetch("/api/upload", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { mode: null }))
    .then((j: { mode: Mode }) => j.mode)
    .catch(() => {
      modeOnce = null; // try again next time
      return null;
    });
  return modeOnce;
}

/** Uploads one prepared image to Vercel Blob with whichever flow this deployment supports. Returns a URL anyone can open: the Blob URL for public stores, or this app's own /i/ link for private ones. */
export async function uploadImage(pathname: string, body: Blob, contentType: string): Promise<string> {
  const mode = await uploadMode();
  if (!mode) throw new Error("Photo uploads need Vercel Blob turned on (501).");
  const opts = {
    access: "public" as const,
    handleUploadUrl: "/api/upload",
    contentType,
    abortSignal: AbortSignal.timeout(60_000),
  };
  const res = mode === "presigned" ? await uploadPresigned(pathname, body, opts) : await upload(pathname, body, opts);
  const u = new URL(res.url);
  if (/\.private\.blob\.vercel-storage\.com$/.test(u.hostname)) {
    // Nobody else can open a private store's links, so the app serves the photo itself.
    // The path ends in .jpg (or .png/.gif), which is how other clients know it's an image.
    return `${window.location.origin}/i${u.pathname}`;
  }
  return res.url;
}
