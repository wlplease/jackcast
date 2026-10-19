"use client";

import { useEffect, useRef, useState } from "react";

const EMOJI_GROUPS = [
  { label: "Reactions", items: ["😀", "😂", "🥹", "😍", "🤔", "🙌", "👏", "🔥", "❤️", "💜", "💚", "✨"] },
  { label: "Farcaster favorites", items: ["🫡", "🪄", "🎩", "🟪", "🟣", "🧠", "🚀", "🌱", "💎", "⚡", "👀", "🤝"] },
  { label: "More", items: ["🎉", "🙏", "💯", "☀️", "🌈", "🌍", "🎶", "📣", "💡", "🫶", "😎", "🤗"] },
];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="emoji-picker-wrap" ref={root}>
      <button type="button" className="tool emoji-tool" aria-label="Add emoji" title="Add emoji" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">☺</span>
      </button>
      {open && <div className="emoji-picker" role="dialog" aria-label="Choose an emoji">
        {EMOJI_GROUPS.map((group) => <section key={group.label}>
          <h3>{group.label}</h3>
          <div className="emoji-picker-grid">
            {group.items.map((emoji) => <button key={emoji} type="button" aria-label={`Insert ${emoji}`} onClick={() => { onSelect(emoji); setOpen(false); }}>{emoji}</button>)}
          </div>
        </section>)}
      </div>}
    </div>
  );
}
