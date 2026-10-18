import { Fragment } from "react";
import Link from "next/link";
import type { Page } from "@/lib/data";
import { CastCard } from "./CastCard";
import { CaughtUpProvider, SeenLine } from "./CaughtUp";
import { NewCastsPill } from "./NewCastsPill";

export function Feed({
  page,
  basePath,
  canWrite,
  live,
  emptyTitle = "Quiet in here",
  emptyBody = "Nothing to show yet.",
}: {
  page: Page;
  basePath: string;
  canWrite: boolean;
  /** Feed id ("following" or "c:<channel>") to enable the caught-up line and new-casts pill. First page only. */
  live?: string;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const hiddenNote =
    page.hidden > 0 ? (
      <div className="hidden-note">
        {page.hidden} {page.hidden === 1 ? "cast" : "casts"} hidden by your filters.{" "}
        <Link href="/me#filters">Adjust</Link>
      </div>
    ) : null;

  if (!page.casts.length) {
    return (
      <>
        <div className="empty">
          <h2>{emptyTitle}</h2>
          <p>{emptyBody}</p>
        </div>
        {hiddenNote}
      </>
    );
  }

  const list = page.casts.map((c, i) => (
    <Fragment key={c.hash}>
      {live && i > 0 && <SeenLine above={page.casts[i - 1].timestamp} below={c.timestamp} />}
      <CastCard cast={c} canWrite={canWrite} />
    </Fragment>
  ));

  const newest = page.casts[0]?.timestamp ?? null;

  return (
    <>
      {live ? (
        <>
          <NewCastsPill feed={live} newest={newest} />
          <CaughtUpProvider feed={live} newest={newest}>
            {list}
          </CaughtUpProvider>
        </>
      ) : (
        list
      )}
      {hiddenNote}
      {page.cursor && (
        <Link className="more" href={`${basePath}${basePath.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(page.cursor)}`}>
          older →
        </Link>
      )}
    </>
  );
}
