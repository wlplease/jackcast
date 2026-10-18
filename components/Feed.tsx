import { Fragment } from "react";
import Link from "next/link";
import type { Page } from "@/lib/data";
import { CastCard } from "./CastCard";
import { CaughtUpProvider, SeenLine } from "./CaughtUp";
import { NewCastsPill } from "./NewCastsPill";
import { ExpandableCasts } from "./ExpandableCasts";
import { groupRepeatedLinks } from "@/lib/feed-groups";
import { getPrefs } from "@/lib/prefs";
import { AICatchUp } from "./AICatchUp";

export async function Feed({
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
  const prefs = await getPrefs();
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

  const groups = prefs.groupLinks ? groupRepeatedLinks(page.casts) : page.casts.map((cast) => [cast]);
  const list = groups.map((group, i) => (
    <Fragment key={group[0].hash}>
      {live && i > 0 && <SeenLine above={groups[i - 1][0].timestamp} below={group[0].timestamp} />}
      <CastCard cast={group[0]} canWrite={canWrite} />
      {group.length > 1 && (
        <ExpandableCasts count={group.length - 1}>
          {group.slice(1).map((cast) => <CastCard key={cast.hash} cast={cast} canWrite={canWrite} />)}
        </ExpandableCasts>
      )}
    </Fragment>
  ));

  const newest = page.casts[0]?.timestamp ?? null;

  return (
    <>
      {live ? (
        <>
          {live === "following" && process.env.GOOGLE_AI_API_KEY && <AICatchUp casts={page.casts} audioEnabled={Boolean((process.env.ELEVENLABS_API_KEY || process.env.ELEVELN_LAB_API_KEY) && process.env.ELEVENLABS_VOICE_ID)} />}
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
