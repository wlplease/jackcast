"use client";

import { useState } from "react";

export function ExpandableCasts({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="repeat-group">
      <button className="repeat-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {open ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
        </svg>
        {open ? `Hide ${count} similar posts` : `${count} more ${count === 1 ? "post shares" : "posts share"} this link`}
      </button>
      {open && <div className="repeat-items">{children}</div>}
    </div>
  );
}
