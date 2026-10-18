/* eslint-disable @next/next/no-img-element */
import type { Author } from "@/lib/types";

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e4e1dc"/><circle cx="20" cy="16" r="7" fill="#a8a49e"/><rect x="8" y="27" width="24" height="14" rx="7" fill="#a8a49e"/></svg>'
  );

export function Avatar({ user, size }: { user: Author; size?: "sm" }) {
  return (
    <img
      className={`avatar${size === "sm" ? " sm" : ""}`}
      src={user.pfp_url || FALLBACK}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
