# cawcawcaw

Commit to Caw. GitHub pushes → Claude reads the accumulating work → when there's a story worth telling, it writes it and posts everywhere the rooster wants to crow.

---

## Getting started

### 1. Install dependencies

```bash
cd ns.s-cawcawcaw
npm install
```

---

### 2. Set required env vars

```
GITHUB_WEBHOOK_SECRET=     # make something up — you'll paste it into GitHub in step 6
ANTHROPIC_API_KEY=         # your Anthropic API key
LINKEDIN_CLIENT_ID=        # from your LinkedIn developer app
LINKEDIN_CLIENT_SECRET=    # same place
```

```bash
cp .env.example .env
# edit .env
```

---

### 3. Start the server

```bash
npm start
```

You should see:
```
[cawcawcaw] Listening on port 3000
[cawcawcaw] UI: http://localhost:3000
[scheduler] Started
```

Runtime data is stored in `~/.cawcawcaw/`. It's created automatically on first run.

---

### 4. Configure your first platform

Open `http://localhost:3000` and press `1` for Platforms.

Click **LinkedIn** → paste your credentials → **SAVE**.

You need two things:

- **LinkedIn Client ID + Secret** — from your LinkedIn developer app (Auth tab). The UI handles the OAuth flow — just click CONNECT.
- **Author URN** — your LinkedIn member ID in URN form. Get it by calling:

```bash
curl -H "Authorization: Bearer <your_token>" https://api.linkedin.com/v2/userinfo
```

The `sub` field is your ID. Your URN is `urn:li:person:<sub>`.

---

### 5. Add a philosophy entry for each repo

In the Knightsrook MCP, create a topic at key `project:<repo-name>:philosophy`.

The `<repo-name>` must match the GitHub repository name exactly (e.g. `ns.s-m2t`, not `ns.s/ns.s-m2t`).

No philosophy entry = no post. The pipeline will throw and stop.

If you want a fallback for repos that don't have their own entry, create one at `project:default:philosophy`.

---

### 6. Configure the project in the UI

Press `3` for Projects → **+ ADD** your repo name → expand it and set:

- **Schedule** — when the publish window opens: `05:00` (default), `09:00 weekdays`, `09:00 weekends`. One post per day total across all projects — oldest first.
- **Review required** — if ON, posts sit at `pending_review` until you approve them in the Queue tab
- **Platforms** — which platforms to post to (empty = all configured platforms)
- **GitHub repo** — `owner/repo` format (e.g. `noshit-software/ns.s-cawcawcaw`) — used for catchup via GitHub API. Hit **TEST** to verify the connection.
- **Philosophy** — tells Claude what voice and tone to use when writing posts
- **Tagline** — appended to every post at publish time (e.g. `CAW.`)

Hit **SAVE**.

---

### 7. Expose the webhook endpoint

GitHub needs to reach `/webhook/github` over the internet. If you're running locally, use ngrok:

```bash
ngrok http 3000
```

Copy the `https://` URL.

---

### 8. Wire up GitHub

For each repo you want cawcawcaw to watch:

**GitHub repo → Settings → Webhooks → Add webhook**

| Field | Value |
|-------|-------|
| Payload URL | `https://<your-ngrok-or-server-url>/webhook/github` |
| Content type | `application/json` |
| Secret | your `GITHUB_WEBHOOK_SECRET` |
| Events | Just the push event |

---

### 9. Test it

Push something to the default branch. Watch the server logs. Then press `4` (Activity) in the UI — you'll see whether Claude decided to post or wait, and what notes it left itself.

If it waited, that's normal on the first push. It's building toward something. Push a few more commits and it'll CAW when the story is ready.

---

## Catchup (for repos with existing history)

If a repo has been active for a while, run catchup to get Claude up to speed and generate a backlog of drafts.

1. Make sure the repo's **GitHub repo** is set in the Projects tab (e.g. `owner/repo`)
2. Click **CATCHUP**
3. Server reads the full git history directly, Claude finds the narrative arcs, drafts get queued
4. Go to `[2] QUEUE` to review and approve

---

## Queue

All posts — live and catchup — go through the queue.

| Status | Meaning |
|--------|---------|
| `pending_review` | Waiting for your approval |
| `approved` | Ready — scheduler will release it at the next time window |
| `published` | Done — logged in Activity tab |
| `rejected` | Killed |

In the Queue tab, click any post to expand it and read the full draft. Click **EDIT** to modify the headline, body, or tags before approving. **APPROVE** marks the copy as ready. **PUBLISH NOW** sends it out — nothing goes live until you explicitly publish.

---

## How the narrative engine works

Claude doesn't post on every push. It accumulates commits across pushes — sometimes 2, sometimes 12 — and decides when there's enough of a story to say something. When it waits, it leaves itself notes about what thread it's tracking and what it's looking for next. When it publishes, it carries forward notes about other threads still forming.

It also tracks what it's already published so it doesn't rehash the same ground.

---

## Adding a platform

1. `cp -r src/publishers/_template src/publishers/<platform>`
2. Implement `isConfigured()`, `publish()`, and `constraints`
3. Add optional credential block to `src/config.ts`
4. Import + register in `src/publishers/registry.ts`
5. Update this README

Zero changes to `pipeline/`, `webhook/`, or `philosophy/`.

---

## Platforms

| Platform | Status | Platform | Status |
|----------|--------|----------|--------|
| Bluesky | stub | LinkedIn | ready |
| Dev.to | ready | Mastodon | stub |
| Discord | stub | Medium | ready |
| Facebook | ready | Reddit | stub |
| Hacker News | stub | Threads | ready |
| Hashnode | ready | TikTok | stub |
| Instagram | stub | X/Twitter | stub |
| YouTube Community | stub | | |

---

## UI

`http://localhost:3000` — Apple IIe phosphor green terminal UI with a dimmed ASCII crow watermark in the background.

| Key | Tab |
|-----|-----|
| `1` | Platforms — credential management |
| `2` | Queue — review and approve drafts |
| `3` | Projects — per-project config + catchup |
| `4` | Activity — pipeline run log |
| `5` | System — server status |
| `Esc` | Close open form |

The header shows a pending review count and queued post count. Catchup buttons show new commit counts and disable when caught up.

**Keep this URL private.** It exposes credential management. Do not expose it to the public internet without auth in front.
