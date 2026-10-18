"use client";

import { useState, useTransition } from "react";
import { checkFriend, savePrefs } from "@/app/(main)/me/actions";
import { MAX_FRIENDS, type Prefs } from "@/lib/prefs-shared";

type Person = Prefs["friends"][number];

function PeopleFeedForm({ initial, field, title }: { initial: Person[]; field: "friends" | "customPeople"; title: string }) {
  const [people, setPeople] = useState(initial);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [, start] = useTransition();

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
        <div className="chips favs" aria-label={`People in ${title} feed`}>
          {people.length === 0 && <span className="chips-empty">No one added yet. Add a username below.</span>}
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
