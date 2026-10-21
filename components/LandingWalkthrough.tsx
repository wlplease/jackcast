"use client";

import { useEffect, useState } from "react";

const TOUR = [
  {
    tab: "Following",
    title: "Read in time order",
    description: "See the latest posts from people you follow.",
    posts: [
      { avatar: "J", name: "Jordan", handle: "@jordan.builds", text: "Shipped a small update today. The best tools keep the useful parts close and stay out of your way.", meta: "12m · 8 likes · 2 recasts" },
      { avatar: "M", name: "Mina", handle: "@mina.eth", text: "What are you making this week? I’m collecting ideas from the builders here. ✨", meta: "26m · 14 likes · 4 replies" },
    ],
  },
  {
    tab: "Friends · Leaders",
    title: "Shape your feeds",
    description: "Keep close accounts in Friends. Browse active voices in Top Accounts.",
    posts: [
      { avatar: "A", name: "Ari", handle: "@ari.designs", text: "A few people I follow are comparing notes on the new mini app tools.", meta: "5m · Friends feed" },
      { avatar: "K", name: "Kai", handle: "@kai.eth", text: "Today’s builder roundup: three launches, one great open-source contribution, and a lot of good questions.", meta: "18m · Top Accounts" },
    ],
  },
  {
    tab: "Mini Apps · Media",
    title: "Open apps and media",
    description: "Launch Mini Apps here. Find photo, video, and audio posts in Media.",
    posts: [],
  },
];

export function LandingWalkthrough() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const slide = TOUR[active];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % TOUR.length), 4200);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <section className="landing-tour" aria-label="Jackcaster product walkthrough">
      <header className="landing-tour-heading">
        <div><span className="landing-tour-kicker">A QUICK LOOK</span><h3>Made for the way you follow</h3></div>
        <span className="landing-tour-sample">Illustrative sample · not a live feed</span>
      </header>
      <div className="landing-tour-stage">
        <div className="landing-tour-screen" role="img" aria-label={`${slide.tab} illustrative sample screen`}>
          <div className="tour-window-bar"><span className="tour-window-brand"><i aria-hidden="true">↟</i> jackcaster</span><span className="tour-window-icons"><i>⌕</i><i>✦</i><i>♙</i></span></div>
          <div className="tour-window-tabs">{["Following", "Friends", "Top", "Recasts", "Mini Apps", "Media"].map((tab) => <span key={tab} className={slide.tab.startsWith(tab) ? "selected" : ""}>{tab}</span>)}</div>
          {active < 2 ? <div className="tour-posts">{slide.posts.map((post) => <article className="tour-post" key={post.handle}>
            <span className={`tour-avatar avatar-${post.avatar.toLowerCase()}`}>{post.avatar}</span>
            <div className="tour-post-body"><div className="tour-post-author"><b>{post.name}</b><span>{post.handle}</span></div><p>{post.text}</p><small>{post.meta}</small><div className="tour-post-actions"><span>♡ <i>Like</i></span><span>↻ <i>Recast</i></span><span>◯ <i>Reply</i></span></div></div>
          </article>)}</div> : <div className="tour-discovery">
            <div className="tour-app-grid"><article><span className="tour-app-icon violet">◈</span><b>Build together</b><small>Mini App · Open in Jackcaster</small></article><article><span className="tour-app-icon mint">✳</span><b>Daily check-in</b><small>Mini App · Open in Jackcaster</small></article><article><span className="tour-app-icon gold">▶</span><b>Shared moments</b><small>Video · 0:18</small></article></div>
            <div className="tour-media-strip"><span>MEDIA</span><i /><i /><i /></div>
          </div>}
          <div className="tour-screen-footer"><span>JACKCASTER</span><span>YOUR FEED · YOUR RULES</span></div>
        </div>
        <div className="landing-tour-copy" aria-live="polite">
          <span className="landing-tour-step">0{active + 1} / 03</span><h4>{slide.title}</h4><p>{slide.description}</p>
          <div className="landing-tour-controls">
            <button type="button" className="tour-play" onClick={() => setPlaying((value) => !value)} aria-pressed={playing} aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}>{playing ? "Ⅱ" : "▶"}<span>{playing ? "Pause" : "Play"}</span></button>
            <div className="tour-step-buttons" aria-label="Walkthrough slides">{TOUR.map((item, index) => <button type="button" key={item.tab} className={index === active ? "active" : ""} onClick={() => setActive(index)} aria-label={`Show walkthrough step ${index + 1}: ${item.tab}`} aria-current={index === active ? "step" : undefined} />)}</div>
            <button type="button" className="tour-next" onClick={() => setActive((value) => (value + 1) % TOUR.length)} aria-label="Next walkthrough screen">→</button>
          </div>
        </div>
      </div>
    </section>
  );
}
