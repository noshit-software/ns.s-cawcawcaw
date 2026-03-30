# cawcawcaw

You push code. Claude watches. When there's a story worth telling, it writes it and posts it.

No scheduling tools, no "content calendars," no copy-paste into LinkedIn. You commit. It crows.

---

## What it does

1. You push to GitHub
2. Claude reads the accumulating commits — sometimes 2, sometimes 12
3. When the narrative is ready, it writes a post and queues it
4. You review (or don't — your call) and it publishes

One post per day, max. Across all projects. The scheduler enforces this globally.

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/noshit-software/ns.s-cawcawcaw.git
cd ns.s-cawcawcaw
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`. Two things are required:

```
GITHUB_WEBHOOK_SECRET=     # make something up
ANTHROPIC_API_KEY=         # https://console.anthropic.com
```

Everything else is optional or configured through the UI.

### 3. Run

```bash
npm start          # dev (tsx, hot reload)
npm run build      # compile
npm run start:prod # production (node, needs build first)
```

```
[cawcawcaw] Listening on port 3000
[cawcawcaw] UI: http://localhost:3000
[scheduler] Started
```

Runtime data lives in `data/`. Created automatically on first run.

---

## Connecting LinkedIn (the model)

LinkedIn is the fully wired platform. Here's the exact flow:

### 1. Create a LinkedIn app

Go to [developer.linkedin.com](https://developer.linkedin.com) → Create App.

You need:
- A LinkedIn Company Page (create one if you don't have one — it can be bare)
- App name, logo, whatever

### 2. Get your credentials

In your app's **Auth** tab:
- Copy **Client ID** and **Client Secret** into `.env`
- Add `http://localhost:3000/auth/linkedin/callback` to **Authorized redirect URLs**

### 3. Request the right products

In the **Products** tab, request:
- **Share on LinkedIn** — this is what lets you post
- **Sign In with LinkedIn using OpenID Connect** — this gets your member ID

Both need approval. Share on LinkedIn can take a few hours. OpenID Connect is usually instant.

**Gotcha:** Without "Share on LinkedIn" approved, the OAuth flow works but posting returns a 403. You'll see `CONNECT` succeed and then `Published → failed` in the queue. This is LinkedIn being LinkedIn.

### 4. Connect in the UI

Open `http://localhost:3000` → `[1] PLATFORMS` → click **LINKEDIN** → **CONNECT**.

The OAuth flow handles everything — access token, refresh token, author URN. All stored in `data/credentials.json`.

**Gotcha:** LinkedIn access tokens expire in 60 days. Refresh tokens last a year. The app doesn't auto-refresh yet — if posts start failing after two months, click RECONNECT.

---

## Adding a project

`[3] PROJECTS` → type a name → **+ ADD** → expand it.

| Field | What it does |
|-------|-------------|
| **Schedule** | When the publish window opens. `05:00` (default), `09:00 weekdays`, `09:00 weekends`, or `immediate`. |
| **Review required** | ON by default. Posts sit at `pending_review` until you approve them. Turn OFF and posts auto-approve — the scheduler publishes at the next window. |
| **Platforms** | Which platforms to post to. Empty = all configured platforms. |
| **GitHub repo** | `owner/repo` format. Used for catchup via GitHub API. Hit **TEST** to verify. |
| **Philosophy** | The project's guiding philosophy. Tells Claude what story you're telling and why. |
| **Voice** | Writing perspective per project. Default: first person singular, present tense, confident. Override for different tones. |
| **Detail level** | How deep posts go. `high-level` = why, not what. `moderate` = what was built, not how. `technical` = architecture and design decisions. |
| **Tagline** | Appended to every post at publish time. |
| **Visibility** | `private` (default) or `public`. Public projects and their queue items are visible to unauthenticated visitors. Private projects are completely hidden without login. |

Hit **SAVE**. Projects can be renamed or deleted from the expanded view. Renaming updates all references across queue, post history, commit buffer, and activity log.

---

## Catchup

For repos with existing history — run catchup to generate a backlog of drafts from past commits.

1. Set the **GitHub repo** field on the project
2. Click **CATCHUP**
3. Claude reads the full commit history, finds narrative arcs, queues drafts
4. Review in `[2] QUEUE`

**Gotcha:** First catchup on an active repo can generate a lot of posts. Review required is ON by default, so nothing goes out without you. But if you turned it OFF — fix that first.

**Gotcha:** Catchup uses the GitHub API, not webhooks. It needs a `GITHUB_TOKEN` in `.env` for private repos. Public repos work without one but will hit rate limits faster.

**RESET CATCHUP** clears the commit history marker so the next catchup regenerates all posts from scratch. Use this if you deleted posts from the queue and want to regenerate them.

**COMPOSE INTRO** generates an introductory post from the project philosophy alone — no commits needed. Use this for the first post when you want an origin story, not a commit summary.

---

## The queue

All posts go through the queue. Nothing publishes without passing through here.

| Status | Meaning |
|--------|---------|
| `pending_review` | Waiting for you |
| `approved` | Scheduler will publish at the next window |
| `published` | Done |
| `rejected` | Killed — can be re-queued |

Click a post to expand it. **EDIT** to rewrite before approving. **APPROVE** to mark ready. **RESCIND** to pull back an approved post.

**REGENERATE** re-runs Claude on the existing post using the project's current voice and detail level settings. Use this when you change a project's LOD or voice and want to rewrite queued posts to match.

**PUBLISH TO** — a dropdown that replaces the old PUBLISH NOW button. Pick a specific platform or ALL PLATFORMS. Already-published platforms are marked with ✓. Published posts show a REPUBLISH TO dropdown for sending to platforms that were added after the original publish. Republishing works on already-published posts — no need to re-queue.

The projects endpoint returns instantly — no GitHub API calls on page load. Commit checks only happen during catchup when posts are being generated.

The queue tracks which platforms each post has been published to — visible in the post metadata as `SENT: LINKEDIN, BLUESKY`, etc.

**Gotcha:** DELETE removes the post permanently. RESCIND just moves it to rejected. RE-QUEUE puts rejected posts back to pending.

Inline action buttons (✓ ✗ ×) appear on each row without expanding. Bulk actions at the top of the queue operate on all visible posts (filtered by project/status).

---

## How the narrative engine works

Claude doesn't post on every push. It accumulates commits and decides when there's a story. When it waits, it leaves itself notes about the thread it's tracking. When it publishes, it carries forward notes about other threads still forming.

It tracks what it's already published so it doesn't repeat itself. Philosophy, voice, and detail level shape every draft per project. Post openings are varied — the prompt enforces no repetitive "I built" patterns across consecutive posts. The first 300 characters of every post are written to hook the reader and capture the spirit of the full post — this is what shows in feeds and thread previews on short-form platforms.

The rate limit is global — one post per day across all projects, oldest approved first. It persists to disk and survives restarts.

---

## Other platforms

LinkedIn is fully implemented with OAuth. Other platforms are at various stages:

| Platform | Status | Notes |
|----------|--------|-------|
| LinkedIn | **ready** | OAuth flow, full API posting |
| Dev.to | ready | API key auth |
| Facebook | ready | Page token auth |
| Hashnode | ready | API key auth |
| Medium | ready | Integration token |
| Threads | ready | Meta OAuth |
| Bluesky | **ready** | Handle + app password, auto-threads long posts, hashtags on every chunk |
| Discord | stub | Webhook URL |
| Hacker News | stub | |
| Instagram | stub | |
| Mastodon | **ready** | Instance URL + access token, auto-threads long posts, hashtags on every chunk |
| Reddit | stub | |
| TikTok | stub | |
| X/Twitter | stub | |
| YouTube | stub | Community posts |

"Ready" means the adapter exists and works. "Stub" means the file is there but `publish()` isn't implemented yet.

### Adding a new platform

```
cp -r src/publishers/_template src/publishers/<platform>
```

Implement `isConfigured()`, `publish()`, and `constraints`. Register in `src/publishers/registry.ts`. Zero changes to the pipeline, webhook handler, or philosophy system.

---

## Philosophy

Each project needs a philosophy entry in the Knightsrook MCP at key `project:<repo-name>:philosophy`. The repo name must match exactly.

No philosophy = no post. The pipeline stops.

Fallback: create `project:default:philosophy` for repos without their own entry.

**Gotcha:** Philosophy is fetched from an external MCP server. If the server is down, the pipeline fails silently and nothing queues. Check `[4] ACTIVITY` if posts stop appearing.

---

## Deploying

```bash
npm run build
npm run start:prod
```

Use pm2 or systemd to keep it alive:

```bash
pm2 start dist/server.js --name cawcawcaw
pm2 save && pm2 startup
```

Put nginx or caddy in front for HTTPS if the UI needs to be reachable externally. The app sets `trust proxy` so it correctly reads `X-Forwarded-Proto` for OAuth redirect URIs behind reverse proxies (Cloudflare, nginx, etc.).

### Authentication

Set `UI_PASSWORD` in `.env` to enable login. Without it, the UI is fully open.

When enabled:
- **Public projects** — their queue items, project configs (read-only), and activity are visible to anyone. The UI hides all action buttons. Think live demo.
- **Private projects** — invisible without login. API returns 404.
- **All write operations** — require login. Approve, reject, delete, edit, save, catchup, platform management — all locked.
- **Platforms tab** — hidden entirely without login.
- **Demo banner** — visible to unauthenticated visitors, indicates read-only mode.
- Session is cookie-based, expires after 7 days. Login prompt is in the header.

Runtime data in `data/` — back it up. Specifically:
- `credentials.json` — OAuth tokens
- `projects.json` — project configs
- `history.json` — published post log (prevents duplicate stories)
- `last-publish.txt` — daily rate limit state

---

## UI

`http://localhost:3000` — green phosphor terminal. Keyboard nav:

| Key | Tab |
|-----|-----|
| `1` | Platforms |
| `2` | Queue |
| `3` | Projects |
| `4` | Activity |
| `5` | System |
| `Esc` | Close form |

---

## Tests

```bash
npm test
```

Uses Node's built-in test runner with `tsx` for TypeScript support. Regression tests cover:

- **project-config** — `DEFAULT_CONFIG` has `reviewRequired: true` (sev 1 fix), `setProjectConfig` filters undefined values, `getAllProjectConfigs` merges defaults into stored configs, `getProjectConfig` returns defaults for unknown projects
- **queue** — `enqueue` handles missing/null tags (defaults to empty array), missing draft fields default to empty strings, `reviewRequired` flag correctly sets `pending_review` vs `approved` status
- **scheduler** — `parseSchedule` correctly parses `immediate`, `HH:MM`, and `HH:MM weekdays/weekends` formats; `shouldPublishNow` always returns true for immediate schedules

Build is strict — `npm run build` must pass with zero type errors.

All project config fields must be wired end-to-end: `ProjectConfig` interface → `DEFAULT_CONFIG` → API handler destructure → UI `saveProject()` → UI render. Missing any link means the field silently drops on save.
