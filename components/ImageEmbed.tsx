"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element */
export function ImageEmbed({ src, animated = false }: { src: string; animated?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <div className="embed-image-wrap">
        <button type="button" className={`embed-image-link${animated ? " animated-image" : ""}`} onClick={() => setOpen(true)} aria-label={animated ? "Expand GIF" : "Expand image"}>
          <img className="embed-img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </button>
        {!animated && <a className="embed-image-open" href={src} target="_blank" rel="noreferrer" aria-label="Open image in a new tab" title="Open original in a new tab">↗</a>}
      </div>
      <dialog
        ref={dialog}
        className="image-lightbox"
        aria-label="Expanded cast image"
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        <button type="button" className="image-lightbox-close" onClick={() => setOpen(false)}>Close</button>
        <img src={src} alt="Expanded cast image" referrerPolicy="no-referrer" />
        {!animated && <a href={src} target="_blank" rel="noreferrer">Open original image</a>}
      </dialog>
    </>
  );
}
