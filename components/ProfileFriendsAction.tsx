"use client";

import { useState, useTransition } from "react";
import { savePrefs } from "@/app/(main)/me/actions";
import { MAX_FRIENDS, type Prefs } from "@/lib/prefs-shared";

type Person = Prefs["friends"][number];

export function ProfileFriendsAction({ person, initial }: { person: Person; initial: Person[] }) {
  const [people, setPeople] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const added = people.some((item) => item.fid === person.fid);

  function toggle() {
    const next = added ? people.filter((item) => item.fid !== person.fid) : [...people, person];
    if (!added && people.length >= MAX_FRIENDS) {
      setError(`Top Friends can include up to ${MAX_FRIENDS} people. Remove someone in Settings first.`);
      return;
    }
    setError("");
    start(async () => {
      const result = await savePrefs({ friends: next });
      if (result.ok) setPeople(result.prefs.friends);
      else setError(result.error);
    });
  }

  return (
    <div className="profile-friend-action">
      <button type="button" className={`btn sm${added ? " ghost" : ""}`} onClick={toggle} disabled={pending} aria-pressed={added}>
        {pending ? "Saving…" : added ? "In Top Friends ✓" : "Add to Top Friends"}
      </button>
      {error && <span className="form-error" role="status">{error}</span>}
    </div>
  );
}
