"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getArcadeSecrets, recordArcadeSecret } from "@/lib/arcade-client";
import { useArcadeLeaderboard } from "@/lib/arcade-leaderboard";
import { withCastAttribution } from "@/lib/cast-attribution";

type BoardRow = { fid: number; username: string; score: number; playedAt: string };
type JackTarget = { x: number; y: number; size: number; angle: number; gold: boolean };
type GameStatus = "ready" | "playing" | "over";
const SAVE_KEY = "jackcaster-jumping-jacks-best-v1";
const ROUND_SECONDS = 20;

function currentWeek() {
  const date = new Date();
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function randomJack(gold = false): JackTarget {
  return { x: 8 + Math.random() * 78, y: 14 + Math.random() * 58, size: 48 + Math.random() * 20, angle: -16 + Math.random() * 32, gold };
}

export function JumpingJacksGame({ player }: { player: { fid: number; username: string } }) {
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [best, setBest] = useState(0);
  const [jack, setJack] = useState<JackTarget>(() => randomJack());
  const { board, enabled: sharedBoard, submitBest } = useArcadeLeaderboard(currentWeek());
  const [message, setMessage] = useState("");
  const [secretCount, setSecretCount] = useState(0);
  const [clueIndex, setClueIndex] = useState(0);
  const tapRef = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRound = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SAVE_KEY) ?? 0);
    setBest(Number.isFinite(saved) ? saved : 0);
    setSecretCount(getArcadeSecrets().length);
    const savedClue = Number(localStorage.getItem("jackcaster:arcade-clue-level") ?? 0);
    setClueIndex(Number.isInteger(savedClue) ? Math.min(2, Math.max(0, savedClue)) : 0);
  }, []);

  const finish = useCallback(async (finalScore: number) => {
    if (finishedRound.current) return;
    finishedRound.current = true;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setStatus("over");
    const nextBest = Math.max(best, finalScore);
    setBest(nextBest);
    localStorage.setItem(SAVE_KEY, String(nextBest));
    if (sharedBoard) {
      const result = await submitBest({ fid: player.fid, username: player.username, score: finalScore });
      setMessage(result ? "Weekly best saved to the shared board." : "Your personal best is saved on this device. The shared board could not save this run.");
    } else {
      setMessage("Personal best saved on this device. Shared leaderboard is not configured yet.");
    }
  }, [best, sharedBoard, submitBest, player.fid, player.username]);

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    finishedRound.current = false;
    setScore(0);
    setSeconds(ROUND_SECONDS);
    setMessage("");
    setJack(randomJack());
    setStatus("playing");
    const endsAt = Date.now() + ROUND_SECONDS * 1000;
    timer.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setStatus((current) => current === "playing" ? "over" : current);
      }
    }, 100);
  }, []);

  useEffect(() => {
    if (status === "over" && seconds === 0) void finish(score);
  }, [finish, score, seconds, status]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const tapJack = () => {
    if (status !== "playing") return;
    if (jack.gold) {
      setScore((current) => current + 5);
      setSecretCount(recordArcadeSecret("gold-jack").length);
      setMessage("SECRET FOUND · Golden Jack! +5 points. Don’t give up — hint: the nameplate at the top left has a rhythm.");
      setJack(randomJack());
      return;
    }
    const nextScore = score + 1;
    setScore(nextScore);
    setJack(randomJack(nextScore > 0 && nextScore % 7 === 0));
  };
  tapRef.current = tapJack;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || status !== "playing") return;
      event.preventDefault();
      tapRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]);

  async function share(kind: "run" | "clue") {
    const appUrl = new URL("/arcade", window.location.origin).href;
    const text = kind === "run"
      ? `I scored ${score} in Jumping Jacks, a tiny hidden arcade inside Jackcaster. Built on Selfcaster: https://selfcaster.xyz. Can you beat my run?`
      : "I found a little arcade tucked inside Jackcaster, but I think there’s more than one way to find it. Can you spot the other path? Built on Selfcaster: https://selfcaster.xyz.";
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      if (await sdk.isInMiniApp()) {
        await sdk.actions.composeCast({ text: withCastAttribution(text), embeds: [appUrl] });
        return;
      }
    } catch { /* Fall back to the in-app cast composer. */ }
    window.location.assign(`/compose?text=${encodeURIComponent(text)}&url=${encodeURIComponent(appUrl)}`);
  }

  const clues = [
    "The wordmark up top has a favorite rhythm.",
    "The arcade listens for four letters, but only when you are not typing a cast.",
    "Golden Jack appears after a little streak. Keep hopping and watch for a different glow.",
  ];

  return <div className="arcade-page">
    <header className="arcade-head"><Link href="/" className="arcade-back">← Back to Jackcaster</Link><span className="arcade-secret">YOU FOUND THE ARCADE</span><h1>Jumping Jacks</h1><p>Catch Jack before he jumps away. Twenty seconds. One very serious leaderboard.</p></header>
    <div className="arcade-layout">
      <section className="arcade-card" aria-label="Jumping Jacks game">
        <div className="arcade-stats"><div><span>Score</span><strong>{score}</strong></div><div><span>Time</span><strong className={seconds <= 5 && status === "playing" ? "arcade-urgent" : ""}>{seconds}s</strong></div><div><span>Personal best</span><strong>{best}</strong></div></div>
        <div className={`arcade-field ${status === "playing" ? "is-playing" : ""}`}>
          <div className="arcade-grid" aria-hidden="true" />
          {status === "playing" && <button type="button" className={`arcade-jack${jack.gold ? " gold" : ""}`} style={{ left: `${jack.x}%`, top: `${jack.y}%`, fontSize: jack.size, transform: `rotate(${jack.angle}deg)` }} onPointerDown={(event) => { event.preventDefault(); tapJack(); }} aria-label={jack.gold ? "Collect Golden Jack for a bonus" : "Jump on Jack"}>{jack.gold ? "✦" : "↟"}</button>}
          {status !== "playing" && <div className="arcade-overlay"><span className="arcade-mascot" aria-hidden="true">↟</span><strong>{status === "over" ? `Nice jumps: ${score}` : "Ready, Jack?"}</strong><p>{status === "over" ? "Run it back and beat your best." : "Tap Jack as fast as you can."}</p><button type="button" className="btn" onClick={start}>{status === "over" ? "Play again" : "Start game"}</button></div>}
          <div className="arcade-ground" aria-hidden="true"><span>JACKCASTER ARCADE</span><span>NO TOKENS · JUST HOPS</span></div>
        </div>
        <div className="arcade-tools"><p className="arcade-hint">Works with touch, mouse, or press <kbd>Space</kbd> when Jack appears. Look for a golden Jack after a streak.</p>
          <div className="arcade-actions"><button type="button" className="btn ghost sm" onClick={() => void share(status === "over" ? "run" : "clue")}>{status === "over" ? "Share your run" : "Share a clue"}</button><span className="arcade-secret-count">✦ {secretCount} / 3 secrets found</span></div>
          <details className="arcade-clues"><summary>Need a hint?</summary><p>{clues[clueIndex]}</p>{clueIndex < clues.length - 1 && <button type="button" className="linkish" onClick={() => { const next = clueIndex + 1; setClueIndex(next); try { localStorage.setItem("jackcaster:arcade-clue-level", String(next)); } catch {} }}>Reveal another clue</button>}</details>
        </div>
      </section>
      <aside className="arcade-board"><div className="arcade-board-head"><div><span className="arcade-eyebrow">WEEK OF {currentWeek()}</span><h2>Top jumpers</h2></div><span className="arcade-trophy" aria-hidden="true">🏆</span></div>
        <p className="arcade-local-note">{sharedBoard ? "Shared weekly board · scores are community-reported." : "Shared board is not configured yet · personal bests stay on this device."}</p>
        {board.length ? <ol>{board.map((row, index) => <li key={`${row.fid}-${index}`} className={row.fid === player.fid ? "arcade-self" : ""}><span className="arcade-rank">{String(index + 1).padStart(2, "0")}</span><span className="arcade-player"><strong>{row.fid === player.fid ? "You" : `@${row.username}`}</strong><small>FID {row.fid}</small></span><strong className="arcade-points">{row.score}</strong></li>)}</ol> : <div className="arcade-empty">The board is clear. Set the first record.</div>}
        {message && <p className="arcade-status" role="status">{message}</p>}
      </aside>
    </div>
    <footer className="arcade-foot">A tiny Jackcaster easter egg. No entry fees, prizes, tokens, or purchases. <button type="button" className="linkish" onClick={() => void share("clue")}>Invite a friend to hunt</button></footer>
  </div>;
}
