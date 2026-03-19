import { createHmac, timingSafeEqual } from 'node:crypto';
import { type Request, type Response, type NextFunction } from 'express';
import { config } from '../config.js';
import { type GitHubPush, isDefaultBranch } from './github.js';
import { runPipeline } from '../pipeline/index.js';

export function verifyGithubSignature(req: Request, res: Response, next: NextFunction): void {
  const sig = req.headers['x-hub-signature-256'];
  if (!sig || typeof sig !== 'string') {
    res.status(401).json({ error: 'Missing X-Hub-Signature-256' });
    return;
  }

  const expected = 'sha256=' + createHmac('sha256', config.githubWebhookSecret)
    .update(req.body as Buffer)
    .digest('hex');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}

export function githubWebhookHandler(req: Request, res: Response): void {
  const event = req.headers['x-github-event'];

  if (event !== 'push') {
    res.status(200).json({ skipped: true, reason: `Event type "${event}" is not handled` });
    return;
  }

  const push = req.body as GitHubPush;

  // Only process pushes to the default branch
  if (!isDefaultBranch(push)) {
    res.status(200).json({ skipped: true, reason: 'Not the default branch' });
    return;
  }

  // Acknowledge immediately — never block on Claude
  res.status(202).json({ accepted: true });

  // Fire and forget pipeline
  runPipeline(push).catch(err => {
    console.error('[cawcawcaw] Pipeline error:', err);
  });
}
