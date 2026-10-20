"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSavedCasts } from "@/components/SavedCastsProvider";

export function SavedCollections({ selected, counts }: { selected: string | null; counts: Record<string, number> }) {
  const { collections, create, removeCollection } = useSavedCasts();
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function addCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(""); setStatus("");
    try {
      const result = await create(name);
      if (!result.ok) { setError(result.error); return; }
      setName(""); setStatus("Collection created.");
      router.push(`/saved?collection=${encodeURIComponent(result.collection.id)}`);
    } catch { setError("Could not create the collection. Try again."); }
    finally { setPending(false); }
  }

  async function deleteSelected() {
    if (!selected || selected === "inbox" || pending) return;
    const collection = collections.find((item) => item.id === selected);
    if (!collection || !window.confirm(`Delete “${collection.name}”? Saved casts will stay in your Reading list.`)) return;
    setPending(true); setError(""); setStatus("");
    try {
      const result = await removeCollection(selected);
      if (!result.ok) { setError(result.error); return; }
      setStatus("Collection deleted. Its casts are in your Reading list.");
      router.replace("/saved?collection=inbox");
    } catch { setError("Could not delete the collection. Try again."); }
    finally { setPending(false); }
  }

  return <section className="saved-collections" aria-label="Saved cast collections">
    <nav className="saved-collection-tabs" aria-label="Filter saved casts">
      <Link href="/saved" aria-current={selected === null ? "page" : undefined}>All <span>{counts.all ?? 0}</span></Link>
      {collections.map((collection) => <Link key={collection.id} href={`/saved?collection=${encodeURIComponent(collection.id)}`} aria-current={selected === collection.id ? "page" : undefined}>{collection.name} <span>{counts[collection.id] ?? 0}</span></Link>)}
    </nav>
    <div className="saved-collection-tools">
      <form onSubmit={addCollection}>
        <label className="sr-only" htmlFor="saved-collection-name">New collection name</label>
        <input id="saved-collection-name" value={name} maxLength={28} onChange={(event) => setName(event.target.value)} placeholder="New collection" disabled={pending} />
        <button type="submit" className="btn ghost sm" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Create"}</button>
      </form>
      {selected && selected !== "inbox" && <button type="button" className="saved-collection-delete" onClick={() => void deleteSelected()} disabled={pending}>Delete collection</button>}
    </div>
    {(error || status) && <p className={error ? "form-error" : "save-status saved"} role={error ? "alert" : "status"}>{error || status}</p>}
  </section>;
}
