import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { verifyGithubSignature, githubWebhookHandler } from './webhook/handler.js';
import apiRouter from './api/index.js';
import { startScheduler } from './pipeline/scheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// GitHub webhook — raw body required for HMAC verification
app.use(
  '/webhook/github',
  express.raw({ type: 'application/json' }),
  verifyGithubSignature,
  (req, _res, next) => {
    req.body = JSON.parse((req.body as Buffer).toString('utf-8'));
    next();
  },
  githubWebhookHandler
);

// REST API
app.use('/api', apiRouter);

// Health
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'cawcawcaw',
    version: '0.1.0',
    uptime: Math.floor(process.uptime()),
  });
});

// UI — serve public/ directory
app.use(express.static(join(__dirname, '..', 'public')));

app.listen(config.port, () => {
  console.log(`[cawcawcaw] Listening on port ${config.port}`);
  console.log(`[cawcawcaw] UI: http://localhost:${config.port}`);
  startScheduler();
});
