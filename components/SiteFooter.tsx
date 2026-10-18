export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Jackcaster is an open-source personal fork based on Selfcaster.</p>
      <nav aria-label="Project credits">
        <a href="https://selfcaster.xyz/" target="_blank" rel="noopener noreferrer">Original app</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/GenuineJack" target="_blank" rel="noopener noreferrer">Creator: GenuineJack</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/GenuineJack/selfcaster" target="_blank" rel="noopener noreferrer">Original repository</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/wlplease/jackcast" target="_blank" rel="noopener noreferrer">Jackcast source</a>
      </nav>
    </footer>
  );
}
