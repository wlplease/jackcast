import type { CastView } from "@/lib/types";

export type ThreadReplyNode = {
  cast: CastView;
  children: ThreadReplyNode[];
  hasMore: boolean;
};
