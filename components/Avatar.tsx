/* eslint-disable @next/next/no-img-element */
import type { Author } from "@/lib/types";

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e4e1dc"/><circle cx="20" cy="16" r="7" fill="#a8a49e"/><rect x="8" y="27" width="24" height="14" rx="7" fill="#a8a49e"/></svg>'
  );

export function Avatar({ user, size }: { user: Author; size?: "sm" }) {
  const src = user.pfp_url || FALLBACK;
  const videoPfp = /\.(?:mp4|webm)(?:[?#]|$)/i.test(src);
  if (videoPfp) {
    return <video className={`avatar${size === "sm" ? " sm" : ""} avatar-motion`} src={src} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />;
  }
  return (
    <img
      className={`avatar${size === "sm" ? " sm" : ""}`}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
