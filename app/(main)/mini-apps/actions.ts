"use server";

import { revalidateTag } from "next/cache";
import { getViewer } from "@/lib/viewer";
import { miniAppsOverview, searchMiniApps } from "@/lib/data";

export async function loadMiniAppSearch(query: string): Promise<{ ok: true; apps: Awaited<ReturnType<typeof searchMiniApps>> } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Connect your account at /setup first." };
  const q = typeof query === "string" ? query.trim().slice(0, 80) : "";
  if (q.length < 2) return { ok: true, apps: [] };
  try {
    const result = await searchMiniApps(q);
    return { ok: true, apps: result };
  } catch {
    return { ok: false, error: "Mini app search is unavailable right now. Try again shortly." };
  }
}

export async function refreshMiniApps(): Promise<void> {
  if (!await getViewer()) return;
  revalidateTag("mini-apps-overview");
}
