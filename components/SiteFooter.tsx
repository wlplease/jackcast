import Link from "next/link";
import { ShareJackcasterButton } from "@/components/ShareJackcasterButton";
import { MobileAppNav } from "@/components/MobileAppNav";

const ExternalLinkIcon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}<path d="M14 4h6v6M20 4l-9 9" />
  </svg>
);

export function SiteFooter() {
  return <footer className="site-footer">
    <MobileAppNav />
    <div className="site-footer-brand"><span className="site-footer-spark" aria-hidden="true">↑</span><span><strong>Jackcaster</strong><small>Built on open-source Selfcaster</small></span></div>
    <nav aria-label="Project links">
      <Link href="/map" className="site-footer-map" aria-label="Community map" title="Community map"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c2.4 2.5 3.5 5.5 3.5 9s-1.1 6.5-3.5 9c-2.4-2.5-3.5-5.5-3.5-9S9.6 5.5 12 3Z"/></svg><span>Map</span></Link>
      <a href="https://github.com/wlplease/jackcast" target="_blank" rel="noopener noreferrer" aria-label="Jackcaster source on GitHub" title="Jackcaster source"><ExternalLinkIcon><path d="M8 20c-4 1-4-2-5-2m10 4v-3.1a2.7 2.7 0 0 0-.8-2.1c2.7-.3 5.5-1.3 5.5-6A4.7 4.7 0 0 0 16.5 8a4.4 4.4 0 0 0-.1-3.3S15.3 4.4 13 6a12 12 0 0 0-6 0C4.7 4.4 3.6 4.7 3.6 4.7A4.4 4.4 0 0 0 3.5 8a4.7 4.7 0 0 0-1.2 3.3c0 4.7 2.8 5.7 5.5 6A2.7 2.7 0 0 0 7 19.4V22" /></ExternalLinkIcon></a>
      <a href="https://github.com/GenuineJack/selfcaster" target="_blank" rel="noopener noreferrer" aria-label="Original Selfcaster source on GitHub" title="Original Selfcaster"><ExternalLinkIcon><path d="M8 20c-4 1-4-2-5-2m10 4v-3.1a2.7 2.7 0 0 0-.8-2.1c2.7-.3 5.5-1.3 5.5-6A4.7 4.7 0 0 0 16.5 8a4.4 4.4 0 0 0-.1-3.3S15.3 4.4 13 6a12 12 0 0 0-6 0C4.7 4.4 3.6 4.7 3.6 4.7A4.4 4.4 0 0 0 3.5 8a4.7 4.7 0 0 0-1.2 3.3c0 4.7 2.8 5.7 5.5 6A2.7 2.7 0 0 0 7 19.4V22" /></ExternalLinkIcon></a>
      <Link href="/u/genuinejack" aria-label="GenuineJack profile inside Jackcaster" title="Creator profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1-3.2 3.5-5 7.5-5s6.5 1.8 7.5 5"/><circle cx="19" cy="5" r="2"/></svg></Link>
      <ShareJackcasterButton />
    </nav>
  </footer>;
}
