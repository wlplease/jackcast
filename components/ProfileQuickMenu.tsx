import Link from "next/link";

const ProfileIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.3-3.6 4.2-5.4 7.5-5.4s6.2 1.8 7.5 5.4" /></svg>;

export function ProfileQuickMenu() {
  return (
    <Link href="/profile" className="icon-btn" aria-label="Your profile" title="Your profile">
      <ProfileIcon />
    </Link>
  );
}
