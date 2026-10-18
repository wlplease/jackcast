import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell">
      <div className="empty">
        <h2>Nothing here</h2>
        <p>
          That cast or account doesn&apos;t exist. <Link href="/" style={{ color: "var(--accent)" }}>Back to your feed</Link>
        </p>
      </div>
    </div>
  );
}
