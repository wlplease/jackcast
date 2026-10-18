// Lightweight view-model types. The SDK types are huge and partly overlapping,
// so components work off these minimal shapes instead.

export type Author = {
  fid: number;
  username?: string;
  display_name?: string | null;
  pfp_url?: string | null;
  score?: number;
};

export type EmbedView = {
  url?: string;
  metadata?: {
    content_type?: string | null;
    image?: { width_px?: number; height_px?: number };
    video?: unknown;
    frame?: unknown;
    html?: {
      ogTitle?: string;
      ogDescription?: string;
      ogSiteName?: string;
      ogImage?: { url?: string }[];
      ogVideo?: { url?: string }[];
      oembed?: { type?: string; html?: string | null; title?: string | null; provider_name?: string | null };
    };
  };
  cast?: { hash: string; text: string; author: Author };
};

export type CastView = {
  hash: string;
  text: string;
  timestamp: string;
  author: Author;
  embeds: EmbedView[];
  channel?: { id: string; name?: string } | null;
  parent_hash: string | null;
  parent_author?: { fid?: number | null } | null;
  reactions: { likes_count: number; recasts_count: number };
  replies: { count: number };
  viewer_context?: { liked: boolean; recasted: boolean };
  recastedByViewer?: boolean;
};

export function asCast(c: unknown): CastView {
  return c as CastView;
}
