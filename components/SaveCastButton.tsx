"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSavedCasts } from "@/components/SavedCastsProvider";

export function SaveCastButton({ hash }: { hash: string }) {
  const { hashes, toggle, collections, collectionFor, move } = useSavedCasts();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const saved = hashes.has(hash.toLowerCase());

  async function onClick() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await toggle(hash);
      if (!result.ok) setError(result.error);
      else if (pathname === "/saved") router.refresh();
    } catch {
      setError("Could not update your saved casts. Try again.");
    } finally { setPending(false); }
  }

  async function onMove(collectionId: string) {
    if (moving) return;
    setMoving(true);
    setError("");
    try {
      const result = await move(hash, collectionId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch { setError("Could not move this cast. Try again."); }
    finally { setMoving(false); }
  }

  return <>
    <button type="button" className={`act save-cast${saved ? " saved" : ""}`} onClick={onClick} disabled={pending} aria-label={saved ? "Remove from saved casts" : "Save cast for later"} aria-pressed={saved} title={saved ? "Saved" : "Save for later"}>
      <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-4-6 4V4.8Z" /></svg>
    </button>
    {saved && pathname === "/saved" && <select className="saved-cast-collection" aria-label="Move saved cast to collection" title="Move to collection" value={collectionFor(hash)} disabled={moving} onChange={(event) => void onMove(event.target.value)}>
      {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
    </select>}
    {error && <span className="act-error" role="status">{error}</span>}
  </>;
}
