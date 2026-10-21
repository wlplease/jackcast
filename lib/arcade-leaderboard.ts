"use client";

import { useCallback, useEffect, useState } from "react";
import type { BoardRow, ScoreSubmission } from "@/lib/arcade-leaderboard-types";

type FirebaseConfig = { apiKey: string; authDomain: string; projectId: string; appId: string };

function config(): FirebaseConfig | null {
  const packed = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (packed) {
    try {
      const parsed = JSON.parse(packed) as Partial<FirebaseConfig>;
      if (parsed.apiKey && parsed.authDomain && parsed.projectId && parsed.appId) {
        return { apiKey: parsed.apiKey, authDomain: parsed.authDomain, projectId: parsed.projectId, appId: parsed.appId };
      }
    } catch { /* Fall back to individual public config variables. */ }
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

export function useArcadeLeaderboard(week: string) {
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    async function connect() {
      const firebaseConfig = config();
      if (!firebaseConfig) return;
      try {
        const [{ initializeApp, getApps }, { getAuth, signInAnonymously }, { getFirestore, collection, query, orderBy, limit, onSnapshot }] = await Promise.all([
          import("firebase/app"), import("firebase/auth"), import("firebase/firestore"),
        ]);
        const app = getApps().find((entry) => entry.name === "jackcaster-arcade") ?? initializeApp(firebaseConfig, "jackcaster-arcade");
        const auth = getAuth(app);
        if (!auth.currentUser) await signInAnonymously(auth);
        if (!active) return;
        const db = getFirestore(app);
        const scores = collection(db, "jackcaster_arcade", "weeks", week, "scores");
        unsubscribe = onSnapshot(query(scores, orderBy("score", "desc"), limit(20)), (snapshot) => {
          if (!active) return;
          setBoard(snapshot.docs.map((doc) => doc.data() as BoardRow));
          setEnabled(true);
        }, () => { if (active) { setBoard([]); setEnabled(false); } });
      } catch { if (active) setEnabled(false); }
    }
    void connect();
    return () => { active = false; unsubscribe(); };
  }, [week]);

  const submitBest = useCallback(async (row: ScoreSubmission) => {
    try {
      const [{ getApps, initializeApp }, { getAuth, signInAnonymously }, { getFirestore, doc, runTransaction, serverTimestamp }] = await Promise.all([
        import("firebase/app"), import("firebase/auth"), import("firebase/firestore"),
      ]);
      const firebaseConfig = config();
      if (!firebaseConfig) return false;
      const app = getApps().find((entry) => entry.name === "jackcaster-arcade") ?? initializeApp(firebaseConfig, "jackcaster-arcade");
      const auth = getAuth(app);
      const credential = auth.currentUser ? null : await signInAnonymously(auth);
      const uid = auth.currentUser?.uid ?? credential?.user.uid;
      if (!uid) return false;
      const db = getFirestore(app);
      const ref = doc(db, "jackcaster_arcade", "weeks", week, "scores", uid);
      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(ref);
        if ((existing.exists() ? Number(existing.data().score) : 0) < row.score) {
          transaction.set(ref, { fid: row.fid, username: row.username.slice(0, 32), score: row.score, playedAt: serverTimestamp() });
        }
      });
      return true;
    } catch { return false; }
  }, [week]);

  return { board, enabled, submitBest };
}
