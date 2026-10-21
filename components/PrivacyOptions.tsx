"use client";

import { useState, useTransition } from "react";
import type { OptionalService } from "@/lib/prefs-shared";
import { savePrefs } from "@/app/(main)/me/actions";
import { useRouter } from "next/navigation";

const OPTIONS: { id: OptionalService; title: string; detail: string }[] = [
  { id: "gemini", title: "Gemini AI", detail: "Blocks AI catch-up and Gemini image tools." },
  { id: "elevenlabs", title: "Read aloud · ElevenLabs", detail: "Your summary text goes to ElevenLabs when you request audio." },
  { id: "giphy", title: "GIF search · GIPHY", detail: "Search terms go to GIPHY when you search." },
  { id: "dms", title: "Direct messages", detail: "Stops relay connections; your local DM key stays saved." },
  { id: "map", title: "Community map · Firebase", detail: "Stops loading public pins and sharing your broad area." },
  { id: "analytics", title: "Usage analytics · Vercel", detail: "Sends limited, anonymous usage events." },
];

export function PrivacyOptions({ initialDisabled = [] }: { initialDisabled?: OptionalService[] }) {
  const [disabled, setDisabled] = useState<OptionalService[]>(initialDisabled);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: OptionalService, checked: boolean) {
    setDisabled((current) => checked ? [...new Set([...current, id])] : current.filter((service) => service !== id));
    setMessage("");
  }

  function save() {
    startTransition(async () => {
      try {
        const result = await savePrefs({ disabledServices: disabled });
        setMessage(result.ok ? "Choices saved on this device." : result.error);
        if (result.ok) router.refresh();
      } catch {
        setMessage("Could not save these choices. Try again.");
      }
    });
  }

  return <details className="privacy-options">
    <summary>Optional services <span>Choose what stays off</span></summary>
    <p className="privacy-options-intro">These controls stop listed services on this device. Farcaster data still uses this instance&apos;s Neynar service. Change choices anytime in Settings.</p>
    <div className="privacy-options-list">
      {OPTIONS.map((option) => <label className="privacy-option" key={option.id}>
        <input type="checkbox" checked={disabled.includes(option.id)} onChange={(event) => toggle(option.id, event.target.checked)} />
        <span><strong>Turn off {option.title}</strong><small>{option.detail}</small></span>
      </label>)}
    </div>
    <div className="privacy-options-footer"><button type="button" className="btn ghost sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save choices"}</button><span role="status" aria-live="polite">{message}</span></div>
  </details>;
}
