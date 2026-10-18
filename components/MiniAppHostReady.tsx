"use client";

import { useEffect } from "react";

/** Dismiss Farcaster's launch splash only when this site is actually hosted as a Mini App. */
export function MiniAppHostReady() {
  useEffect(() => {
    if (window.parent === window && !window.ReactNativeWebView) return;
    let active = true;
    void import("@farcaster/miniapp-sdk").then(async ({ sdk }) => {
      if (active && await sdk.isInMiniApp()) await sdk.actions.ready();
    }).catch(() => {
      // The regular web client remains usable if host detection is unavailable.
    });
    return () => { active = false; };
  }, []);

  return null;
}
