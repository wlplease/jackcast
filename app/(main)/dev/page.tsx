import { loadOwnMiniApps } from "@/app/(main)/me/actions";
import { SetupBanner } from "@/components/SetupBanner";
import { requireViewer } from "@/lib/viewer";
import { MiniAppLaunchButton } from "@/components/MiniAppLaunchButton";
import { RefreshOwnMiniAppsButton } from "@/components/RefreshOwnMiniAppsButton";

const developerLinks = [
  { title: "Publish a Mini App", description: "Verify your app URL, manifest, and Farcaster account association.", href: "https://farcaster.xyz/~/developers/mini-apps/manifest", label: "Farcaster developer tools", kind: "Publish" },
  { title: "Mini Apps SDK", description: "Read the SDK guide for wallet, sharing, and in-app features.", href: "https://miniapps.farcaster.xyz/", label: "Official documentation", kind: "Build" },
  { title: "Jackcaster", description: "This open-source client fork, its issues, and the changes maintained here.", href: "https://github.com/wlplease/jackcast", label: "Jackcaster source", kind: "This fork" },
  { title: "Original Selfcaster", description: "The upstream project this personal fork is based on.", href: "https://github.com/GenuineJack/selfcaster", label: "Selfcaster source", kind: "Upstream" },
  { title: "GenuineJack", description: "Visit the original creator’s Farcaster profile.", href: "https://farcaster.xyz/genuinejack", label: "Farcaster profile", kind: "Creator" },
];

export default async function DevPage() {
  const viewer = await requireViewer();
  const result = await loadOwnMiniApps();
  if (!result.ok) return <SetupBanner error={new Error(result.error)} />;
  const apps = result.apps;
  return <>
    <div className="section-head"><div><h1>Developer</h1><p>Your Mini Apps, publishing tools, and project links in one place.</p></div></div>
    <section className="me-section"><div className="me-section-head"><h2>Apps attributed to your account</h2><span className="meta">FID {viewer.fid} · creator search + recent casts</span><RefreshOwnMiniAppsButton /></div>
      <p className="field-hint">We match Neynar’s indexed creator attribution to your FID, then include apps identified in your recent casts. Discovery refreshes every six hours to keep extra API pulls low.</p>
      {!apps.length ? <div className="empty miniapp-empty"><h2>No indexed apps matched yet</h2><p>Your published apps can exist even when Neynar has not indexed their creator details. Check the domains and account association in Farcaster’s developer tools, then try again after indexing updates.</p><a className="btn ghost sm" href="https://farcaster.xyz/~/developers/mini-apps/manifest" target="_blank" rel="noopener noreferrer">Open Farcaster developer tools ↗</a></div> :
        <div className="miniapp-grid">{apps.map((app) => <article key={app.url} className="miniapp-card">
          {app.image ? <img src={app.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="miniapp-placeholder" aria-hidden="true">✳</span>}
          <span className="miniapp-card-copy"><b>{app.title}</b>{app.description && <span>{app.description}</span>}<small>{app.url}</small></span><span className="miniapp-actions"><MiniAppLaunchButton app={{ url: app.url, title: app.title }} /></span>
        </article>)}</div>}
    </section>
    <section className="me-section dev-project-section"><div className="me-section-head"><div><h2>Build, publish, and contribute</h2><p className="field-hint">Jackcaster is a personal open-source fork of Selfcaster. The projects have separate repositories and maintainers; this page links to both, with original project credit.</p></div></div>
      <div className="dev-link-grid">{developerLinks.map((link) => <a key={link.href} className="dev-link-card" href={link.href} target="_blank" rel="noopener noreferrer"><span className="dev-link-kind">{link.kind}</span><strong>{link.title}</strong><span className="dev-link-description">{link.description}</span><span className="dev-link-label">{link.label} <span aria-hidden="true">↗</span></span></a>)}</div>
      <p className="field-hint dev-publish-note">Publishing and account association are managed in Farcaster’s developer tools. Edit and deploy app source with your hosting provider.</p>
    </section>
  </>;
}
