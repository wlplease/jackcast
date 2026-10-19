"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { recordArcadeSecret } from "@/lib/arcade-client";

export function ArcadeDiscovery() {
  const [found, setFound] = useState(false);
  useEffect(() => {
    const sequence = ["j", "a", "c", "k"];
    let keys: string[] = [];
    let dismiss: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.key.length !== 1) return;
      keys = [...keys, event.key.toLowerCase()].slice(-sequence.length);
      if (keys.join("") !== sequence.join("")) return;
      keys = [];
      recordArcadeSecret("keys");
      setFound(true);
      if (dismiss) clearTimeout(dismiss);
      dismiss = setTimeout(() => setFound(false), 9000);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (dismiss) clearTimeout(dismiss);
    };
  }, []);

  return found ? <aside className="arcade-discovery" role="status" aria-live="polite">
    <span className="arcade-discovery-star" aria-hidden="true">✦</span>
    <span><strong>Secret found!</strong><small>Don’t give up. Hint: look for a rhythm in the name at the top left.</small></span>
    <Link href="/arcade" onClick={() => setFound(false)}>Play ↗</Link>
    <button type="button" aria-label="Dismiss secret found message" onClick={() => setFound(false)}>×</button>
  </aside> : null;
}
