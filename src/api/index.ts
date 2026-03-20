import { Router, json } from 'express';
import { PLATFORM_MANIFEST } from '../publishers/manifest.js';
import { getCredential, setCredentials, clearCredentials } from '../store/credentials.js';
import { getActivity } from '../activity/log.js';
import { getAllAccounts, addAccount, removeAccount, getAccountsByType } from '../store/accounts.js';
import { getQueue, updateStatus, updateDraft, removeFromQueue } from '../store/queue.js';
import { getProjectConfig, setProjectConfig, getAllProjectConfigs, deleteProject, renameProject } from '../store/project-config.js';
import { fetchPhilosophy } from '../philosophy/client.js';
import { getPostHistory } from '../store/post-history.js';
import { runCatchup, fetchGitHubCommits, getNewCommitCount } from '../pipeline/catchup.js';
import { enqueue } from '../store/queue.js';
import { updateNotes } from '../store/commit-buffer.js';
import { publishNow } from '../pipeline/scheduler.js';

const router = Router();
router.use(json());

// ── PLATFORMS ────────────────────────────────────────────────

router.get('/platforms', (_req, res) => {
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
router.post('/platforms/:name', (req, res) => {
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

router.delete('/platforms/:name', (req, res) => {
  const { name } = req.params;
  clearCredentials(name);
  res.json({ ok: true });
});

// ── ACCOUNTS ─────────────────────────────────────────────────

router.post('/accounts', (req, res) => {
  const { type, label } = req.body as { type: string; label: string };
  if (!type || !label) { res.status(400).json({ error: 'type and label required' }); return; }
  if (!PLATFORM_MANIFEST[type]) { res.status(404).json({ error: 'Unknown platform type' }); return; }
  const account = addAccount(type, label);
  res.json(account);
});

router.delete('/accounts/:id', (req, res) => {
  clearCredentials(req.params.id);
  removeAccount(req.params.id);
  res.json({ ok: true });
});

// ── QUEUE ────────────────────────────────────────────────────

router.get('/queue', (req, res) => {
  const { project } = req.query as Record<string, string>;
  res.json(getQueue(project));
});

router.post('/queue/:id/approve', (req, res) => {
  updateStatus(req.params.id, 'approved');
  res.json({ ok: true });
});

router.post('/queue/:id/publish', async (req, res) => {
  try {
    await publishNow(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.post('/queue/:id/reject', (req, res) => {
  updateStatus(req.params.id, 'rejected');
  res.json({ ok: true });
});

router.post('/queue/:id/requeue', (req, res) => {
  updateStatus(req.params.id, 'pending_review');
  res.json({ ok: true });
});

router.patch('/queue/:id', (req, res) => {
  const { headline, body, tags, philosophyPoint } = req.body as Record<string, unknown>;
  const draft: Record<string, unknown> = {};
  if (typeof headline === 'string') draft.headline = headline;
  if (typeof body === 'string') draft.body = body;
  if (Array.isArray(tags)) draft.tags = tags;
  if (typeof philosophyPoint === 'string') draft.philosophyPoint = philosophyPoint;
  updateDraft(req.params.id, draft as Partial<import('../publishers/types.js').PostDraft>);
  res.json({ ok: true });
});

router.post('/queue/batch', (req, res) => {
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

router.delete('/queue/:id', (req, res) => {
  removeFromQueue(req.params.id);
  res.json({ ok: true });
});

// ── PROJECTS ─────────────────────────────────────────────────

router.get('/projects', async (_req, res) => {
  const configs = getAllProjectConfigs();
  const enriched: Record<string, unknown> = {};
  for (const [name, cfg] of Object.entries(configs)) {
    let newCommits = 0;
    if (cfg.githubRepo && cfg.lastCatchupCommit) {
      try { newCommits = await getNewCommitCount(cfg.githubRepo, cfg.lastCatchupCommit); } catch {}
    }
    enriched[name] = { ...cfg, newCommits };
  }
  res.json(enriched);
});

router.get('/projects/:name', (req, res) => {
  res.json(getProjectConfig(req.params.name));
});

router.post('/projects/:name', (req, res) => {
  const { schedule, reviewRequired, platforms, githubRepo, philosophy, voice, detailLevel, tagline, lastCatchupCommit } = req.body as {
    schedule?: string;
    reviewRequired?: boolean;
    platforms?: string[];
    githubRepo?: string;
    philosophy?: string;
    voice?: string;
    detailLevel?: string;
    tagline?: string;
    lastCatchupCommit?: string;
  };
  setProjectConfig(req.params.name, { schedule, reviewRequired, platforms, githubRepo, philosophy, voice, detailLevel, tagline, lastCatchupCommit });
  res.json({ ok: true });
});

router.delete('/projects/:name', (req, res) => {
  deleteProject(req.params.name);
  res.json({ ok: true });
});

router.post('/projects/:name/rename', (req, res) => {
  const { newName } = req.body as { newName: string };
  if (!newName?.trim()) { res.status(400).json({ error: 'newName required' }); return; }
  renameProject(req.params.name, newName.trim());
  res.json({ ok: true });
});

// ── CATCHUP ──────────────────────────────────────────────────

router.get('/test-repo', async (req, res) => {
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

router.post('/catchup', async (req, res) => {
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
  res.json(getActivity(limit));
});

export default router;
