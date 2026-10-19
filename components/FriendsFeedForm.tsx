"use client";

import { useState, useTransition } from "react";
import { addTopAccountsBatch, checkFriend, checkSavedFriendsActivity, loadFollowedPeople, savePrefs, suggestRecentFriends } from "@/app/(main)/me/actions";
import { MAX_CUSTOM_PEOPLE, MAX_FRIENDS, MAX_TOP_ACCOUNTS, type Prefs } from "@/lib/prefs-shared";
import { CURATED_TOP_ACCOUNTS } from "@/lib/top-account-roster";

type Person = Prefs["friends"][number];
function PeopleFeedForm({ initial, field, title, excluded = [] }: { initial: Person[]; field: "friends" | "customPeople"; title: string; excluded?: Person[] }) {
  const [people, setPeople] = useState(initial);
  const [followedPeople, setFollowedPeople] = useState<{ fid: number; username: string; displayName: string }[]>([]);
  const [username, setUsername] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [finding, setFinding] = useState(false);
  const [featuredChecking, setFeaturedChecking] = useState<string | null>(null);
  const [batchAdding, setBatchAdding] = useState<"network" | "leaders" | "both" | null>(null);
  const [batchMessage, setBatchMessage] = useState("");
  const [checkingSaved, setCheckingSaved] = useState(false);
  const [savedActivity, setSavedActivity] = useState<{ people: (Person & { posts: number; followers: number })[]; scanned: number; complete: boolean; generatedAt: number } | null>(null);
  const [savedActivityError, setSavedActivityError] = useState("");
  const [suggestions, setSuggestions] = useState<(Person & { posts: number; followers: number })[] | null>(null);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionScan, setSuggestionScan] = useState<{ scanned: number; complete: boolean; generatedAt: number } | null>(null);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [followedLoaded, setFollowedLoaded] = useState(false);
  const [followedError, setFollowedError] = useState("");
  const [, start] = useTransition();
  const searchTerms = search.trim().replace(/^@/, "").toLowerCase().split(/\s+/).filter(Boolean);
  const excludedFids = new Set(excluded.map((person) => person.fid));
  const maxPeople = field === "friends" ? MAX_FRIENDS : MAX_CUSTOM_PEOPLE;
  const matches = searchTerms.length
    ? followedPeople
        .filter((person) => !people.some((added) => added.fid === person.fid))
        .filter((person) => !excludedFids.has(person.fid))
        .filter((person) => searchTerms.every((term) => `${person.username} ${person.displayName}`.toLowerCase().includes(term)))
        .slice(0, 8)
    : [];
  const visiblePeople = [...people].sort((a, b) => a.username.localeCompare(b.username));

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
    const previous = people;
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
        setPeople(previous);
        setStatus("idle");
        setError(result.error);
      }
    });
  }

  async function add() {
    if (checking || status === "saving" || people.length >= maxPeople) return;
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
    if (excludedFids.has(result.fid)) {
      setError(`@${result.username} is already in Friends and stays in that feed.`);
      return;
    }
    setUsername("");
    save([...people, { fid: result.fid, username: result.username }]);
  }

  function addFollowed(person: { fid: number; username: string }) {
    if (status === "saving" || people.length >= maxPeople || people.some((added) => added.fid === person.fid)) return;
    setSearch("");
    save([...people, { fid: person.fid, username: person.username }]);
  }

  async function findSuggestions(refresh = false) {
    if (finding) return;
    setFinding(true);
    setSuggestionError("");
    const result = await suggestRecentFriends(refresh);
    setFinding(false);
    if (!result.ok) {
      setSuggestionError(result.error);
      return;
    }
    setSuggestions(result.people);
    setSuggestionScan({ scanned: result.scanned, complete: result.complete, generatedAt: result.generatedAt });
    if (result.people.length === 0) setSuggestionError("No suggestions are available yet.");
  }

  async function addFeatured(username: string) {
    if (featuredChecking || status === "saving" || people.length >= maxPeople) return;
    setFeaturedChecking(username);
    setError(null);
    const result = await checkFriend(username);
    setFeaturedChecking(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (people.some((person) => person.fid === result.fid)) return;
    setUsername("");
    save([...people, { fid: result.fid, username: result.username }]);
  }

  async function addBatch(group: "network" | "leaders" | "both") {
    if (batchAdding || status === "saving") return;
    setBatchAdding(group);
    setBatchMessage("");
    setError(null);
    try {
      const result = await addTopAccountsBatch(group);
      if (!result.ok) { setError(result.error); return; }
      setPeople(result.prefs.friends);
      const skipped = result.skippedForLimit ? ` · ${result.skippedForLimit} didn't fit the ${MAX_FRIENDS}-person limit` : "";
      setBatchMessage(`Added ${result.added} · ${result.alreadySelected} already selected${skipped}. Custom and Following were not changed.`);
      setStatus("saved");
      setTimeout(() => setStatus((current) => current === "saved" ? "idle" : current), 1800);
    } catch { setError("Couldn't add these accounts right now. Try again shortly."); }
    finally { setBatchAdding(null); }
  }

  async function checkSavedFriends(refresh = false) {
    if (checkingSaved || !people.length) return;
    setCheckingSaved(true);
    setSavedActivityError("");
    try {
      const result = await checkSavedFriendsActivity(refresh);
      if (!result.ok) { setSavedActivityError(result.error); return; }
      setSavedActivity(result);
    } catch {
      setSavedActivityError("Couldn't check your saved Friends accounts. Try again shortly.");
    } finally {
      setCheckingSaved(false);
    }
  }

  return (
    <div className="filters">
      <div className="field">
        <div className="field-head">
          <h3>People in {title}</h3>
          <span className={`save-status ${status}`} aria-live="polite">
            {people.length}/{maxPeople} selected · {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
        </div>
        <p className="field-hint">A private, chronological feed from up to {maxPeople} people. Top Friends stay in this feed and are hidden from Following and Custom.</p>
        {field === "customPeople" && excluded.length > 0 && <p className="field-hint">Accounts in Friends are kept out of Custom too.</p>}
        {field === "friends" && (
          <div className="top-accounts">
            <h3>Top accounts</h3>
            <p className="field-hint">Choose from 20 curated Farcaster accounts and your 20 most active follows from the last 90 days. Add either group or both in one click; your selected accounts stay in this feed only.</p>
            <div className="featured-accounts" aria-label="Featured Farcaster accounts">
              <div className="top-account-batch-actions">
                <button type="button" className="btn sm" onClick={() => void addBatch("both")} disabled={Boolean(batchAdding) || status === "saving" || people.length >= MAX_FRIENDS}>{batchAdding === "both" ? "Adding both lists…" : "Add both top 20 lists"}</button>
                <button type="button" className="btn ghost sm" onClick={() => void addBatch("leaders")} disabled={Boolean(batchAdding) || status === "saving" || people.length >= MAX_FRIENDS}>{batchAdding === "leaders" ? "Adding…" : "Add Farcaster 20"}</button>
                <button type="button" className="btn ghost sm" onClick={() => void addBatch("network")} disabled={Boolean(batchAdding) || status === "saving" || people.length >= MAX_FRIENDS}>{batchAdding === "network" ? "Finding and adding…" : "Add 90-day top 20"}</button>
              </div>
              {batchMessage && <p className="form-ok" role="status">{batchMessage}</p>}
              {CURATED_TOP_ACCOUNTS.slice(0, MAX_TOP_ACCOUNTS).map((account) => {
                const person = people.find((current) => current.username === account.username);
                return (
                  <div className="featured-account" key={account.username}>
                    <div><b>{account.name}</b><span>@{account.username}</span><small>{account.role}</small></div>
                    <button type="button" className="btn ghost sm" onClick={() => void addFeatured(account.username)} disabled={Boolean(person) || Boolean(featuredChecking) || status === "saving" || people.length >= maxPeople}>
                      {person ? "Added" : featuredChecking === account.username ? "Checking…" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="best-friends">
              <button type="button" className="btn ghost sm" onClick={() => void findSuggestions(Boolean(suggestions))} disabled={finding}>
                {finding ? "Scanning recent activity…" : suggestions ? "Redo 90-day scan" : "Find most active in 90 days"}
              </button>
            <p className="field-hint">Ranks people you follow by cast activity in the last 90 days, then follower count. Results are cached for a day; at most 1,000 posts are checked. Add the full top 20 with one click.</p>
              {suggestionError && <p className="form-error" role="status">{suggestionError}</p>}
              {suggestions && suggestions.length > 0 && (
                <>
                  <p className="field-hint" role="status">Scanned {suggestionScan?.scanned.toLocaleString()} posts · saved {suggestionScan ? new Date(suggestionScan.generatedAt).toLocaleString() : ""}. {suggestionScan?.complete ? "Full 90-day window checked." : "Reached the 1,000-post cap; newer activity may dominate."}</p>
                  <div className="best-friend-list" aria-label="Top active people from the last 90 days">
                    {suggestions.map((person, index) => {
                      const added = people.some((current) => current.fid === person.fid);
                      return (
                        <div className="best-friend-row" key={person.fid}>
                          <span className="best-friend-rank">{index + 1}</span>
                          <span>@{person.username}</span>
                          <small>{person.posts} posts · {person.followers.toLocaleString()} followers</small>
                          <button type="button" className="linkish" onClick={() => save([...people, person])} disabled={added || status === "saving" || people.length >= maxPeople}>
                            {added ? "Added" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="saved-friends-check">
              <div className="field-head"><h4>Saved Friends · weekly activity check</h4><span className="meta">all {people.length} together</span></div>
              <p className="field-hint">Check how active everyone already in Friends has been over the last 90 days. One batch is cached for your account for a week, then refreshed the next time you check. This only updates this list.</p>
              <button type="button" className="btn ghost sm" onClick={() => void checkSavedFriends(Boolean(savedActivity))} disabled={checkingSaved || status === "saving" || people.length === 0}>
                {checkingSaved ? "Checking saved accounts…" : savedActivity ? "Check all again" : "Check all saved people"}
              </button>
              {savedActivityError && <p className="form-error" role="status">{savedActivityError}</p>}
              {savedActivity && <>
                <p className="field-hint" role="status">Checked {savedActivity.scanned.toLocaleString()} casts · {savedActivity.complete ? "90-day window checked" : "Stopped at the 1,000-cast scan cap"} · {new Date(savedActivity.generatedAt).toLocaleString()}</p>
                <div className="best-friend-list" aria-label="Saved Friends activity over the last 90 days">
                  {savedActivity.people.map((person, index) => <div className="best-friend-row" key={person.fid}>
                    <span className="best-friend-rank">{index + 1}</span><span>@{person.username}</span>
                    <small>{person.posts} posts · {person.followers.toLocaleString()} followers</small>
                    <span className="saved-activity-status">{person.posts ? "Active" : "Quiet"}</span>
                  </div>)}
                </div>
              </>}
            </div>
          </div>
        )}
        <div className="chips favs" aria-label={`People in ${title} feed`}>
          {people.length === 0 && <span className="chips-empty">No one added yet. Search or add a username below.</span>}
          {visiblePeople.map((person) => (
            <span key={person.fid} className="chip fav">
              @{person.username}
              <button type="button" aria-label={`Remove @${person.username} from ${title}`} onClick={() => save(people.filter((item) => item.fid !== person.fid))} disabled={status === "saving"}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="followed-search">
            <label className="field-label" htmlFor={`${field}-followed-search`}>Add someone you already follow</label>
            <input
              id={`${field}-followed-search`}
              className="text-input find"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => void loadFollowed()}
              placeholder="Search your followed accounts"
              autoCapitalize="none"
              autoCorrect="off"
              disabled={people.length >= maxPeople || status === "saving"}
            />
            <span className="field-hint">Search by display name or username across up to 2,000 followed accounts. You can also add an exact username below.</span>
            {search.trim() && (
              <div className="followed-results" aria-live="polite" aria-busy={loadingFollowed}>
                {loadingFollowed && <p className="field-hint">Loading accounts you follow…</p>}
                {followedError && <p className="form-error" role="status">{followedError}</p>}
                {matches.map((person) => (
                  <button key={person.fid} type="button" className="followed-result" onClick={() => addFollowed(person)} disabled={people.length >= maxPeople}>
                    <span>{person.displayName}</span><small>@{person.username}</small><b>Add</b>
                  </button>
                ))}
                {followedLoaded && matches.length === 0 && <p className="field-hint">No followed accounts match “{search.trim()}”.</p>}
              </div>
            )}
        </div>
        <form className="friend-add" onSubmit={(event) => { event.preventDefault(); void add(); }}>
          <input
            className="text-input find"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Farcaster username"
            aria-label="Farcaster username to add"
            autoCapitalize="none"
            autoCorrect="off"
            disabled={people.length >= maxPeople || status === "saving"}
          />
          <button className="btn ghost sm" type="submit" disabled={!username.trim() || checking || status === "saving" || people.length >= maxPeople}>
            {checking ? "Looking…" : "Add"}
          </button>
        </form>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </div>
  );
}

export function FriendsFeedForm({ initial }: { initial: Person[] }) {
  return <PeopleFeedForm initial={initial} field="friends" title="Top Friends" />;
}

export function CustomFeedForm({ initial, excluded }: { initial: Person[]; excluded?: Person[] }) {
  return <PeopleFeedForm initial={initial} excluded={excluded} field="customPeople" title="your custom feed" />;
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
