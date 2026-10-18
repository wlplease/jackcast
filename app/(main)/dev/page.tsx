import { loadOwnMiniApps } from "@/app/(main)/me/actions";
import { SetupBanner } from "@/components/SetupBanner";
import { requireViewer } from "@/lib/viewer";
import { MiniAppLaunchButton } from "@/components/MiniAppLaunchButton";
import { RefreshOwnMiniAppsButton } from "@/components/RefreshOwnMiniAppsButton";

export default async function DevPage() {
  const viewer = await requireViewer();
  const result = await loadOwnMiniApps();
  if (!result.ok) return <SetupBanner error={new Error(result.error)} />;
  const apps = result.apps;
  return <>
    <div className="section-head"><div><h1>Developer</h1><p>Your mini apps and developer links.</p></div></div>
    <section className="me-section"><div className="me-section-head"><h2>Apps attributed to your account</h2><span className="meta">FID {viewer.fid} · creator search + recent casts</span><RefreshOwnMiniAppsButton /></div>
      <p className="field-hint">We match Neynar’s indexed creator attribution to your FID, then include apps identified in your recent casts. Discovery refreshes every six hours to keep extra API pulls low.</p>
      {!apps.length ? <div className="empty miniapp-empty"><h2>No indexed apps matched yet</h2><p>Your published apps can exist even when Neynar has not indexed their creator details. Check the domains and account association in Farcaster’s developer tools, then try again after indexing updates.</p><a className="btn ghost sm" href="https://farcaster.xyz/~/developers/mini-apps/manifest" target="_blank" rel="noopener noreferrer">Open Farcaster developer tools ↗</a></div> :
        <div className="miniapp-grid">{apps.map((app) => <article key={app.url} className="miniapp-card">
          {app.image ? <img src={app.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="miniapp-placeholder" aria-hidden="true">✳</span>}
          <span className="miniapp-card-copy"><b>{app.title}</b>{app.description && <span>{app.description}</span>}<small>{app.url}</small></span><span className="miniapp-actions"><MiniAppLaunchButton app={{ url: app.url, title: app.title }} /></span>
        </article>)}</div>}
    </section>
    <section className="me-section"><div className="me-section-head"><h2>Build and publish</h2></div><p className="field-hint">Manage published domains and account association in Farcaster’s developer tools. For editing source and deployment, use the platform where you host each app.</p><a className="btn ghost sm miniapp-developer-link" href="https://miniapps.farcaster.xyz/" target="_blank" rel="noopener noreferrer">Mini Apps documentation ↗</a></section>
  </>;
}
