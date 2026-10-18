"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { react } from "@/app/actions";
import { compact } from "@/lib/format";

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
  authorFid: number;
  replies: number;
  likes: number;
  recasts: number;
  liked: boolean;
  recasted: boolean;
  canWrite: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);

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
      <button
        className={`act${state.recasted ? " recasted" : ""}`}
        onClick={() => toggle("recast")}
        disabled={!props.canWrite || busy !== null}
        aria-label={state.recasted ? "Undo recast" : "Recast"}
        aria-pressed={state.recasted}
      >
        {Icon.recast}
        {state.recasts > 0 && compact(state.recasts)}
      </button>
      {props.canWrite && (
        <Link className="act" href={`/compose?quote=${props.hash}`} aria-label="Quote cast" title="Quote">
          {Icon.quote}
        </Link>
      )}
      <button
        className={`act${state.liked ? " liked" : ""}`}
        onClick={() => toggle("like")}
        disabled={!props.canWrite || busy !== null}
        aria-label={state.liked ? "Unlike" : "Like"}
        aria-pressed={state.liked}
      >
        {Icon.like(state.liked)}
        {state.likes > 0 && compact(state.likes)}
      </button>
      {error && (
        <span className="act-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
