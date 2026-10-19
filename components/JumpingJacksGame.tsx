"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type BoardRow = { fid: number; username: string; score: number; playedAt: string };
type GameStatus = "ready" | "playing" | "over";
const SAVE_KEY = "jackcaster-jumping-jacks-best-v1";
const LEADERBOARD_KEY = "jackcaster-arcade-leaderboard";
const ROUND_SECONDS = 20;

function currentWeek() {
  const date = new Date();
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function randomJack() {
  return { x: 8 + Math.random() * 78, y: 14 + Math.random() * 58, size: 48 + Math.random() * 20, angle: -16 + Math.random() * 32 };
}

export function JumpingJacksGame({ player }: { player: { fid: number; username: string } }) {
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [best, setBest] = useState(0);
  const [jack, setJack] = useState(randomJack);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [message, setMessage] = useState("");
  const tapRef = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SAVE_KEY) ?? 0);
    setBest(Number.isFinite(saved) ? saved : 0);
    try {
      const local = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) ?? "[]") as BoardRow[];
      setBoard(local.filter((row) => Number.isFinite(row.score)).sort((a, b) => b.score - a.score).slice(0, 20));
    } catch { setBoard([]); }
  }, []);

  const finish = useCallback(async (finalScore: number) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setStatus("over");
    const nextBest = Math.max(best, finalScore);
    setBest(nextBest);
    localStorage.setItem(SAVE_KEY, String(nextBest));
    const row: BoardRow = { fid: player.fid, username: player.username, score: finalScore, playedAt: new Date().toISOString() };
    const updated = [row, ...board.filter((entry) => entry.fid !== row.fid)].sort((a, b) => b.score - a.score).slice(0, 20);
    setBoard(updated);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated));
    setMessage("Saved on this device. Shared weekly scores need secure Firebase sign-in.");
  }, [best, board, player.fid, player.username]);

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
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
    setScore((current) => current + 1);
    setJack(randomJack());
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

  return <main className="arcade-page">
    <header className="arcade-head"><Link href="/" className="arcade-back">← Back to Jackcaster</Link><span className="arcade-secret">YOU FOUND THE ARCADE</span><h1>Jumping Jacks</h1><p>Catch Jack before he jumps away. Twenty seconds. One very serious leaderboard.</p></header>
    <div className="arcade-layout">
      <section className="arcade-card" aria-label="Jumping Jacks game">
        <div className="arcade-stats"><div><span>Score</span><strong>{score}</strong></div><div><span>Time</span><strong className={seconds <= 5 && status === "playing" ? "arcade-urgent" : ""}>{seconds}s</strong></div><div><span>Personal best</span><strong>{best}</strong></div></div>
        <div className={`arcade-field ${status === "playing" ? "is-playing" : ""}`}>
          <div className="arcade-grid" aria-hidden="true" />
          {status === "playing" && <button type="button" className="arcade-jack" style={{ left: `${jack.x}%`, top: `${jack.y}%`, fontSize: jack.size, transform: `rotate(${jack.angle}deg)` }} onPointerDown={(event) => { event.preventDefault(); tapJack(); }} aria-label="Jump on Jack">↟</button>}
          {status !== "playing" && <div className="arcade-overlay"><span className="arcade-mascot" aria-hidden="true">↟</span><strong>{status === "over" ? `Nice jumps: ${score}` : "Ready, Jack?"}</strong><p>{status === "over" ? "Run it back and beat your best." : "Tap Jack as fast as you can."}</p><button type="button" className="btn" onClick={start}>{status === "over" ? "Play again" : "Start game"}</button></div>}
          <div className="arcade-ground" aria-hidden="true"><span>JACKCASTER ARCADE</span><span>NO TOKENS · JUST HOPS</span></div>
        </div>
        <p className="arcade-hint">Works with touch, mouse, or press <kbd>Space</kbd> when Jack appears.</p>
      </section>
      <aside className="arcade-board"><div className="arcade-board-head"><div><span className="arcade-eyebrow">WEEK OF {currentWeek()}</span><h2>Top jumpers</h2></div><span className="arcade-trophy" aria-hidden="true">🏆</span></div>
        <p className="arcade-local-note">Local leaderboard · your scores stay on this device.</p>
        {board.length ? <ol>{board.map((row, index) => <li key={`${row.fid}-${index}`} className={row.fid === player.fid ? "arcade-self" : ""}><span className="arcade-rank">{String(index + 1).padStart(2, "0")}</span><span className="arcade-player"><strong>{row.fid === player.fid ? "You" : `@${row.username}`}</strong><small>FID {row.fid}</small></span><strong className="arcade-points">{row.score}</strong></li>)}</ol> : <div className="arcade-empty">The board is clear. Set the first record.</div>}
        {message && <p className="arcade-status" role="status">{message}</p>}
      </aside>
    </div>
    <footer className="arcade-foot">A tiny Jackcaster easter egg. No entry fees, prizes, tokens, or purchases.</footer>
  </main>;
}
