import { Feed } from "@/components/Feed";
import { SetupBanner } from "@/components/SetupBanner";
import { savedCasts as loadSavedCasts } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { requireViewer } from "@/lib/viewer";
import { SavedCollections } from "@/components/SavedCollections";

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
  const { collection: requestedCollection } = await searchParams;
  const viewer = await requireViewer();
  const prefs = await getPrefs();
  try {
    const selected = prefs.savedCollections.some((item) => item.id === requestedCollection) ? requestedCollection! : null;
    const assignments = new Map(prefs.savedCastCollections.map((item) => [item.hash, item.collectionId]));
    const counts: Record<string, number> = { all: prefs.savedCasts.length };
    for (const collection of prefs.savedCollections) counts[collection.id] = 0;
    for (const hash of prefs.savedCasts) counts[assignments.get(hash) ?? "inbox"] = (counts[assignments.get(hash) ?? "inbox"] ?? 0) + 1;
    const hashes = selected ? prefs.savedCasts.filter((hash) => (assignments.get(hash) ?? "inbox") === selected) : prefs.savedCasts;
    const casts = await loadSavedCasts(hashes, viewer.fid);
    const title = selected ? prefs.savedCollections.find((item) => item.id === selected)?.name ?? "Saved" : "Saved";
    return <>
      <div className="section-head"><div><h1>{title}</h1><p>Private to this device. Sort saved casts into collections.</p></div><span className="meta">{casts.length} {casts.length === 1 ? "cast" : "casts"}</span></div>
      <SavedCollections selected={selected} counts={counts} />
      <Feed page={{ casts, cursor: null, hidden: 0 }} basePath="/saved" canWrite={viewer.canWrite} viewerFid={viewer.fid} emptyTitle={selected ? "This collection is empty" : "Your reading list is clear"} emptyBody={selected ? "Open All saved, then choose a collection on any saved cast." : "Use the bookmark button on any cast to save it here."} />
    </>;
  } catch (error) { return <SetupBanner error={error} />; }
}
