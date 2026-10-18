"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { neynar } from "@/lib/neynar";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import type { PostCastReqBodyEmbeds } from "@neynar/nodejs-sdk/build/api";
import { getViewer } from "@/lib/viewer";

async function signer(): Promise<string> {
  const v = await getViewer();
  if (!v?.signerUuid) throw new Error("Not connected for writing. Visit /setup.");
  return v.signerUuid;
}

export type ActionResult = { ok: true; hash?: string } | { ok: false; error: string };

function errMessage(e: unknown): string {
  const anyErr = e as { response?: { data?: { message?: string } }; message?: string };
  return anyErr?.response?.data?.message ?? anyErr?.message ?? "Something went wrong";
}

export async function publish(input: {
  text: string;
  parentHash?: string;
  parentAuthorFid?: number;
  channelId?: string;
  /** Links and uploaded photo URLs */
  embedUrls?: string[];
  /** Quote another cast */
  quote?: { hash: string; fid: number };
}): Promise<ActionResult> {
  const text = input.text.trim();
  const urls = (input.embedUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (urls.some((u) => !/^https?:\/\//i.test(u) || u.length > 256)) {
    return { ok: false, error: "Links need to start with https:// and be under 256 characters." };
  }
  if (urls.some((u) => /\.private\.blob\.vercel-storage\.com/i.test(u))) {
    return { ok: false, error: "That photo is in a private Blob store, so nobody could see it. Switch to a public store first." };
  }
  if (!text && !urls.length && !input.quote) return { ok: false, error: "Nothing to cast" };
  if (new TextEncoder().encode(text).length > 1024) {
    return { ok: false, error: "Too long (1024 bytes max)" };
  }
  // The SDK's generated embed type merges the url and cast variants; the API wants one or the other.
  const embeds = [
    ...urls.map((url) => ({ url })),
    ...(input.quote ? [{ cast_id: { hash: input.quote.hash, fid: input.quote.fid } }] : []),
  ];
  if (embeds.length > 2) return { ok: false, error: "Farcaster allows 2 attachments per cast." };
  try {
    const res = await neynar().publishCast({
      signerUuid: await signer(),
      text,
      ...(input.parentHash ? { parent: input.parentHash, parentAuthorFid: input.parentAuthorFid } : {}),
      ...(!input.parentHash && input.channelId ? { channelId: input.channelId } : {}),
      ...(embeds.length ? { embeds: embeds as unknown as PostCastReqBodyEmbeds[] } : {}),
    });
    revalidatePath("/", "layout");
    return { ok: true, hash: res.cast?.hash };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function react(input: {
  hash: string;
  authorFid: number;
  kind: "like" | "recast";
  on: boolean;
}): Promise<ActionResult> {
  try {
    const args = {
      signerUuid: await signer(),
      reactionType: input.kind,
      target: input.hash,
      targetAuthorFid: input.authorFid,
    };
    if (input.on) await neynar().publishReaction(args);
    else await neynar().deleteReaction(args);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const expected = await sessionToken();
  if (!expected) redirect("/");
  if (form.get("password") !== process.env.APP_PASSWORD) return "Wrong password";
  const jar = await cookies();
  jar.set(SESSION_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
