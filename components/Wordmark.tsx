"use client";

import { BRAND } from "@/lib/brand";
import { useEffect, useRef, useState } from "react";
import { recordArcadeSecret } from "@/lib/arcade-client";
import { useRouter } from "next/navigation";

export function Wordmark() {
  const router = useRouter();
  const [secret, setSecret] = useState(false);
  const taps = useRef<number[]>([]);
  const dismiss = useRef<number | null>(null);
  useEffect(() => () => { if (dismiss.current !== null) window.clearTimeout(dismiss.current); }, []);
  const revealArcade = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((time) => now - time < 1800), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      recordArcadeSecret("wordmark");
      setSecret(true);
      if (dismiss.current !== null) window.clearTimeout(dismiss.current);
      dismiss.current = window.setTimeout(() => setSecret(false), 5500);
    }
  };
  return (
    <span className="wordmark-secret-wrap">
      <span className="wordmark-trigger" aria-label="Jackcaster" onClick={revealArcade}>
        <svg className="wordmark-mark wordmark-mark-inline" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <rect width="32" height="32" rx="8" fill="#07584f" />
          <path d="m16 4.5 11.5 11.5-4.6 4.6-3.7-3.7V28h-6.4V16.9l-3.7 3.7L4.5 16 16 4.5Z" fill="#fff" />
          <circle cx="25" cy="7" r="2" fill="#f3a2ce" />
        </svg>
        <span>{BRAND.wordmark.first}<em>{BRAND.wordmark.second}</em></span>
      </span>
      {secret && <button type="button" className="wordmark-arcade-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSecret(false); router.push("/arcade"); }}><strong>Secret found!</strong><span>Don’t give up — hint: another path takes four keys.</span><b>↟ Jumping Jacks →</b></button>}
    </span>
  );
}
