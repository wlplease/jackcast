"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState, useTransition } from "react";
import { checkChannel, savePrefs } from "@/app/(main)/me/actions";
import { CHANNEL_ID, MAX_TABS } from "@/lib/prefs-shared";

type Chip = { id: string; name?: string; image_url?: string };

const PREVIEW = 12;

function ChannelIcon({ c }: { c?: Chip }) {
  return c?.image_url ? (
    <img src={c.image_url} alt="" referrerPolicy="no-referrer" loading="lazy" />
  ) : (
    <span className="pick-dot" aria-hidden="true" />
  );
}

/** Pick and order favorite channels: they become the feed tabs and composer's channel menu. Saves as you edit. */
export function ChannelTabsForm({
  followed,
  current,
}: {
  /** Every channel you follow on Farcaster, A to Z. */
  followed: Chip[];
  /** Your favorites right now. */
  current: string[];
}) {
  const [favs, setFavs] = useState<string[]>(current);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [known, setKnown] = useState<Chip[]>([]);
  const [isPending, start] = useTransition();

  const byId = useMemo(() => new Map([...followed, ...known].map((c) => [c.id, c])), [followed, known]);

  const q = query.trim().toLowerCase().replace(/^\//, "");
  const matches = q
    ? followed.filter((c) => c.id.includes(q) || c.name?.toLowerCase().includes(q))
    : showAll
      ? followed
      : followed.slice(0, PREVIEW);
  // Offer "Add /x" only for a channel you don't follow, once nothing you follow matches.
  const canAdd = !!q && matches.length === 0 && CHANNEL_ID.test(q) && !byId.has(q) && !favs.includes(q);

  function save(next: string[]) {
    const previous = favs;
    setFavs(next);
    setStatus("saving");
    setError(null);
    start(async () => {
      const res = await savePrefs({ tabs: next });
      if (res.ok) {
        setFavs(res.prefs.tabs ?? []);
        setStatus("saved");
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1800);
      } else {
        setFavs(previous);
        setStatus("error");
        setError(res.error);
      }
    });
  }

  function toggle(id: string) {
    if (isPending) return;
    const on = favs.includes(id);
    if (!on && favs.length >= MAX_TABS) {
      setError(`Up to ${MAX_TABS} favorites.`);
      return;
    }
    save(on ? favs.filter((x) => x !== id) : [...favs, id]);
  }

  function move(id: string, offset: -1 | 1) {
    const index = favs.indexOf(id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= favs.length || isPending) return;
    const next = [...favs];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  }

  async function addByName() {
    if (!canAdd) return;
    setChecking(true);
    setError(null);
    const res = await checkChannel(q);
    setChecking(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setKnown((k) => [...k, { id: res.id, name: res.name }]);
    setQuery("");
    if (!favs.includes(res.id)) toggle(res.id);
  }

  return (
    <div className="filters" id="tabs">
      <div className="field">
        <div className="field-head">
          <h3>Favorite channels</h3>
          <span className={`save-status ${status}`} aria-live="polite">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
        </div>
        <p className="field-hint">Your favorites are the tabs at the top of your feed and the only channels in the composer. Use the arrows to set their order.</p>

        <div className="chips favs" aria-label="Your favorites">
          {favs.length === 0 && <span className="chips-empty">None yet. Pick a few below.</span>}
          {favs.map((id) => (
            <span key={id} className="chip fav channel-favorite-row">
              <span className="channel-favorite-name"><ChannelIcon c={byId.get(id)} />/{id}</span>
              <span className="channel-order-controls">
                <button type="button" aria-label={`Move /${id} up`} title="Move up" disabled={isPending || favs.indexOf(id) === 0} onClick={() => move(id, -1)}>↑</button>
                <button type="button" aria-label={`Move /${id} down`} title="Move down" disabled={isPending || favs.indexOf(id) === favs.length - 1} onClick={() => move(id, 1)}>↓</button>
              </span>
              <button type="button" aria-label={`Remove /${id} from favorites`} disabled={isPending} onClick={() => toggle(id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              </button>
            </span>
          ))}
        </div>

        <input
          className="text-input find"
          type="search"
          value={query}
          placeholder={followed.length ? `Search the ${followed.length} channels you follow` : "Find a channel by name"}
          aria-label="Search your channels"
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(e) => {
            setError(null);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches.length === 1) {
                toggle(matches[0].id);
                setQuery("");
              } else addByName();
            }
          }}
        />

        {matches.length > 0 && (
          <div className="pick-grid" role="group" aria-label="Channels you follow">
            {matches.map((c) => {
              const on = favs.includes(c.id);
              return (
                <button key={c.id} type="button" className={`pick${on ? " on" : ""}`} aria-pressed={on} disabled={isPending} onClick={() => toggle(c.id)}>
                  <ChannelIcon c={c} />
                  <span className="pick-id">/{c.id}</span>
                  <svg className="pick-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}

        {q && matches.length === 0 && !canAdd && <p className="field-hint">No channels you follow match that.</p>}
        {canAdd && <p className="field-hint">You don&apos;t follow /{q}. You can still add it.</p>}
        {canAdd && (
          <button type="button" className="btn ghost sm add-chan" onClick={addByName} disabled={checking}>
            {checking ? "Checking…" : `Add /${q}`}
          </button>
        )}
        {!q && followed.length > PREVIEW && (
          <button type="button" className="linkish reset" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show fewer" : `Show all ${followed.length}`}
          </button>
        )}
        {error && <div className="form-error">{error}</div>}
      </div>
    </div>
  );
}
