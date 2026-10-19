"use server";

import { revalidatePath } from "next/cache";
import { neynar } from "@/lib/neynar";
import { getViewer } from "@/lib/viewer";

export async function markAllNotificationsRead(): Promise<{ ok: true; clearedAt: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer?.signerUuid) return { ok: false, error: "Connect a writable Farcaster account to mark notifications as read." };
  try {
    const clearedAt = new Date().toISOString();
    await neynar().markNotificationsAsSeen({ signerUuid: viewer.signerUuid });
    revalidatePath("/notifications");
    revalidatePath("/");
    return { ok: true, clearedAt };
  } catch {
    return { ok: false, error: "Could not mark notifications as read. Try again shortly." };
  }
}
