"use client";

import { useState, useTransition } from "react";
import { savePrefs } from "@/app/(main)/me/actions";
import { MODES, THEMES, themeCss, type Mode, type ThemeId, type Tokens } from "@/lib/themes";

const MODE_LABEL: Record<Mode, string> = { auto: "Auto", light: "Light", dark: "Dark" };

/** Applies a theme right away, before the save round trip finishes. */
function apply(theme: ThemeId, mode: Mode) {
  const el = document.getElementById("sc-theme");
  if (el) el.textContent = themeCss(theme, mode);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
}

function Mini({ t }: { t: Tokens }) {
  return (
    <span className="mini" style={{ background: t.paper, borderColor: t.rule }}>
      <span className="mini-bar" style={{ background: t.brand }} />
      <span className="mini-line" style={{ background: t.ink }} />
      <span className="mini-line short" style={{ background: t.ink3 }} />
      <span className="mini-row">
        <span className="mini-chan" style={{ color: t.accent }}>/chan</span>
        <span className="mini-btn" style={{ background: t.brand, color: t.onBrand }}>Cast</span>
      </span>
    </span>
  );
}

export function ThemeForm({ initialTheme, initialMode }: { initialTheme: ThemeId; initialMode: Mode }) {
  const [theme, setTheme] = useState(initialTheme);
  const [mode, setMode] = useState(initialMode);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, start] = useTransition();

  function choose(next: { theme?: ThemeId; mode?: Mode }) {
    const th = next.theme ?? theme;
    const mo = next.mode ?? mode;
    setTheme(th);
    setMode(mo);
    apply(th, mo);
    setStatus("saving");
    start(async () => {
      const res = await savePrefs(next);
      setStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1800);
    });
  }

  return (
    <div className="filters" id="theme">
      <div className="field">
        <div className="field-head">
          <h3>Theme</h3>
          <span className={`save-status ${status}`} aria-live="polite">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save" : ""}
          </span>
        </div>
        <div className="theme-grid" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              className={`theme-card${theme === t.id ? " on" : ""}`}
              onClick={() => choose({ theme: t.id })}
            >
              <span className="theme-minis" aria-hidden="true">
                <Mini t={t.light} />
                <Mini t={t.dark} />
              </span>
              <span className="theme-name">{t.label}</span>
              <span className="theme-note">{t.note}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <h3>Light or dark</h3>
        <div className="seg dial" role="radiogroup" aria-label="Light or dark">
          {MODES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className="seg-item" onClick={() => choose({ mode: m })}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="field-hint dial-hint">{mode === "auto" ? "Follows your phone's setting." : `Always ${mode}, whatever your phone says.`}</p>
      </div>
    </div>
  );
}
