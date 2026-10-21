"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishThread } from "@/app/actions";
import { withCastAttribution, MAX_CAST_BYTES } from "@/lib/cast-attribution";
import { prepareImage, randomName } from "@/lib/image";
import { uploadImage } from "@/lib/upload-client";
import { GifMemePicker } from "@/components/GifMemePicker";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useServiceDisabled } from "@/components/OptionalServicesProvider";

const MAX_CASTS = 5;
const MAX_EMBEDS = 2;
const DRAFT_KEY = "selfcaster:draft:thread:v1";
type ThreadPart = { text: string; embedUrls: string[]; linkDraft: string; linkOpen: boolean; uploads: number };
type SavedPart = { text: string; embedUrls: string[] };
const newPart = (): ThreadPart => ({ text: "", embedUrls: [], linkDraft: "", linkOpen: false, uploads: 0 });

function savedPart(part: ThreadPart): SavedPart { return { text: part.text, embedUrls: part.embedUrls }; }
function isImageUrl(value: string) {
  try { const url = new URL(value); return /\.(gif|jpe?g|png|webp|avif)$/i.test(url.pathname) || /(^|\.)media\d*\.giphy\.com$/i.test(url.hostname); }
  catch { return false; }
}

export function ThreadComposer({ username }: { username: string }) {
  const router = useRouter();
  const composerRef = useRef<HTMLElement>(null);
  const textareaRefs = useRef(new Map<number, HTMLTextAreaElement>());
  const fileRefs = useRef(new Map<number, HTMLInputElement>());
  const giphyDisabled = useServiceDisabled("giphy");
  const [casts, setCasts] = useState<ThreadPart[]>([newPart(), newPart()]);
  const [resumeParent, setResumeParent] = useState<string>();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      const parsed = Array.isArray(raw) ? { casts: raw } : raw as { casts?: unknown; parentHash?: unknown } | null;
      if (parsed && Array.isArray(parsed.casts)) {
        const draft = parsed.casts.slice(0, MAX_CASTS).flatMap((item): ThreadPart[] => {
          if (typeof item === "string") return [{ ...newPart(), text: item.slice(0, 5000) }];
          if (!item || typeof item !== "object") return [];
          const part = item as { text?: unknown; embedUrls?: unknown };
          if (typeof part.text !== "string" || !Array.isArray(part.embedUrls) || part.embedUrls.length > MAX_EMBEDS || !part.embedUrls.every((url) => typeof url === "string" && url.length <= 256)) return [];
          return [{ ...newPart(), text: part.text.slice(0, 5000), embedUrls: part.embedUrls as string[] }];
        });
        const parent = typeof parsed.parentHash === "string" && /^0x[0-9a-f]{40}$/i.test(parsed.parentHash) ? parsed.parentHash : undefined;
        if (draft.some((part) => part.text.trim() || part.embedUrls.length)) setCasts(draft.length >= 2 || parent ? draft : [...draft, newPart()]);
        if (parent) setResumeParent(parent);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    const fields = composerRef.current?.querySelectorAll("textarea");
    fields?.forEach((field) => {
      field.style.height = "auto";
      field.style.height = `${Math.max(field.scrollHeight, 94)}px`;
    });
  }, [casts]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        if (casts.some((part) => part.text.trim() || part.embedUrls.length)) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ casts: casts.map(savedPart), parentHash: resumeParent }));
          setSaved(true);
        } else {
          localStorage.removeItem(DRAFT_KEY);
          setSaved(false);
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [casts, ready, resumeParent]);

  function updatePart(index: number, update: (part: ThreadPart) => ThreadPart) {
    setCasts((current) => current.map((part, i) => i === index ? update(part) : part));
  }

  async function addFiles(index: number, files: File[]) {
    const part = casts[index];
    if (!part) return;
    const room = MAX_EMBEDS - part.embedUrls.length - part.uploads;
    const selected = files.filter((file) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)).slice(0, Math.max(0, room));
    if (files.length > selected.length) setError(`Each cast can have up to ${MAX_EMBEDS} photos, GIFs, or links.`);
    if (!selected.length) return;
    updatePart(index, (current) => ({ ...current, uploads: current.uploads + selected.length }));
    for (const file of selected) {
      try {
        const prepared = await prepareImage(file);
        const url = await uploadImage(randomName("casts", prepared.ext), prepared.blob, prepared.type);
        updatePart(index, (current) => ({ ...current, embedUrls: [...current.embedUrls, url], uploads: Math.max(0, current.uploads - 1) }));
      } catch (reason) {
        updatePart(index, (current) => ({ ...current, uploads: Math.max(0, current.uploads - 1) }));
        setError(reason instanceof Error ? reason.message : "Photo upload failed. Try again.");
      }
    }
  }

  function addEmbed(index: number, url: string) {
    const part = casts[index];
    if (!part || part.embedUrls.length + part.uploads >= MAX_EMBEDS) {
      setError(`Each cast can have up to ${MAX_EMBEDS} photos, GIFs, or links.`);
      return;
    }
    setError("");
    updatePart(index, (current) => ({ ...current, embedUrls: [...current.embedUrls, url] }));
  }

  function addLink(index: number) {
    const value = casts[index]?.linkDraft.trim() ?? "";
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol) || url.href.length > 256) throw new Error();
      addEmbed(index, url.href);
      updatePart(index, (part) => ({ ...part, linkDraft: "", linkOpen: false }));
    } catch {
      setError("Enter a valid public link under 256 characters.");
    }
  }

  function insertEmoji(index: number, emoji: string) {
    const field = textareaRefs.current.get(index);
    const part = casts[index];
    if (!field || !part) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const before = part.text.slice(0, start);
    const after = part.text.slice(end);
    const insertion = `${before && !/\s$/.test(before) ? " " : ""}${emoji}${after && !/^\s/.test(after) ? " " : ""}`;
    const text = `${before}${insertion}${after}`;
    updatePart(index, (current) => ({ ...current, text }));
    requestAnimationFrame(() => {
      field.focus();
      const position = start + insertion.length;
      field.setSelectionRange(position, position);
    });
  }

  function submit() {
    if (pending || casts.some((part) => part.uploads > 0)) return;
    setError("");
    start(async () => {
      const result = await publishThread({ casts: casts.map((part) => ({ text: part.text, embedUrls: part.embedUrls })), parentHash: resumeParent });
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

  const invalid = casts.length < (resumeParent ? 1 : 2) || casts.some((part) => {
    const text = withCastAttribution(part.text);
    return (!part.text.trim() && !part.embedUrls.length) || new TextEncoder().encode(text).length > MAX_CAST_BYTES || part.embedUrls.length > MAX_EMBEDS;
  });

  return (
    <section ref={composerRef} className="thread-composer">
      <div className="thread-intro">
        <div>
          <h1>Write a thread</h1>
          <p>Posting as <strong>@{username}</strong> · each cast replies to the one before it. Up to {MAX_CASTS} casts.</p>
        </div>
        <span className="draft-note">{saved ? "Draft saved on this device" : "Drafts stay on this device"}</span>
      </div>
      {casts.map((part, index) => {
        const bytes = new TextEncoder().encode(withCastAttribution(part.text)).length;
        const slotsLeft = MAX_EMBEDS - part.embedUrls.length - part.uploads;
        return (
          <div className="thread-part" key={index}>
            <label className="thread-part-label" htmlFor={`thread-cast-${index}`}>Cast {index + 1}{resumeParent && index === 0 ? " (resume here)" : ""}</label>
            <textarea
              id={`thread-cast-${index}`}
              ref={(field) => { if (field) textareaRefs.current.set(index, field); else textareaRefs.current.delete(index); }}
              value={part.text}
              rows={4}
              aria-label={`Thread cast ${index + 1}`}
              placeholder={index === 0 && resumeParent ? "Continue the thread here" : "Write this part of your thread…"}
              onChange={(event) => updatePart(index, (current) => ({ ...current, text: event.target.value }))}
            />
            {part.embedUrls.length > 0 && <div className="thread-attachments">
              {part.embedUrls.map((url, embedIndex) => <div className="thread-attachment" key={`${url}-${embedIndex}`}>
                {isImageUrl(url) ? <img src={url} alt="Thread attachment preview" /> : <a href={url} target="_blank" rel="noreferrer">{url}</a>}
                <button type="button" className="attach-x" aria-label={`Remove attachment ${embedIndex + 1} from cast ${index + 1}`} onClick={() => updatePart(index, (current) => ({ ...current, embedUrls: current.embedUrls.filter((_, i) => i !== embedIndex) }))}>×</button>
              </div>)}
            </div>}
            {part.linkOpen && <div className="composer-bar thread-link-row"><input type="url" placeholder="https:// link to embed" aria-label={`Link for cast ${index + 1}`} value={part.linkDraft} onChange={(event) => updatePart(index, (current) => ({ ...current, linkDraft: event.target.value }))} /><button type="button" className="btn ghost sm" onClick={() => addLink(index)}>Add link</button></div>}
            <div className="composer-bar thread-part-tools">
              <input ref={(field) => { if (field) fileRefs.current.set(index, field); else fileRefs.current.delete(index); }} type="file" accept="image/*" multiple hidden aria-label={`Photos for cast ${index + 1}`} onChange={(event) => { void addFiles(index, Array.from(event.target.files ?? [])); event.target.value = ""; }} />
              <button type="button" className="tool" disabled={slotsLeft <= 0 || part.uploads > 0} onClick={() => fileRefs.current.get(index)?.click()} aria-label={`Add photos to cast ${index + 1}`} title="Add photos"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></svg></button>
              {!giphyDisabled && <GifMemePicker disabled={slotsLeft <= 0 || part.uploads > 0} onSelect={(gif) => addEmbed(index, gif.url)} onMeme={(file) => { void addFiles(index, [file]); }} />}
              <EmojiPicker onSelect={(emoji) => insertEmoji(index, emoji)} />
              <button type="button" className="tool" disabled={!part.linkOpen && slotsLeft <= 0} aria-label={part.linkOpen ? "Cancel adding link" : `Add link to cast ${index + 1}`} aria-pressed={part.linkOpen} title="Add link" onClick={() => updatePart(index, (current) => ({ ...current, linkOpen: !current.linkOpen }))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg></button>
              {part.uploads > 0 && <span className="thread-upload-note">Uploading {part.uploads}…</span>}
              <span className={`thread-count${bytes > MAX_CAST_BYTES ? " over" : ""}`}>{bytes}/{MAX_CAST_BYTES} bytes incl. source</span>
            </div>
          </div>
        );
      })}
      {casts.length < MAX_CASTS && <button type="button" className="thread-add" onClick={() => setCasts((current) => [...current, newPart()])}>+ Add another cast</button>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="thread-actions">
        <button type="button" className="quiet" onClick={() => router.back()}>Cancel</button>
        <button type="button" className="btn" onClick={submit} disabled={pending || invalid || casts.some((part) => part.uploads > 0)}>{pending ? "Posting thread…" : resumeParent ? "Resume thread" : "Post thread"}</button>
      </div>
      <p className="field-hint">Each cast supports up to two photos, GIFs, or links. Posts are sent in order. If one fails, the app keeps the unsent text and attachments so you can check your profile and resume.</p>
    </section>
  );
}
