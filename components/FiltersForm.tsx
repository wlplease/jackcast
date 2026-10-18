"use client";

import { useState, useTransition } from "react";
import { savePrefs } from "@/app/(main)/me/actions";
import { MAX_MUTES, QUALITY_LEVELS, normalizeMute, type Prefs } from "@/lib/prefs-shared";

const SUGGESTIONS = ["airdrop", "giveaway", "$degen", "gm", "follow back"];

export function FiltersForm({ initial, envDefault }: { initial: Prefs; envDefault: number }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const quality = prefs.quality ?? envDefault;

  function commit(next: Prefs) {
    setPrefs(next);
    setStatus("saving");
    start(async () => {
      const res = await savePrefs({ mutes: next.mutes, quality: next.quality, recasts: next.recasts, groupLinks: next.groupLinks });
      if (res.ok) {
        setPrefs(res.prefs);
        setStatus("saved");
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1800);
      } else {
        setStatus("error");
        setError(res.error);
      }
    });
  }

  function addTerms(raw: string) {
    setError(null);
    const terms = raw
      .split(",")
      .map(normalizeMute)
      .filter((t): t is string => !!t && !prefs.mutes.includes(t));
    if (!terms.length) {
      if (raw.trim()) setError("Already muted, or longer than 40 characters.");
      return;
    }
    if (prefs.mutes.length + terms.length > MAX_MUTES) {
      setError(`You can mute up to ${MAX_MUTES} things.`);
      return;
    }
    setDraft("");
    commit({ ...prefs, mutes: [...prefs.mutes, ...terms] });
  }

  return (
    <div className="filters" id="filters">
      <div className="field">
        <div className="field-head">
          <h3>Muted words</h3>
          <span className={`save-status ${status}`} aria-live="polite">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
        </div>
        <p className="field-hint">Casts containing these are hidden everywhere except your own posts. Works for words, phrases, $tickers, #tags and @handles.</p>
        <div className="chips">
          {prefs.mutes.map((m) => (
            <span key={m} className="chip">
              {m}
              <button
                type="button"
                aria-label={`Unmute ${m}`}
                onClick={() => commit({ ...prefs, mutes: prefs.mutes.filter((x) => x !== m) })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              </button>
            </span>
          ))}
          <input
            className="chip-input"
            value={draft}
            placeholder={prefs.mutes.length ? "Add another" : "Type a word and press enter"}
            aria-label="Add a muted word"
            onChange={(e) => {
              setError(null);
              const v = e.target.value;
              if (v.endsWith(",")) addTerms(v);
              else setDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTerms(draft);
              }
            }}
            onBlur={() => draft.trim() && addTerms(draft)}
          />
        </div>
        {!prefs.mutes.length && (
          <div className="suggest">
            Ideas:{" "}
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="linkish" onClick={() => addTerms(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="field">
        <div className="toggle-row">
          <div>
            <h3>Group repeated links</h3>
            <p className="field-hint">When posts share the same link, show the newest one first and tuck the others into an expandable group.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.groupLinks}
            aria-label="Group repeated links"
            className={`switch${prefs.groupLinks ? " on" : ""}`}
            onClick={() => commit({ ...prefs, groupLinks: !prefs.groupLinks })}
          ><span /></button>
        </div>
      </div>

      <div className="field">
        <div className="toggle-row">
          <div>
            <h3>Show recasts</h3>
            <p className="field-hint">
              Off keeps Following strictly chronological. A recast shows the original cast&apos;s time, so old posts would jump to the top.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.recasts}
            aria-label="Show recasts"
            className={`switch${prefs.recasts ? " on" : ""}`}
            onClick={() => commit({ ...prefs, recasts: !prefs.recasts })}
          >
            <span />
          </button>
        </div>
      </div>

      <div className="field">
        <h3>Quality dial</h3>
        <p className="field-hint">Hides accounts with a low Neynar quality score. Spam and bots mostly live at the bottom.</p>
        <div className="seg dial" role="radiogroup" aria-label="Quality dial">
          {QUALITY_LEVELS.map((l) => (
            <button
              key={l.label}
              type="button"
              role="radio"
              aria-checked={quality === l.value}
              className="seg-item"
              onClick={() => commit({ ...prefs, quality: l.value })}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="field-hint dial-hint">
          {QUALITY_LEVELS.find((l) => l.value === quality)?.hint ?? `Custom threshold: ${quality}`}
        </p>
      </div>
    </div>
  );
}
