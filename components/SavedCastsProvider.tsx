"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createSavedCollection, deleteSavedCollection, moveSavedCast, toggleSavedCast } from "@/app/(main)/me/actions";

type Collection = { id: string; name: string };
type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; collection: Collection } | { ok: false; error: string };
type SavedCastsContextValue = {
  hashes: Set<string>;
  collections: Collection[];
  collectionFor: (hash: string) => string;
  toggle: (hash: string) => Promise<{ ok: true; saved: boolean } | { ok: false; error: string }>;
  move: (hash: string, collectionId: string) => Promise<Result>;
  create: (name: string) => Promise<CreateResult>;
  removeCollection: (collectionId: string) => Promise<Result>;
};
const SavedCastsContext = createContext<SavedCastsContextValue | null>(null);

export function SavedCastsProvider({ initial, initialCollections, initialAssignments, children }: { initial: string[]; initialCollections: Collection[]; initialAssignments: { hash: string; collectionId: string }[]; children: React.ReactNode }) {
  const [saved, setSaved] = useState(initial);
  const [collections, setCollections] = useState(initialCollections);
  const [assignments, setAssignments] = useState(initialAssignments);
  const hashes = useMemo(() => new Set(saved), [saved]);
  const assignmentMap = useMemo(() => new Map(assignments.map((entry) => [entry.hash, entry.collectionId])), [assignments]);
  const collectionFor = useCallback((hash: string) => assignmentMap.get(hash.toLowerCase()) ?? "inbox", [assignmentMap]);
  const toggle = useCallback(async (hash: string) => {
    const result = await toggleSavedCast(hash);
    if (result.ok) {
      const normalized = hash.toLowerCase();
      setSaved((current) => result.saved ? [normalized, ...current.filter((item) => item !== normalized)] : current.filter((item) => item !== normalized));
      setAssignments((current) => current.filter((item) => item.hash !== normalized));
    }
    return result;
  }, []);
  const move = useCallback(async (hash: string, collectionId: string) => {
    const result = await moveSavedCast(hash, collectionId);
    if (result.ok) setAssignments((current) => [...current.filter((item) => item.hash !== hash.toLowerCase()), ...(collectionId === "inbox" ? [] : [{ hash: hash.toLowerCase(), collectionId }])]);
    return result;
  }, []);
  const create = useCallback(async (name: string) => {
    const result = await createSavedCollection(name);
    if (result.ok) setCollections((current) => current.some((item) => item.id === result.collection.id) ? current : [...current, result.collection]);
    return result;
  }, []);
  const removeCollection = useCallback(async (collectionId: string) => {
    const result = await deleteSavedCollection(collectionId);
    if (result.ok) {
      setCollections((current) => current.filter((item) => item.id !== collectionId));
      setAssignments((current) => current.filter((item) => item.collectionId !== collectionId));
    }
    return result;
  }, []);
  return <SavedCastsContext.Provider value={{ hashes, collections, collectionFor, toggle, move, create, removeCollection }}>{children}</SavedCastsContext.Provider>;
}

export function useSavedCasts() {
  const value = useContext(SavedCastsContext);
  if (!value) throw new Error("SavedCastsProvider is missing from the app layout.");
  return value;
}
