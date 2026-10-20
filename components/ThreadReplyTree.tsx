"use client";

import { useState } from "react";
import { loadThreadReplies } from "@/app/actions";
import { ThreadReplyBranch } from "@/components/ThreadReplyBranch";
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

function countNodes(nodes: ThreadReplyNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countNodes(node.children), 0);
}

export function ThreadReplyTree({
  parentHash,
  initialNodes,
  initialCursor,
  initialHidden,
  initiallyTruncated,
  canWrite,
  viewerFid,
  mutes,
}: {
  parentHash: string;
  initialNodes: ThreadReplyNode[];
  initialCursor: string | null;
  initialHidden: number;
  initiallyTruncated: boolean;
  canWrite: boolean;
  viewerFid: number;
  mutes: string[];
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [cursor, setCursor] = useState(initialCursor);
  const [rootLoaded, setRootLoaded] = useState(false);
  const [hidden, setHidden] = useState(initialHidden);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const replyCount = countNodes(nodes);

  async function loadNextPage() {
    setLoading(true);
    setError("");
    try {
      const result = await loadThreadReplies({ parentHash, cursor: cursor ?? undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNodes((current) => mergeNodes(current, result.nodes));
      setHidden((current) => current + result.hidden);
      setCursor(result.cursor);
      setRootLoaded(true);
    } catch {
      setError("Couldn't load those replies just now. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const canLoadRoot = Boolean(cursor) || (initiallyTruncated && !rootLoaded);

  return (
    <section className="thread-conversation" aria-labelledby="thread-conversation-title">
      <header className="thread-conversation-head">
        <div>
          <span className="thread-kicker">FOLLOW THE BRANCHES</span>
          <h2 id="thread-conversation-title">Replies</h2>
        </div>
        <span className="thread-reply-count">
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
          {replyCount > 0 && <small> · four levels at a time</small>}
        </span>
      </header>
      {nodes.length > 0 ? (
        <div className="thread-reply-tree">
          {nodes.map((node) => (
            <ThreadReplyBranch key={node.cast.hash} node={node} canWrite={canWrite} viewerFid={viewerFid} mutes={mutes} depth={1} />
          ))}
        </div>
      ) : (
        <div className="thread-empty"><span aria-hidden="true">↳</span><p>{canWrite ? "No replies yet. Start the conversation." : "No replies yet."}</p></div>
      )}
      {hidden > 0 && <div className="hidden-note">{hidden} {hidden === 1 ? "reply" : "replies"} hidden by your filters.</div>}
      {initiallyTruncated && !canLoadRoot && <p className="thread-limit-note">Some branches continue. Use “Show deeper replies” on a branch to follow them.</p>}
      {canLoadRoot && (
        <div className="thread-load-more-wrap thread-load-more-root">
          <button type="button" className="thread-load-more" onClick={loadNextPage} disabled={loading}>
            {loading ? "Loading replies…" : cursor ? "Load more replies" : "Load the next conversation page"}
          </button>
          {error && <p className="thread-load-error" role="status">{error}</p>}
        </div>
      )}
    </section>
  );
}
