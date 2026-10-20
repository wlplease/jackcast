import "server-only";
import { clean } from "@/lib/data";
import type { CastView } from "@/lib/types";
import type { ThreadReplyNode } from "@/lib/thread-types";

type NestedCast = CastView & { direct_replies?: NestedCast[] };

export const THREAD_DEPTH = 4;
export const THREAD_REPLY_LIMIT = 120;

export async function buildReplyTree(
  rawReplies: unknown[],
  viewerFid: number,
  budget: { remaining: number } = { remaining: THREAD_REPLY_LIMIT },
  depth = 1,
): Promise<{ nodes: ThreadReplyNode[]; hidden: number; truncated: boolean }> {
  if (!rawReplies.length) return { nodes: [], hidden: 0, truncated: false };
  if (depth > THREAD_DEPTH || budget.remaining <= 0) return { nodes: [], hidden: 0, truncated: true };

  const { casts: filteredCasts, hidden } = await clean(rawReplies, viewerFid);
  const casts = [...filteredCasts].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const nodes: ThreadReplyNode[] = [];
  let hiddenReplies = hidden;
  let truncated = casts.length > budget.remaining;

  for (const cast of casts) {
    if (budget.remaining <= 0) {
      truncated = true;
      break;
    }
    budget.remaining -= 1;
    const nestedCast = cast as NestedCast;
    const nested = await buildReplyTree(
      nestedCast.direct_replies ?? [],
      viewerFid,
      budget,
      depth + 1,
    );
    hiddenReplies += nested.hidden;
    const replyCount = cast.replies?.count ?? 0;
    const hasMore = nested.truncated || replyCount > nested.nodes.length || (depth >= THREAD_DEPTH && replyCount > 0);
    truncated ||= hasMore;
    nodes.push({ cast, children: nested.nodes, hasMore });
  }

  return { nodes, hidden: hiddenReplies, truncated };
}
