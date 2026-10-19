import { ShareJackcasterButton } from "@/components/ShareJackcasterButton";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <ShareJackcasterButton />
      <p><a href="https://github.com/wlplease/jackcast" target="_blank" rel="noopener noreferrer"><strong>Jackcaster</strong></a> is an open-source personal fork of <a href="https://github.com/GenuineJack/selfcaster" target="_blank" rel="noopener noreferrer">Selfcaster</a>.</p>
      <nav aria-label="Project credits">
        <a href="https://github.com/wlplease/jackcast" target="_blank" rel="noopener noreferrer">Jackcaster source</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/GenuineJack/selfcaster" target="_blank" rel="noopener noreferrer">Original Selfcaster project</a>
        <span aria-hidden="true">·</span>
        <a href="https://farcaster.xyz/genuinejack" target="_blank" rel="noopener noreferrer">GenuineJack on Farcaster</a>
      </nav>
    </footer>
  );
}
