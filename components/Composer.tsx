"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { uploadImage } from "@/lib/upload-client";
import { publish } from "@/app/actions";
import { prepareImage, randomName } from "@/lib/image";
import type { Author } from "@/lib/types";
import { withCastAttribution, MAX_CAST_BYTES } from "@/lib/cast-attribution";
import { Avatar } from "./Avatar";
import { GifMemePicker } from "./GifMemePicker";
import { EmojiPicker } from "./EmojiPicker";
import { trackUsage } from "@/components/UsageAnalytics";

const MAX_EMBEDS = 2;

type Photo = { id: string; preview: string; status: "uploading" | "done" | "error"; url?: string; error?: string };
type GifSelection = { url: string; preview: string; title: string };
export type QuoteTarget = { hash: string; fid: number; author: Author; text: string };

function uploadError(e: unknown): string {
  const msg = (e as Error)?.message ?? "";
  if (/Vercel Blob|BLOB_READ_WRITE_TOKEN|501/.test(msg)) {
    return "Photo uploads need Vercel Blob turned on. See the README.";
  }
  if (/client token/i.test(msg)) return "Upload wasn't authorized. Are you connected at /setup?";
  if ((e as Error)?.name === "TimeoutError" || /abort|timed? ?out/i.test(msg)) return "Upload timed out. Check your connection and try again.";
  return msg || "Upload failed";
}

export function Composer({
  me,
  parentHash,
  parentAuthorFid,
  channels = [],
  defaultChannel = "",
  placeholder = "What's happening?",
  id,
  initialText = "",
  initialLink = "",
  quote,
  afterPost,
  autoFocus,
}: {
  me: Author;
  parentHash?: string;
  parentAuthorFid?: number;
  channels?: string[];
  defaultChannel?: string;
  placeholder?: string;
  id?: string;
  initialText?: string;
  initialLink?: string;
  quote?: QuoteTarget;
  /** Where to go after posting. Defaults to staying and refreshing. */
  afterPost?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialText);
  const [channel, setChannel] = useState(defaultChannel);
  const [link, setLink] = useState(initialLink);
  const [showLink, setShowLink] = useState(Boolean(initialLink));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [gif, setGif] = useState<GifSelection | null>(null);
  const [quoted, setQuoted] = useState<QuoteTarget | undefined>(quote);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const [draftStatus, setDraftStatus] = useState<"idle" | "restored" | "saved">("idle");
  const draftReady = useRef(false);
  const draftKey = `selfcaster:draft:v1:${initialText || initialLink ? "share" : quote ? `quote:${quote.hash}` : parentHash ? `reply:${parentHash}` : `compose:${defaultChannel || "main"}`}`;

  useEffect(() => {
    if (ref.current) grow(ref.current);
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (initialText || initialLink || quote) {
      draftReady.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as { text?: unknown; link?: unknown; channel?: unknown };
        if (typeof draft.text === "string") setText(draft.text.slice(0, 5000));
        if (typeof draft.link === "string") { setLink(draft.link.slice(0, 2048)); setShowLink(Boolean(draft.link)); }
        if (typeof draft.channel === "string") setChannel(draft.channel.slice(0, 32));
        if (draft.text || draft.link) setDraftStatus("restored");
      }
    } catch {}
    draftReady.current = true;
  }, [draftKey, initialLink, initialText, quote]);

  useEffect(() => {
    if (!draftReady.current) return;
    const hasDraft = Boolean(text.trim() || link.trim());
    const timer = setTimeout(() => {
      try {
        if (hasDraft) {
          localStorage.setItem(draftKey, JSON.stringify({ text, link, channel }));
          setDraftStatus("saved");
        } else {
          localStorage.removeItem(draftKey);
          setDraftStatus("idle");
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [channel, draftKey, link, text]);

  function discardDraft() {
    try { localStorage.removeItem(draftKey); } catch {}
    setText("");
    setLink("");
    setShowLink(false);
    setDraftStatus("idle");
    if (ref.current) ref.current.style.height = "auto";
  }

  const bytes = new TextEncoder().encode(withCastAttribution(text)).length;
  const over = bytes > MAX_CAST_BYTES;
  const used = photos.length + (gif ? 1 : 0) + (link.trim() ? 1 : 0) + (quoted ? 1 : 0);
  const slotsLeft = MAX_EMBEDS - used;
  const uploading = photos.some((p) => p.status === "uploading");
  const empty = !text.trim() && !link.trim() && !quoted && !gif && !photos.some((p) => p.status === "done");

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  async function addFiles(files: File[]) {
    setError(null);
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!images.length) return;
    const room = MAX_EMBEDS - (photos.length + (gif ? 1 : 0) + (link.trim() ? 1 : 0) + (quoted ? 1 : 0));
    if (room <= 0) {
      setError("Farcaster allows 2 attachments per cast. Remove one first.");
      return;
    }
    if (images.length > room) setError(`Only ${room} more ${room === 1 ? "photo fits" : "photos fit"}, so I added the first ${room === 1 ? "one" : room}.`);
    for (const file of images.slice(0, room)) {
      const pid = Math.random().toString(36).slice(2);
      const preview = URL.createObjectURL(file);
      setPhotos((p) => [...p, { id: pid, preview, status: "uploading" }]);
      try {
        const prepared = await prepareImage(file);
        const blobUrl = await uploadImage(randomName("casts", prepared.ext), prepared.blob, prepared.type);
        setPhotos((p) => p.map((x) => (x.id === pid ? { ...x, status: "done", url: blobUrl } : x)));
      } catch (e) {
        setPhotos((p) => p.map((x) => (x.id === pid ? { ...x, status: "error", error: uploadError(e) } : x)));
      }
    }
  }

  function removePhoto(pid: string) {
    setPhotos((p) => {
      const gone = p.find((x) => x.id === pid);
      if (gone) URL.revokeObjectURL(gone.preview);
      return p.filter((x) => x.id !== pid);
    });
  }

  function selectGif(selection: GifSelection) {
    if (slotsLeft <= 0) { setError("Farcaster allows 2 attachments per cast. Remove one first."); return; }
    setGif(selection);
    setError(null);
  }

  function insertEmoji(emoji: string) {
    const textarea = ref.current;
    if (!textarea) {
      setText((current) => `${current}${current && !/\s$/.test(current) ? " " : ""}${emoji}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const prefix = before && !/\s$/.test(before) ? " " : "";
    const suffix = after && !/^\s/.test(after) ? " " : "";
    const insertion = `${prefix}${emoji}${suffix}`;
    setText(`${before}${insertion}${after}`);
    requestAnimationFrame(() => {
      textarea.focus();
      const position = start + insertion.length;
      textarea.setSelectionRange(position, position);
      grow(textarea);
    });
  }

  function submit() {
    if (empty || over || pending || uploading) return;
    if (photos.some((p) => p.status === "error")) {
      setError("Remove the photo that didn't upload, then try again.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await publish({
        text,
        parentHash,
        parentAuthorFid,
        channelId: channel || undefined,
        embedUrls: [...photos.map((p) => p.url!).filter(Boolean), ...(gif ? [gif.url] : []), ...(link.trim() ? [link.trim()] : [])],
        quote: quoted ? { hash: quoted.hash, fid: quoted.fid } : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      trackUsage({ name: "cast_published", kind: parentHash ? "reply" : quoted ? "quote" : "cast" });
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      try { localStorage.removeItem(draftKey); } catch {}
      setDraftStatus("idle");
      setText("");
      setLink("");
      setShowLink(false);
      setPhotos([]);
      setGif(null);
      setQuoted(undefined);
      if (ref.current) ref.current.style.height = "auto";
      if (afterPost) {
        router.push(afterPost);
        return;
      }
      setSent(true);
      setTimeout(() => setSent(false), 2500);
      router.refresh();
    });
  }

  const channelOptions = Array.from(new Set([defaultChannel, ...channels].filter(Boolean))).sort((a, b) => a.localeCompare(b));

  return (
    <div
      className={`composer${dragging ? " dragging" : ""}`}
      id={id}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <Avatar user={me} />
      <div style={{ minWidth: 0 }}>
        <div className="composer-identity">Posting as <strong>@{me.username || `fid-${me.fid}`}</strong> · <Link href="/setup">switch account</Link></div>
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder={quoted ? "Add your take" : placeholder}
          aria-label={parentHash ? "Reply" : "New cast"}
          onChange={(e) => {
            setText(e.target.value);
            grow(e.target);
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.some((f) => f.type.startsWith("image/"))) {
              e.preventDefault();
              addFiles(files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />

        {photos.length > 0 && (
          <div className={`attach-grid n${photos.length}`}>
            {photos.map((p) => (
              <div key={p.id} className={`attach ${p.status}`}>
                <img src={p.preview} alt="" />
                {p.status === "uploading" && <span className="attach-status">Uploading…</span>}
                {p.status === "error" && <span className="attach-status err">{p.error}</span>}
                <button type="button" className="attach-x" onClick={() => removePhoto(p.id)} aria-label="Remove photo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {gif && <div className="composer-gif-preview"><img src={gif.url} alt={gif.title || "Selected GIF"} /><button type="button" className="attach-x" onClick={() => setGif(null)} aria-label="Remove GIF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>}


        {quoted && (
          <div className="quote composer-quote">
            <div className="q-head">
              <Avatar user={quoted.author} size="sm" />
              <span>{quoted.author.display_name || quoted.author.username}</span>
              <button type="button" className="attach-x inline" onClick={() => setQuoted(undefined)} aria-label="Remove quote">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="q-text">{quoted.text.length > 220 ? quoted.text.slice(0, 220) + "…" : quoted.text}</div>
          </div>
        )}

        {showLink && (
          <div className="composer-bar" style={{ borderTop: 0, paddingTop: 0, marginBottom: 8 }}>
            <input type="url" placeholder="https:// link to embed" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Embed URL" />
          </div>
        )}

        <div className="composer-bar">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="tool"
            onClick={() => fileRef.current?.click()}
            disabled={slotsLeft <= 0}
            aria-label="Add photos"
            title="Add photos"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="M21 16l-5-5-9 9" />
            </svg>
          </button>
          <GifMemePicker disabled={slotsLeft <= 0} onSelect={selectGif} onMeme={(file) => { void addFiles([file]); }} />
          <EmojiPicker onSelect={insertEmoji} />
          <button
            type="button"
            className="tool"
            onClick={() => setShowLink((v) => !v)}
            disabled={!showLink && slotsLeft <= 0}
            aria-label={showLink ? "Remove link" : "Add link"}
            aria-pressed={showLink}
            title="Add link"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
          </button>
          {!parentHash && channelOptions.length > 0 && (
            <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
              <option value="">no channel</option>
              {channelOptions.map((c) => (
                <option key={c} value={c}>
                  /{c}
                </option>
              ))}
            </select>
          )}
          <span className={`count${over ? " over" : ""}`} title="Bytes remaining after the Jackcast attribution">{MAX_CAST_BYTES - bytes}</span>
          <div className="composer-actions">
            {!parentHash && !quoted && <Link className="btn ghost sm thread-compose-button" href="/compose/thread">Thread</Link>}
            <button className="btn" onClick={submit} disabled={empty || over || pending || uploading}>
              {pending ? "Casting…" : uploading ? "Uploading…" : parentHash ? "Reply" : quoted ? "Quote" : "Cast"}
            </button>
          </div>
        </div>
        <div className="composer-attribution">This source link identifies the app; the author is the account shown above. <a href="https://jackcast.vercel.app" target="_blank" rel="noreferrer">Jackcast</a>.</div>
        {dragging && <div className="drop-hint">Drop photos to attach</div>}
        {draftStatus !== "idle" && <div className="draft-note" role="status">Draft {draftStatus === "restored" ? "restored" : "saved"} on this device. <button type="button" onClick={discardDraft}>Discard</button></div>}
        {error && <div className="form-error">{error}{/result is unclear/i.test(error) && <> <Link href="/sent" className="linkish">Check Sent</Link></>}</div>}
        {sent && <div className="form-ok">Sent.</div>}
      </div>
    </div>
  );
}
