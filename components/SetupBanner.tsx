export function SetupBanner({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="banner">
      <strong>Can&apos;t reach Farcaster yet.</strong> {msg}
      <br />
      Check <code>NEYNAR_API_KEY</code> and <code>MY_FID</code> in your env, then reload.
    </div>
  );
}
