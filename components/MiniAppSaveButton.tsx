"use client";

import { useEffect, useState, useTransition } from "react";
import { savePrefs } from "@/app/(main)/me/actions";
import type { Prefs } from "@/lib/prefs-shared";

type SavedMiniApp = Prefs["savedMiniApps"][number];

export function MiniAppSaveButton({ app, saved, allSaved, onSaved }: { app: SavedMiniApp; saved: boolean; allSaved: SavedMiniApp[]; onSaved: (items: SavedMiniApp[]) => void }) {
  const [isSaved, setIsSaved] = useState(saved);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  useEffect(() => setIsSaved(saved), [saved]);
  function toggle() {
    if (pending) return;
    const next = !isSaved;
    setIsSaved(next);
    setError("");
    start(async () => {
      if (next && allSaved.length >= 6) {
        setIsSaved(false);
        setError("You can save up to 6 mini apps on this device. Remove one first.");
        return;
      }
      const updated = next ? [...allSaved.filter((item) => item.url !== app.url), app] : allSaved.filter((item) => item.url !== app.url);
      const result = await savePrefs({ savedMiniApps: updated });
      if (result.ok) onSaved(result.prefs.savedMiniApps);
      else { setIsSaved(!next); setError(result.error); }
    });
  }
  return <span className="miniapp-save-wrap"><button type="button" className={`miniapp-save${isSaved ? " saved" : ""}`} aria-pressed={isSaved} onClick={toggle} disabled={pending} title={isSaved ? "Remove saved app" : "Save mini app"}>{pending ? "…" : isSaved ? "Saved" : "＋ Save"}</button>{error && <small className="form-error" role="status">{error}</small>}</span>;
}
