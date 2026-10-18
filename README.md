<p align="center"><img src="./public/icon-192.png" width="96" height="96" alt=""></p>

<h1 align="center">Selfcaster</h1>

<p align="center">Your own Farcaster client. Chronological, no algorithm, yours.<br>One deploy per person, locked with your password, hosted on your own Vercel.</p>

<p align="center"><a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FGenuineJack%2Fselfcaster&project-name=selfcaster&repository-name=selfcaster&env=NEYNAR_API_KEY,APP_PASSWORD&envDescription=NEYNAR_API_KEY%20is%20your%20key%20from%20dev.neynar.com.%20APP_PASSWORD%20locks%20your%20client%3A%20anyone%20with%20it%20can%20post%20as%20you%2C%20so%20make%20it%20long.&envLink=https%3A%2F%2Fgithub.com%2FGenuineJack%2Fselfcaster%23setup&stores=%5B%7B%22type%22%3A%22blob%22%2C%22access%22%3A%22public%22%7D%5D"><img src="https://vercel.com/button" alt="Deploy with Vercel"></a></p>

<p align="center">
  <img src="./docs/screenshot-light.png" width="300" alt="Selfcaster feed, light">
  &nbsp;
  <img src="./docs/screenshot-dark.png" width="300" alt="Selfcaster feed, dark">
</p>

## What you get

- **A calm Following feed.** Newest first, every time. A caught-up line where you left off, and a "new casts" pill instead of the page jumping around. Recasts are off by default because they carry the original cast's time and scramble the order. Flip them on if you want them.
- **Favorite channels.** Search every channel you follow and pick a few. They become your feed tabs and the only channels in the composer.
- **Posting that works.** Photos (up to 2, compressed on your phone first), links, quote casts, replies, threads with context.
- **Media inline.** Farcaster videos, YouTube, Spotify, SoundCloud, Bandcamp and archive.org play right in the feed.
- **Your filters.** Muted words, phrases, $tickers and @handles, plus a quality dial that hides low-score accounts.
- **Themes.** Selfcaster, Orange, Stone, Farcaster, Higher, Twitter and X, each in light and dark. Every color is contrast-checked.
- **The rest.** Search, notifications, profiles, your posting stats, edit your profile, installable as an app on your phone.

What it doesn't do: DMs (on purpose), ads, an algorithm, or tracking.

## What you need

- A **GitHub** account (free) and a **Vercel** account (the free Hobby plan is enough).
- A **Neynar API key** from [dev.neynar.com](https://dev.neynar.com). Neynar is the API Selfcaster reads and writes through. Their free plan is enough to try it; reading, posting and the connected account all use credits, so a daily user will likely want a paid plan. See [neynar.com/pricing](https://neynar.com/pricing).
- Your **Farcaster account** and its **recovery phrase**, used once in your browser to approve the app. More on that below.

## Setup

About 10 minutes, no Terminal.

### 1. Get a Neynar API key

Sign up at [dev.neynar.com](https://dev.neynar.com) and create an API key.

### 2. Click Deploy

Hit the **Deploy with Vercel** button above. Vercel will:

1. make your own copy of this repo in your GitHub,
2. create a public Blob store for your photos,
3. ask for two values:

| Var | Value |
| --- | --- |
| `NEYNAR_API_KEY` | your key from step 1 |
| `APP_PASSWORD` | something long. Anyone with it can post as you. |

Then it builds and gives you a URL.

### 3. Connect your account at `/setup`

Open your URL, enter your password, and you'll land on `/setup`.

1. Paste your Farcaster recovery phrase (Farcaster app settings, usually under Advanced). The page signs one key request **in your browser** and clears it. The phrase is never sent to the server or saved. See [SECURITY.md](./SECURITY.md).
2. Approve in the Farcaster app: scan the QR on desktop, or tap **Open in Farcaster** on your phone.
3. Done. That device is connected.

The last screen shows `SIGNER_UUID` and `MY_FID`. Add both in Vercel (**Settings, Environment Variables**) and redeploy, so every device is connected, not just this one.

Rather not use your main recovery phrase? Make a separate Farcaster account just for this and use its phrase. You still approve and post as *you*. The other account only shows up as the app that asked.

To revoke access later: Farcaster app settings, connected apps.

### 4. Put it on your phone

Open your URL in Safari or Chrome and **Add to Home Screen**.

<details>
<summary>Prefer to set it up by hand?</summary>

1. On GitHub, **Use this template**, **Create a new repository**.
2. In Vercel, **Add New, Project**, import it, and add `NEYNAR_API_KEY` and `APP_PASSWORD` before deploying.
3. For photos: **Storage, Create, Blob**, choose **Public**, connect it to the project, redeploy. (A private store works too. Selfcaster serves those photos itself at `/i/...` so other clients can see them.)
4. Continue with step 3 above.

</details>

## Make it yours

- **Name and wordmark:** `lib/brand.ts`.
- **Icons:** replace the PNGs in `public/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon-32.png`).
- **Colors:** add or edit a theme in `lib/themes.ts`, then run `npm run check:themes` to check contrast.
- **Default tabs:** `PINNED_CHANNELS` (comma separated, no slashes) until you pick favorites in the app.

All optional settings are in [`.env.example`](./.env.example).

## Getting updates

The Deploy button and the template both make a fresh copy, so your repo won't update on its own. Watch this repo's [releases and commits](https://github.com/GenuineJack/selfcaster/commits/main) and copy over what you want. If you're comfortable with git, you can merge directly (your copy has its own history, so the first merge needs a flag, and any files you changed may conflict):

```bash
git remote add upstream https://github.com/GenuineJack/selfcaster.git
git pull upstream main --allow-unrelated-histories
```

Want updates to be one click? Fork this repo instead of using the Deploy button, then import your fork into Vercel by hand. GitHub's **Sync fork** button will pull in new versions. Forks of a public repo are public, which is fine: there are no secrets in the code.

## How it works

```
your browser ── password cookie ──> Next.js on Vercel ──> Neynar API ──> Farcaster
                                       │
                                       └─ SIGNER_UUID: Neynar holds a key your
                                          account approved once, and signs casts with it
```

All Neynar calls happen on the server. Your API key and signer never reach the browser. Settings like mutes, favorites and theme are stored per device in a cookie.

## Running locally

```bash
npm install
cp .env.example .env.local   # add NEYNAR_API_KEY
npm run dev
```

Open http://localhost:3000/setup. Without `APP_PASSWORD`, local dev skips the lock screen.

Checks: `npm run typecheck`, `npm run check:themes`, `NEYNAR_API_KEY=x npm run build`.

## Contributing

Issues and pull requests are welcome. [CLAUDE.md](./CLAUDE.md) has the architecture, decisions and conventions (written for people and AI coding agents alike), and [ROADMAP.md](./ROADMAP.md) has ideas.

## License

[MIT](./LICENSE). Made by [@genuinejack](https://farcaster.xyz/genuinejack).
