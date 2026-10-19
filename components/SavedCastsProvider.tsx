"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toggleSavedCast } from "@/app/(main)/me/actions";

type SavedCastsContextValue = { hashes: Set<string>; toggle: (hash: string) => Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> };
const SavedCastsContext = createContext<SavedCastsContextValue | null>(null);

export function SavedCastsProvider({ initial, children }: { initial: string[]; children: React.ReactNode }) {
  const [saved, setSaved] = useState(initial);
  const hashes = useMemo(() => new Set(saved), [saved]);
  const toggle = useCallback(async (hash: string) => {
    const result = await toggleSavedCast(hash);
    if (result.ok) setSaved((current) => result.saved ? [hash.toLowerCase(), ...current.filter((item) => item !== hash.toLowerCase())] : current.filter((item) => item !== hash.toLowerCase()));
    return result;
  }, []);
  return <SavedCastsContext.Provider value={{ hashes, toggle }}>{children}</SavedCastsContext.Provider>;
}

export function useSavedCasts() {
  const value = useContext(SavedCastsContext);
  if (!value) throw new Error("SavedCastsProvider is missing from the app layout.");
  return value;
}
