"use client";

import { useState, useTransition } from "react";
import { checkFriend, savePrefs } from "@/app/(main)/me/actions";
import { MAX_FRIENDS, type Prefs } from "@/lib/prefs-shared";

type Person = Prefs["friends"][number];

export function FriendsFeedForm({ initial }: { initial: Person[] }) {
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
      const result = await savePrefs({ friends: next });
      if (result.ok) {
        setPeople(result.prefs.friends);
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
          <h3>People in Friends</h3>
          <span className={`save-status ${status}`} aria-live="polite">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
        </div>
        <p className="field-hint">A private, chronological feed from up to {MAX_FRIENDS} people. This list is saved on this device.</p>
        <div className="chips favs" aria-label="People in Friends feed">
          {people.length === 0 && <span className="chips-empty">No one added yet. Add a username below.</span>}
          {people.map((person) => (
            <span key={person.fid} className="chip fav">
              @{person.username}
              <button type="button" aria-label={`Remove @${person.username} from Friends`} onClick={() => save(people.filter((item) => item.fid !== person.fid))}>
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
