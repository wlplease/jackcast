"use client";

import { useState, useTransition } from "react";
import { checkFriend, loadFollowedPeople, savePrefs, suggestBestFriends } from "@/app/(main)/me/actions";
import { MAX_FRIENDS, type Prefs } from "@/lib/prefs-shared";

type Person = Prefs["friends"][number];

function PeopleFeedForm({ initial, field, title }: { initial: Person[]; field: "friends" | "customPeople"; title: string }) {
  const [people, setPeople] = useState(initial);
  const [followedPeople, setFollowedPeople] = useState<{ fid: number; username: string; displayName: string }[]>([]);
  const [username, setUsername] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [finding, setFinding] = useState(false);
  const [suggestions, setSuggestions] = useState<Person[] | null>(null);
  const [suggestionError, setSuggestionError] = useState("");
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [followedLoaded, setFollowedLoaded] = useState(false);
  const [followedError, setFollowedError] = useState("");
  const [, start] = useTransition();
  const searchTerms = search.trim().replace(/^@/, "").toLowerCase().split(/\s+/).filter(Boolean);
  const matches = searchTerms.length
    ? followedPeople
        .filter((person) => !people.some((added) => added.fid === person.fid))
        .filter((person) => searchTerms.every((term) => `${person.username} ${person.displayName}`.toLowerCase().includes(term)))
        .slice(0, 8)
    : [];

  async function loadFollowed() {
    if (followedLoaded || loadingFollowed) return;
    setLoadingFollowed(true);
    setFollowedError("");
    try {
      const result = await loadFollowedPeople();
      if (!result.ok) {
        setFollowedError(result.error);
        return;
      }
      setFollowedPeople(result.people);
      setFollowedLoaded(true);
    } catch {
      setFollowedError("Couldn't load followed accounts. You can still add someone by username below.");
    } finally {
      setLoadingFollowed(false);
    }
  }

  function save(next: Person[]) {
    setPeople(next);
    setStatus("saving");
    setError(null);
    start(async () => {
      const result = await savePrefs(field === "friends" ? { friends: next } : { customPeople: next });
      if (result.ok) {
        setPeople(field === "friends" ? result.prefs.friends : result.prefs.customPeople);
        setStatus("saved");
        setTimeout(() => setStatus((current) => current === "saved" ? "idle" : current), 1800);
      } else {
        setStatus("idle");
        setError(result.error);
      }
    });
  }

  async function add() {
    if (checking || people.length >= MAX_FRIENDS) return;
    setChecking(true);
    setError(null);
    const result = await checkFriend(username);
    setChecking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (people.some((person) => person.fid === result.fid)) {
      setError(`@${result.username} is already in this feed.`);
      return;
    }
    setUsername("");
    save([...people, { fid: result.fid, username: result.username }]);
  }

  function addFollowed(person: { fid: number; username: string }) {
    if (people.length >= MAX_FRIENDS || people.some((added) => added.fid === person.fid)) return;
    setSearch("");
    save([...people, { fid: person.fid, username: person.username }]);
  }

  async function findSuggestions() {
    if (finding || suggestions) return;
    setFinding(true);
    setSuggestionError("");
    const result = await suggestBestFriends();
    setFinding(false);
    if (!result.ok) {
      setSuggestionError(result.error);
      return;
    }
    setSuggestions(result.people);
    if (result.people.length === 0) setSuggestionError("No suggestions are available yet.");
  }

  return (
    <div className="filters">
      <div className="field">
        <div className="field-head">
          <h3>People in {title}</h3>
          <span className={`save-status ${status}`} aria-live="polite">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
        </div>
        <p className="field-hint">A private, chronological feed from up to {MAX_FRIENDS} people. This list is saved on this device.</p>
        {field === "friends" && (
          <div className="best-friends">
            <button type="button" className="btn ghost sm" onClick={() => void findSuggestions()} disabled={finding || Boolean(suggestions) || people.length >= MAX_FRIENDS}>
              {finding ? "Finding people…" : suggestions ? "Top people loaded" : "Find my top 20"}
            </button>
            <p className="field-hint">One manual lookup. Neynar ranks by mutual interaction; it does not offer an exact 180-day cutoff.</p>
            {suggestionError && <p className="form-error" role="status">{suggestionError}</p>}
            {suggestions && suggestions.length > 0 && (
              <div className="best-friend-list" aria-label="Neynar top friend suggestions">
                {suggestions.map((person, index) => {
                  const added = people.some((current) => current.fid === person.fid);
                  return (
                    <div className="best-friend-row" key={person.fid}>
                      <span className="best-friend-rank">{index + 1}</span>
                      <span>@{person.username}</span>
                      <button type="button" className="linkish" onClick={() => save([...people, person])} disabled={added || people.length >= MAX_FRIENDS}>
                        {added ? "Added" : "Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="chips favs" aria-label={`People in ${title} feed`}>
          {people.length === 0 && <span className="chips-empty">No one added yet. Search or add a username below.</span>}
          {people.map((person) => (
            <span key={person.fid} className="chip fav">
              @{person.username}
              <button type="button" aria-label={`Remove @${person.username} from ${title}`} onClick={() => save(people.filter((item) => item.fid !== person.fid))}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        {field === "customPeople" && (
          <div className="followed-search">
            <label className="field-label" htmlFor="custom-followed-search">Find someone you already follow</label>
            <input
              id="custom-followed-search"
              className="text-input find"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => void loadFollowed()}
              placeholder="Search names or usernames"
              autoCapitalize="none"
              autoCorrect="off"
              disabled={people.length >= MAX_FRIENDS}
            />
            <span className="field-hint">Searches up to 2,000 of your followed accounts; exact usernames can also be added below.</span>
            {search.trim() && (
              <div className="followed-results" aria-live="polite" aria-busy={loadingFollowed}>
                {loadingFollowed && <p className="field-hint">Loading accounts you follow…</p>}
                {followedError && <p className="form-error" role="status">{followedError}</p>}
                {matches.map((person) => (
                  <button key={person.fid} type="button" className="followed-result" onClick={() => addFollowed(person)} disabled={people.length >= MAX_FRIENDS}>
                    <span>{person.displayName}</span><small>@{person.username}</small><b>Add</b>
                  </button>
                ))}
                {followedLoaded && matches.length === 0 && <p className="field-hint">No followed accounts match “{search.trim()}”.</p>}
              </div>
            )}
          </div>
        )}
        <form className="friend-add" onSubmit={(event) => { event.preventDefault(); void add(); }}>
          <input
            className="text-input find"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Farcaster username"
            aria-label="Farcaster username to add"
            autoCapitalize="none"
            autoCorrect="off"
            disabled={people.length >= MAX_FRIENDS}
          />
          <button className="btn ghost sm" type="submit" disabled={!username.trim() || checking || people.length >= MAX_FRIENDS}>
            {checking ? "Looking…" : "Add"}
          </button>
        </form>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </div>
  );
}

export function FriendsFeedForm({ initial }: { initial: Person[] }) {
  return <PeopleFeedForm initial={initial} field="friends" title="Friends" />;
}

export function CustomFeedForm({ initial }: { initial: Person[] }) {
  return <PeopleFeedForm initial={initial} field="customPeople" title="your custom feed" />;
}

export function CustomFeedNameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [, start] = useTransition();
  function saveName() {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 18);
    if (!clean) { setError("Give this feed a name."); return; }
    start(async () => {
      const result = await savePrefs({ customName: clean });
      if (result.ok) {
        setName(result.prefs.customName);
        setSaved(true);
        setError("");
        setTimeout(() => setSaved(false), 1800);
      } else setError(result.error);
    });
  }
  return (
    <div className="field">
      <div className="field-head"><h3>Feed name</h3><span className="save-status" aria-live="polite">{saved ? "Saved" : ""}</span></div>
      <form className="friend-add" onSubmit={(event) => { event.preventDefault(); saveName(); }}>
        <input className="text-input find" value={name} maxLength={18} onChange={(event) => setName(event.target.value)} aria-label="Custom feed name" placeholder="Builders, Local, Art…" />
        <button className="btn ghost sm" type="submit">Save</button>
      </form>
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}
