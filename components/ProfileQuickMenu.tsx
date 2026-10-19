"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ProfileIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.3-3.6 4.2-5.4 7.5-5.4s6.2 1.8 7.5 5.4" /></svg>;

export function ProfileQuickMenu({ animatedProfilesEnabled }: { animatedProfilesEnabled: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <button type="button" className="icon-btn" aria-label="Your profile options" title="Your profile" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <ProfileIcon />
    </button>
    {open && <div className="profile-quick-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="profile-quick-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-quick-title" aria-describedby="profile-quick-description">
        <button type="button" className="profile-quick-close" aria-label="Close profile options" onClick={() => setOpen(false)}>×</button>
        <span className="profile-quick-icon"><ProfileIcon /></span>
        <p className="profile-quick-kicker">YOUR JACKCASTER PROFILE</p>
        <h2 id="profile-quick-title">Make your profile yours</h2>
        <p id="profile-quick-description">View your activity, edit your profile, or make it move.</p>
        <nav className="profile-quick-options" aria-label="Profile actions">
          <Link href="/profile" onClick={() => setOpen(false)}><span><strong>View profile</strong><small>Recent casts and stats</small></span><b aria-hidden="true">›</b></Link>
          <Link href="/me/edit" onClick={() => setOpen(false)}><span><strong>Edit profile</strong><small>Photo, name, bio, and cover</small></span><b aria-hidden="true">›</b></Link>
          {animatedProfilesEnabled
            ? <Link className="profile-quick-featured" href="/me/edit#grok-profile-studio" onClick={() => setOpen(false)}><span><strong>Animate your profile</strong><small>See price and credits first</small></span><b aria-hidden="true">✦</b></Link>
            : <div className="profile-quick-unavailable"><strong>Animated profile studio</strong><small>Not enabled on this deployment</small></div>}
        </nav>
        <p className="profile-quick-credit-note">Credits stay with your Base wallet. No purchase until you approve it.</p>
      </section>
    </div>}
  </>;
}
