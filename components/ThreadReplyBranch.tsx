"use client";

import { useEffect, useState } from "react";
import { loadThreadReplies } from "@/app/actions";
import { CastCard } from "@/components/CastCard";
import type { ThreadReplyNode } from "@/lib/thread-types";

function mergeNodes(current: ThreadReplyNode[], incoming: ThreadReplyNode[]): ThreadReplyNode[] {
  const byHash = new Map(current.map((node) => [node.cast.hash, node]));
  for (const node of incoming) {
    const existing = byHash.get(node.cast.hash);
    byHash.set(node.cast.hash, existing
      ? { ...existing, ...node, children: mergeNodes(existing.children, node.children), hasMore: existing.hasMore || node.hasMore }
      : node);
  }
  return [...byHash.values()].sort((a, b) => Date.parse(a.cast.timestamp) - Date.parse(b.cast.timestamp));
}

export function ThreadReplyBranch({
  node,
  canWrite,
  viewerFid,
  mutes,
  depth,
}: {
  node: ThreadReplyNode;
  canWrite: boolean;
  viewerFid: number;
  mutes: string[];
  depth: number;
}) {
  const [children, setChildren] = useState(node.children);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setChildren((current) => mergeNodes(current, node.children));
  }, [node.children]);

  async function loadReplies() {
    setLoading(true);
    setError("");
    try {
      const result = await loadThreadReplies({ parentHash: node.cast.hash, cursor: cursor ?? undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setChildren((current) => mergeNodes(current, result.nodes));
      setCursor(result.cursor);
      setLoaded(true);
    } catch {
      setError("Couldn't load those replies just now. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const canLoad = Boolean(cursor) || (node.hasMore && !loaded);

  return (
    <div className="thread-reply-branch">
      <CastCard cast={node.cast} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} showReplyTo={false} />
      {children.length > 0 && (
        <div className="thread-reply-children">
          {children.map((child) => (
            <ThreadReplyBranch key={child.cast.hash} node={child} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} depth={depth + 1} />
          ))}
        </div>
      )}
      {canLoad && (
        <div className="thread-load-more-wrap">
          <button type="button" className="thread-load-more" onClick={loadReplies} disabled={loading}>
            {loading ? "Loading replies…" : cursor ? "Load more replies" : `Show deeper replies · level ${depth + 1}`}
          </button>
          {error && <p className="thread-load-error" role="status">{error}</p>}
        </div>
      )}
    </div>
  );
}
