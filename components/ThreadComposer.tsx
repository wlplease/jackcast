"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishThread } from "@/app/actions";
import { withCastAttribution, MAX_CAST_BYTES } from "@/lib/cast-attribution";

const MAX_CASTS = 5;
const DRAFT_KEY = "selfcaster:draft:thread:v1";

export function ThreadComposer({ username }: { username: string }) {
  const router = useRouter();
  const [casts, setCasts] = useState(["", ""]);
  const [resumeParent, setResumeParent] = useState<string>();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      const parsed = Array.isArray(raw) ? { casts: raw } : raw as { casts?: unknown; parentHash?: unknown } | null;
      if (parsed && Array.isArray(parsed.casts) && parsed.casts.every((item) => typeof item === "string")) {
        const draft = parsed.casts.slice(0, MAX_CASTS).map((item) => (item as string).slice(0, 5000));
        const parent = typeof parsed.parentHash === "string" && /^0x[0-9a-f]{40}$/i.test(parsed.parentHash) ? parsed.parentHash : undefined;
        if (draft.some((item) => item.trim())) setCasts(draft.length >= 2 || parent ? draft : [...draft, ""]);
        if (parent) setResumeParent(parent);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        if (casts.some((text) => text.trim())) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ casts, parentHash: resumeParent }));
          setSaved(true);
        } else {
          localStorage.removeItem(DRAFT_KEY);
          setSaved(false);
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [casts, ready, resumeParent]);

  function submit() {
    if (pending) return;
    setError("");
    start(async () => {
      const result = await publishThread({ casts, parentHash: resumeParent });
      if (result.ok) {
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        setSaved(false);
        router.push("/");
        return;
      }
      if (result.posted > 0) {
        setCasts((current) => current.slice(result.posted));
        setResumeParent(result.lastHash ?? undefined);
      }
      setError(`${result.posted > 0 ? `${result.posted} cast${result.posted === 1 ? "" : "s"} sent. ` : ""}${result.error} Check whether the failed cast appeared on your profile before you resume, to avoid a duplicate.`);
    });
  }

  const invalid = casts.length < (resumeParent ? 1 : 2) || casts.some((text) => !text.trim() || new TextEncoder().encode(withCastAttribution(text)).length > MAX_CAST_BYTES);

  return (
    <section className="thread-composer">
      <div className="thread-intro">
        <div>
          <h1>Write a thread</h1>
          <p>Posting as <strong>@{username}</strong> · each cast replies to the one before it. Up to {MAX_CASTS} casts.</p>
        </div>
        <span className="draft-note">{saved ? "Draft saved on this device" : "Drafts stay on this device"}</span>
      </div>
      {casts.map((text, index) => {
        const bytes = new TextEncoder().encode(withCastAttribution(text)).length;
        return (
          <label className="thread-part" key={index}>
            <span className="thread-part-label">Cast {index + 1}{resumeParent && index === 0 ? " (resume here)" : ""}</span>
            <textarea
              value={text}
              rows={4}
              aria-label={`Thread cast ${index + 1}`}
              placeholder={index === 0 && resumeParent ? "Continue the thread here" : "Write this part of your thread…"}
              onChange={(event) => setCasts((current) => current.map((item, i) => i === index ? event.target.value : item))}
            />
            <span className={`thread-count${bytes > MAX_CAST_BYTES ? " over" : ""}`}>{bytes}/{MAX_CAST_BYTES} bytes incl. source</span>
          </label>
        );
      })}
      {casts.length < MAX_CASTS && <button type="button" className="thread-add" onClick={() => setCasts((current) => [...current, ""])}>+ Add another cast</button>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="thread-actions">
        <button type="button" className="quiet" onClick={() => router.back()}>Cancel</button>
        <button type="button" className="btn" onClick={submit} disabled={pending || invalid}>{pending ? "Posting thread…" : resumeParent ? "Resume thread" : "Post thread"}</button>
      </div>
      <p className="field-hint">Posts are sent in order. If one fails, the app keeps the unsent text so you can check your profile and resume.</p>
    </section>
  );
}
