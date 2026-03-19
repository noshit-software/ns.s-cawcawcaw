import { Router, json } from 'express';
import { PLATFORM_MANIFEST } from '../publishers/manifest.js';
import { getCredential, setCredentials, clearCredentials } from '../store/credentials.js';
import { getActivity } from '../activity/log.js';
import { getQueue, updateStatus, removeFromQueue } from '../store/queue.js';
import { getProjectConfig, setProjectConfig, getAllProjectConfigs } from '../store/project-config.js';
import { fetchPhilosophy } from '../philosophy/client.js';
import { getPostHistory } from '../store/post-history.js';
import { runCatchup, readGitLog } from '../pipeline/catchup.js';
import { enqueue } from '../store/queue.js';
import { updateNotes } from '../store/commit-buffer.js';

const router = Router();
router.use(json());

// ── PLATFORMS ────────────────────────────────────────────────

router.get('/platforms', (_req, res) => {
  const platforms = Object.entries(PLATFORM_MANIFEST).map(([name, info]) => {
    const configured = info.fields.every(f => !!getCredential(name, f.key));
    return {
      name,
      label: info.label,
      description: info.description,
      configured,
      fields: info.fields.map(f => ({
        key: f.key,
        label: f.label,
        secret: f.secret,
        placeholder: f.placeholder ?? '',
        configured: !!getCredential(name, f.key),
        value: f.secret
          ? (getCredential(name, f.key) ? '••••••••' : '')
          : (getCredential(name, f.key) ?? ''),
      })),
    };
  });
  res.json(platforms);
});

router.post('/platforms/:name', (req, res) => {
  const { name } = req.params;
  const info = PLATFORM_MANIFEST[name];
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
  if (!PLATFORM_MANIFEST[name]) { res.status(404).json({ error: 'Unknown platform' }); return; }
  clearCredentials(name);
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

router.post('/queue/:id/reject', (req, res) => {
  updateStatus(req.params.id, 'rejected');
  res.json({ ok: true });
});

router.delete('/queue/:id', (req, res) => {
  removeFromQueue(req.params.id);
  res.json({ ok: true });
});

// ── PROJECTS ─────────────────────────────────────────────────

router.get('/projects', (_req, res) => {
  const configs = getAllProjectConfigs();
  res.json(configs);
});

router.get('/projects/:name', (req, res) => {
  res.json(getProjectConfig(req.params.name));
});

router.post('/projects/:name', (req, res) => {
  const { schedule, reviewRequired, platforms } = req.body as {
    schedule?: string;
    reviewRequired?: boolean;
    platforms?: string[];
  };
  setProjectConfig(req.params.name, { schedule, reviewRequired, platforms });
  res.json({ ok: true });
});

// ── CATCHUP ──────────────────────────────────────────────────

router.post('/catchup', async (req, res) => {
  const { project } = req.body as { project: string };
  if (!project) { res.status(400).json({ error: 'project is required' }); return; }

  const config = getProjectConfig(project);
  if (!config.repoPath) {
    res.status(400).json({ error: 'No repoPath configured for this project. Set it in the Projects tab first.' });
    return;
  }

  let commits;
  try {
    commits = readGitLog(config.repoPath);
  } catch (err) {
    res.status(400).json({ error: `Failed to read git log from ${config.repoPath}: ${err instanceof Error ? err.message : err}` });
    return;
  }

  if (commits.length === 0) {
    res.status(400).json({ error: 'No commits found in repo' });
    return;
  }

  // Respond immediately — catchup can take a while
  res.json({ ok: true, commitsParsed: commits.length, message: 'Catchup started. Check the queue.' });

  (async () => {
    try {
      const philosophy = await fetchPhilosophy(project);
      const postHistory = getPostHistory(project);
      const { drafts, notes } = await runCatchup(commits, philosophy, project, postHistory);

      for (const draft of drafts) {
        enqueue(project, draft, 'catchup', config.platforms, config.reviewRequired);
      }
      if (notes) updateNotes(project, notes);

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
