"use client";

import { useState } from "react";

/* eslint-disable @next/next/no-img-element */
export function MiniAppIcon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="miniapp-card-icon miniapp-placeholder" aria-hidden="true">✳</span>;
  return <span className="miniapp-card-icon"><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></span>;
}
