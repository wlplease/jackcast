export default function MiniAppsLoading() {
  return <section className="miniapps-loading" aria-busy="true" aria-label="Loading Mini Apps">
    <p role="status">Loading Mini Apps…</p>
    <div className="miniapps-loading-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="miniapps-loading-card" key={index}><i /><span><b /><small /></span><em /></div>)}</div>
  </section>;
}
