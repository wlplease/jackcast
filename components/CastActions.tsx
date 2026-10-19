"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOwnCast, react } from "@/app/actions";
import { savePrefs } from "@/app/(main)/me/actions";
import { compact } from "@/lib/format";
import { MAX_MUTES, normalizeMute } from "@/lib/prefs-shared";
import { SaveCastButton } from "@/components/SaveCastButton";
import { withCastAttribution } from "@/lib/cast-attribution";
import { trackUsage } from "@/components/UsageAnalytics";

type State = { liked: boolean; recasted: boolean; likes: number; recasts: number };

const Icon = {
  reply: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  ),
  recast: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h4v4c0 3-1.5 5-4 6" /><path d="M14 7h4v4c0 3-1.5 5-4 6" />
    </svg>
  ),
  like: (filled: boolean) => (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.8 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.5 0 5.6 3.5 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" />
    </svg>
  ),
};

export function CastActions(props: {
  hash: string;
  text: string;
  authorFid: number;
  replies: number;
  likes: number;
  recasts: number;
  liked: boolean;
  recasted: boolean;
  canWrite: boolean;
  authorUsername?: string;
  viewerFid?: number;
  mutes?: string[];
}) {
  // Local state that sticks after the request finishes. (useOptimistic snaps back to the
  // server value when the action ends, which made likes look like they didn't register.)
  const [state, setState] = useState<State>({
    liked: props.liked,
    recasted: props.recasted,
    likes: props.likes,
    recasts: props.recasts,
  });
  const [busy, setBusy] = useState<"like" | "recast" | null>(null);
  const [muteBusy, setMuteBusy] = useState(false);
  const [muted, setMuted] = useState(() => Boolean(props.authorUsername && props.mutes?.includes(`@${props.authorUsername.toLowerCase()}`)));
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const router = useRouter();
  const touched = useRef(false);

  useEffect(() => {
    setMuted(Boolean(props.authorUsername && props.mutes?.includes(`@${props.authorUsername.toLowerCase()}`)));
  }, [props.authorUsername, props.mutes]);

  // Fresh server data can update us, but never undo something you just tapped
  // (Neynar can take a moment to reflect a new reaction).
  useEffect(() => {
    if (touched.current) return;
    setState({ liked: props.liked, recasted: props.recasted, likes: props.likes, recasts: props.recasts });
  }, [props.liked, props.recasted, props.likes, props.recasts]);

  async function toggle(kind: "like" | "recast") {
    if (busy) return;
    touched.current = true;
    setError(null);
    const before = state;
    const on = kind === "like" ? !state.liked : !state.recasted;
    setState(
      kind === "like"
        ? { ...state, liked: on, likes: Math.max(0, state.likes + (on ? 1 : -1)) }
        : { ...state, recasted: on, recasts: Math.max(0, state.recasts + (on ? 1 : -1)) }
    );
    setBusy(kind);
    try {
      const res = await react({ hash: props.hash, authorFid: props.authorFid, kind, on });
      if (!res.ok) {
        setState(before);
        setError(res.error);
      }
    } catch {
      setState(before);
      setError("Couldn't reach Farcaster. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleMute() {
    if (!props.authorUsername || muteBusy) return;
    const term = normalizeMute(`@${props.authorUsername}`);
    if (!term) return;
    const current = props.mutes ?? [];
    const next = muted ? current.filter((item) => item !== term) : [...current, term];
    if (!muted && next.length > MAX_MUTES) {
      setError(`Your mute list is full (${MAX_MUTES}). Remove a term in You → Filters first.`);
      return;
    }
    setMuteBusy(true);
    setError(null);
    try {
      const result = await savePrefs({ mutes: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMuted(!muted);
      router.refresh();
    } catch {
      setError("Couldn't update your mute list. Please try again.");
    } finally {
      setMuteBusy(false);
    }
  }

  async function shareCast() {
    setShareMessage(null);
    const castUrl = `https://farcaster.xyz/${props.authorUsername ? `${props.authorUsername}/` : "~/"}${props.hash}`;
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      if (await sdk.isInMiniApp()) {
        await sdk.actions.composeCast({ text: withCastAttribution("Sharing this cast on Jackcaster"), embeds: [castUrl] });
        return;
      }
    } catch {
      // The SDK is only available when Jackcaster is hosted by Farcaster.
    }
    const composeUrl = `/compose?url=${encodeURIComponent(castUrl)}&text=${encodeURIComponent("Sharing this cast on Jackcaster")}`;
    window.location.assign(composeUrl);
  }

  async function copyValue(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setShareMessage(message);
    } catch {
      setShareMessage("Clipboard access is unavailable in this browser.");
    }
  }

  async function deleteCast() {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const result = await deleteOwnCast({ hash: props.hash });
      if (!result.ok) { setError(result.error); return; }
      trackUsage({ name: "cast_deleted" });
      setConfirmDelete(false);
      setShareMessage("Cast deleted.");
      router.refresh();
    } catch {
      setError("Couldn't delete this cast. Try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  return (
    <div className="actions">
      <Link className="act" href={`/cast/${props.hash}#reply`} aria-label="Reply">
        {Icon.reply}
        {props.replies > 0 && compact(props.replies)}
      </Link>
      {props.canWrite ? <button
        className={`act${state.recasted ? " recasted" : ""}`}
        onClick={() => toggle("recast")}
        disabled={!props.canWrite || busy !== null}
        aria-label={state.recasted ? "Undo recast" : "Recast"}
        aria-pressed={state.recasted}
      >
        {Icon.recast}
        {state.recasts > 0 && compact(state.recasts)}
      </button> : <Link className="act" href="/setup" aria-label="Connect to recast" title="Connect to recast">{Icon.recast}{state.recasts > 0 && compact(state.recasts)}</Link>}
      {props.canWrite && (
        <Link className="act" href={`/compose?quote=${props.hash}`} aria-label="Quote cast" title="Quote">
          {Icon.quote}
        </Link>
      )}
      {props.canWrite ? <button
        className={`act${state.liked ? " liked" : ""}`}
        onClick={() => toggle("like")}
        disabled={!props.canWrite || busy !== null}
        aria-label={state.liked ? "Unlike" : "Like"}
        aria-pressed={state.liked}
      >
        {Icon.like(state.liked)}
        {state.likes > 0 && compact(state.likes)}
      </button> : <Link className="act" href="/setup" aria-label="Connect to like" title="Connect to like">{Icon.like(false)}{state.likes > 0 && compact(state.likes)}</Link>}
      <button type="button" className="act" onClick={shareCast} aria-label="Share as a cast" title="Share as a cast">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2" /></svg>
      </button>
      <SaveCastButton hash={props.hash} />
      {shareMessage && <span className="share-status" role="status">{shareMessage}</span>}
      <details className="cast-menu">
        <summary className="act" aria-label="More cast options" title="More cast options">•••</summary>
        <div className="cast-menu-panel">
          <button type="button" onClick={() => void copyValue(props.text, "Cast text copied.")}>Copy text</button>
          <button type="button" onClick={() => void copyValue(`https://farcaster.xyz/${props.authorUsername ? `${encodeURIComponent(props.authorUsername)}/` : "~/"}${props.hash}`, "Cast link copied.")}>Copy cast link</button>
          {props.canWrite && props.viewerFid === props.authorFid && (confirmDelete
            ? <div className="cast-delete-confirm" role="group" aria-label="Confirm cast deletion"><small>This permanently deletes your cast.</small><button type="button" className="cast-delete-confirm-button" onClick={() => void deleteCast()} disabled={deleteBusy}>{deleteBusy ? "Deleting…" : "Confirm delete"}</button><button type="button" onClick={() => setConfirmDelete(false)} disabled={deleteBusy}>Cancel</button></div>
            : <button type="button" className="cast-delete-option" onClick={() => setConfirmDelete(true)}>Delete your cast…</button>)}
          {props.authorUsername && props.viewerFid != null && props.viewerFid !== props.authorFid && <>
            <button type="button" onClick={toggleMute} disabled={muteBusy}>
              {muteBusy ? "Saving…" : muted ? `Show posts from @${props.authorUsername}` : `Hide posts from @${props.authorUsername}`}
            </button>
            <small>Manage mutes in You → Filters.</small>
          </>}
        </div>
      </details>
      {error && (
        <span className="act-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
