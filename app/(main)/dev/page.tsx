import Link from "next/link";
import { loadOwnMiniApps } from "@/app/(main)/me/actions";
import { SetupBanner } from "@/components/SetupBanner";
import { requireViewer } from "@/lib/viewer";

export default async function DevPage() {
  const viewer = await requireViewer();
  const result = await loadOwnMiniApps();
  if (!result.ok) return <SetupBanner error={new Error(result.error)} />;
  const apps = result.apps;
  return <>
    <div className="section-head"><div><h1>Developer</h1><p>Your mini apps and developer links.</p></div></div>
    <section className="me-section"><div className="me-section-head"><h2>Mini apps in your casts</h2><span className="meta">FID {viewer.fid} · latest 100 casts</span></div>
      <p className="field-hint">Apps linked from your recent top-level casts. Publish or edit apps through your existing host, then share a cast to have them appear here.</p>
      {!apps.length ? <div className="empty miniapp-empty"><h2>No mini apps found yet</h2><p>Share a cast containing a mini app link that identifies you as its creator. We’ll pick it up from your recent posts.</p></div> :
        <div className="miniapp-grid">{apps.map((app) => <a key={app.url} className="miniapp-card" href={app.url} target="_blank" rel="noopener noreferrer">
          {app.image ? <img src={app.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="miniapp-placeholder" aria-hidden="true">✳</span>}
          <span className="miniapp-card-copy"><b>{app.title}</b>{app.description && <span>{app.description}</span>}<small>{app.url}</small></span><span className="miniapp-open">Open ↗</span>
        </a>)}</div>}
    </section>
    <section className="me-section"><div className="me-section-head"><h2>Build and publish</h2></div><p className="field-hint">This client discovers apps from Farcaster and Neynar. For editing source, domains, and deployment, use the platform where you host the app.</p><a className="btn ghost sm miniapp-developer-link" href="https://miniapps.farcaster.xyz/" target="_blank" rel="noopener noreferrer">Mini Apps documentation ↗</a></section>
  </>;
}
