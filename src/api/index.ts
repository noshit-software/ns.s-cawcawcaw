import { Router, json } from 'express';
import { PLATFORM_MANIFEST } from '../publishers/manifest.js';
import { getCredential, setCredentials, clearCredentials } from '../store/credentials.js';
import { getActivity } from '../activity/log.js';
import { getAllAccounts, addAccount, removeAccount, getAccountsByType } from '../store/accounts.js';
import { getQueue, updateStatus, updateDraft, removeFromQueue, type QueuedPost } from '../store/queue.js';
import { getProjectConfig, setProjectConfig, getAllProjectConfigs, deleteProject, renameProject } from '../store/project-config.js';
import { fetchPhilosophy } from '../philosophy/client.js';
import { getPostHistory } from '../store/post-history.js';
import { runCatchup, fetchGitHubCommits } from '../pipeline/catchup.js';
import { enqueue } from '../store/queue.js';
import { updateNotes } from '../store/commit-buffer.js';
import { publishNow } from '../pipeline/scheduler.js';
import { regenerate } from '../pipeline/writer.js';
import { isAuthenticated, requireAuth } from '../auth/session.js';

const router = Router();
router.use(json());

// ── PLATFORMS (auth required — never public) ─────────────────

router.get('/platforms', requireAuth, (_req, res) => {
  const allAccounts = getAllAccounts();
  const platforms = Object.entries(PLATFORM_MANIFEST).map(([name, info]) => {
    const accounts = allAccounts.filter(a => a.type === name).map(a => ({
      id: a.id,
      label: a.label,
      configured: info.fields.every(f => !!getCredential(a.id, f.key)),
    }));
    // Also check if the base platform name has credentials (legacy / single-account)
    const baseConfigured = info.fields.every(f => !!getCredential(name, f.key));
    return {
      name,
      label: info.label,
      description: info.description,
      configured: baseConfigured || accounts.some(a => a.configured),
      oauth: info.oauth ?? null,
      accounts,
      fields: info.fields.map(f => ({
        key: f.key,
        label: f.label,
        secret: f.secret,
        placeholder: f.placeholder ?? '',
        configured: !!getCredential(name, f.key),
      })),
    };
  });
  res.json(platforms);
});

// Save credentials for a platform or account
router.post('/platforms/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  // name could be a base platform (e.g. 'linkedin') or an account ID (e.g. 'linkedin-personal')
  const baseName = name.includes('-') ? name.split('-')[0] : name;
  const info = PLATFORM_MANIFEST[baseName] || PLATFORM_MANIFEST[name];
  if (!info) { res.status(404).json({ error: 'Unknown platform' }); return; }

  const creds: Record<string, string> = {};
  for (const field of info.fields) {
    const val = (req.body as Record<string, string>)[field.key];
    if (val !== undefined && val !== '••••••••' && val !== '') {
      creds[field.key] = val;
    }
  }
  setCredentials(name, creds);
  res.json({ ok: true });
});

router.delete('/platforms/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  clearCredentials(name);
  res.json({ ok: true });
});

// ── ACCOUNTS (auth required) ─────────────────────────────────

router.post('/accounts', requireAuth, (req, res) => {
  const { type, label } = req.body as { type: string; label: string };
  if (!type || !label) { res.status(400).json({ error: 'type and label required' }); return; }
  if (!PLATFORM_MANIFEST[type]) { res.status(404).json({ error: 'Unknown platform type' }); return; }
  const account = addAccount(type, label);
  res.json(account);
});

router.delete('/accounts/:id', requireAuth, (req, res) => {
  clearCredentials(req.params.id);
  removeAccount(req.params.id);
  res.json({ ok: true });
});

// ── QUEUE ────────────────────────────────────────────────────

router.get('/queue', (req, res) => {
  const { project } = req.query as Record<string, string>;
  let posts = getQueue(project);
  if (!isAuthenticated(req)) {
    const configs = getAllProjectConfigs();
    const publicProjects = new Set(Object.entries(configs).filter(([, c]) => c.visibility === 'public').map(([n]) => n));
    posts = posts.filter(p => publicProjects.has(p.project));
  }
  res.json(posts);
});

router.post('/queue/:id/approve', requireAuth, (req, res) => {
  updateStatus(req.params.id, 'approved');
  res.json({ ok: true });
});

router.post('/queue/:id/publish', requireAuth, async (req, res) => {
  try {
    const { platforms } = (req.body ?? {}) as { platforms?: string[] };
    await publishNow(req.params.id, platforms);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/queue/:id/reject', requireAuth, (req, res) => {
  updateStatus(req.params.id, 'rejected');
  res.json({ ok: true });
});

router.post('/queue/:id/requeue', requireAuth, (req, res) => {
  updateStatus(req.params.id, 'pending_review');
  res.json({ ok: true });
});

router.patch('/queue/:id', requireAuth, (req, res) => {
  const { headline, body, tags, philosophyPoint } = req.body as Record<string, unknown>;
  const draft: Record<string, unknown> = {};
  if (typeof headline === 'string') draft.headline = headline;
  if (typeof body === 'string') draft.body = body;
  if (Array.isArray(tags)) draft.tags = tags;
  if (typeof philosophyPoint === 'string') draft.philosophyPoint = philosophyPoint;
  updateDraft(req.params.id, draft as Partial<import('../publishers/types.js').PostDraft>);
  res.json({ ok: true });
});

router.post('/queue/batch', requireAuth, (req, res) => {
  const { ids, action } = req.body as { ids: string[]; action: string };
  if (!Array.isArray(ids) || !action) { res.status(400).json({ error: 'ids and action required' }); return; }
  for (const id of ids) {
    if (action === 'delete') removeFromQueue(id);
    else if (action === 'approve') updateStatus(id, 'approved');
    else if (action === 'reject') updateStatus(id, 'rejected');
    else if (action === 'requeue') updateStatus(id, 'pending_review');
  }
  res.json({ ok: true, count: ids.length });
});

router.delete('/queue/:id', requireAuth, (req, res) => {
  removeFromQueue(req.params.id);
  res.json({ ok: true });
});

router.post('/queue/compose', requireAuth, async (req, res) => {
  const { project } = req.body as { project: string };
  if (!project) { res.status(400).json({ error: 'project required' }); return; }

  try {
    const config = getProjectConfig(project);
    const philosophy = await fetchPhilosophy(project);
    const postHistory = getPostHistory(project);
    const { generateIntro } = await import('../pipeline/writer.js');
    const draft = await generateIntro(philosophy, project, postHistory, config.voice, config.detailLevel);
    enqueue(project, draft, 'catchup', config.platforms, config.reviewRequired);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/queue/:id/regenerate', requireAuth, async (req, res) => {
  const posts = getQueue();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) { res.status(404).json({ error: 'Post not found' }); return; }

  try {
    const config = getProjectConfig(post.project);
    const philosophy = await fetchPhilosophy(post.project);
    const newDraft = await regenerate(post.draft, philosophy, config.voice, config.detailLevel);
    updateDraft(post.id, newDraft);
    res.json({ ok: true, draft: newDraft });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── PROJECTS ─────────────────────────────────────────────────

router.get('/projects', (req, res) => {
  const configs = getAllProjectConfigs();
  const authed = isAuthenticated(req);
  const enriched: Record<string, unknown> = {};
  for (const [name, cfg] of Object.entries(configs)) {
    if (!authed && cfg.visibility !== 'public') continue;
    enriched[name] = authed ? cfg : {
      schedule: cfg.schedule, philosophy: cfg.philosophy, tagline: cfg.tagline,
      voice: cfg.voice, detailLevel: cfg.detailLevel, visibility: cfg.visibility,
      platforms: cfg.platforms, reviewRequired: cfg.reviewRequired,
    };
  }
  res.json(enriched);
});

router.get('/projects/:name', (req, res) => {
  const cfg = getProjectConfig(req.params.name);
  if (!isAuthenticated(req) && cfg.visibility !== 'public') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(cfg);
});

router.post('/projects/:name', requireAuth, (req, res) => {
  const { schedule, reviewRequired, platforms, githubRepo, philosophy, voice, detailLevel, tagline, visibility, lastCatchupCommit } = req.body as {
    schedule?: string;
    reviewRequired?: boolean;
    platforms?: string[];
    githubRepo?: string;
    philosophy?: string;
    voice?: string;
    detailLevel?: string;
    tagline?: string;
    visibility?: 'public' | 'private';
    lastCatchupCommit?: string;
  };
  setProjectConfig(req.params.name, { schedule, reviewRequired, platforms, githubRepo, philosophy, voice, detailLevel, tagline, visibility, lastCatchupCommit });
  res.json({ ok: true });
});

router.delete('/projects/:name', requireAuth, (req, res) => {
  deleteProject(req.params.name);
  res.json({ ok: true });
});

router.post('/projects/:name/rename', requireAuth, (req, res) => {
  const { newName } = req.body as { newName: string };
  if (!newName?.trim()) { res.status(400).json({ error: 'newName required' }); return; }
  renameProject(req.params.name, newName.trim());
  res.json({ ok: true });
});

// ── CATCHUP ──────────────────────────────────────────────────

router.get('/test-repo', requireAuth, async (req, res) => {
  const repo = req.query.repo as string;
  if (!repo) { res.status(400).json({ error: 'No repo specified' }); return; }
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken) headers.Authorization = `Bearer ${ghToken}`;
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!r.ok) throw new Error(`${r.status} — ${r.statusText}`);
    const data = await r.json() as { full_name: string; private: boolean; default_branch: string; pushed_at: string };
    res.json({ ok: true, repo: data.full_name, private: data.private, branch: data.default_branch, lastPush: data.pushed_at });
  } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : String(e) }); }
});

router.post('/catchup', requireAuth, async (req, res) => {
  const { project } = req.body as { project: string };
  if (!project) { res.status(400).json({ error: 'project is required' }); return; }

  const config = getProjectConfig(project);
  if (!config.githubRepo) {
    res.status(400).json({ error: 'No GitHub repo configured. Set it in the Projects tab first.' });
    return;
  }

  let commits;
  let latestSha: string;
  try {
    const result = await fetchGitHubCommits(config.githubRepo, config.lastCatchupCommit || undefined);
    commits = result.commits;
    latestSha = result.latestSha;
  } catch (err) {
    res.status(400).json({ error: `Failed to fetch commits from GitHub: ${err instanceof Error ? err.message : err}` });
    return;
  }

  if (commits.length === 0) {
    res.status(400).json({ error: 'No new commits found' });
    return;
  }

  // Respond immediately — catchup can take a while
  res.json({ ok: true, commitsParsed: commits.length, message: 'Catchup started. Check the queue.' });

  (async () => {
    try {
      const philosophy = await fetchPhilosophy(project);
      const postHistory = getPostHistory(project);
      const { drafts, notes } = await runCatchup(commits, philosophy, project, postHistory, config.voice, config.detailLevel);

      for (const draft of drafts) {
        enqueue(project, draft, 'catchup', config.platforms, config.reviewRequired);
      }
      if (notes) updateNotes(project, notes);

      setProjectConfig(project, { lastCatchupCommit: latestSha });

      console.log(`[catchup] ${project}: queued ${drafts.length} posts from ${commits.length} commits`);
    } catch (err) {
      console.error('[catchup] Error:', err);
    }
  })();
});

// ── ACTIVITY ─────────────────────────────────────────────────

router.get('/activity', (req, res) => {
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '50', 10) || 50, 100);
  let entries = getActivity(limit);
  if (!isAuthenticated(req)) {
    const configs = getAllProjectConfigs();
    const publicProjects = new Set(Object.entries(configs).filter(([, c]) => c.visibility === 'public').map(([n]) => n));
    entries = entries.filter((e: { project?: string }) => e.project && publicProjects.has(e.project));
  }
  res.json(entries);
});

export default router;
