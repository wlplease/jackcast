"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refreshOwnMiniApps } from "@/app/(main)/me/actions";

export function RefreshOwnMiniAppsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className="linkish" type="button" disabled={pending} onClick={() => startTransition(async () => {
    await refreshOwnMiniApps();
    router.refresh();
  })}>{pending ? "Checking…" : "Refresh apps"}</button>;
}
