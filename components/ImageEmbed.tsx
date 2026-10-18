"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element */
export function ImageEmbed({ src }: { src: string }) {
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
      <button type="button" className="embed-image-link" onClick={() => setOpen(true)} aria-label="Expand image">
        <img className="embed-img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
      </button>
      <dialog
        ref={dialog}
        className="image-lightbox"
        aria-label="Expanded cast image"
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        <button type="button" className="image-lightbox-close" onClick={() => setOpen(false)}>Close</button>
        <img src={src} alt="Expanded cast image" referrerPolicy="no-referrer" />
        <a href={src} target="_blank" rel="noreferrer">Open original image</a>
      </dialog>
    </>
  );
}
