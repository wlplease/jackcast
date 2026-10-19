"use client";

import { BRAND } from "@/lib/brand";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

export function Wordmark() {
  const [secret, setSecret] = useState(false);
  const taps = useRef<number[]>([]);
  const revealArcade = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((time) => now - time < 1800), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      setSecret(true);
      window.setTimeout(() => setSecret(false), 5500);
    }
  };
  return (
    <span className="wordmark-secret-wrap">
      <span className="wordmark-mark" aria-label="Jackcaster" onClick={revealArcade}>
        <Image src="/jackcaster-icon.svg?v=3" width={32} height={32} alt="" aria-hidden="true" priority />
        <span>{BRAND.wordmark.first}<em>{BRAND.wordmark.second}</em></span>
      </span>
      {secret && <Link className="wordmark-arcade-link" href="/arcade">↟ Jumping Jacks <span>hidden game</span></Link>}
    </span>
  );
}
