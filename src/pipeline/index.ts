import { fetchPhilosophy } from '../philosophy/client.js';
import { extractCommits, type GitHubPush } from '../webhook/github.js';
import { decide } from './writer.js';
import { logActivity } from '../activity/log.js';
import { addCommits, getBuffer, updateNotes, clearBuffer } from '../store/commit-buffer.js';
import { recordPost, getPostHistory } from '../store/post-history.js';
import { enqueue } from '../store/queue.js';
import { getProjectConfig } from '../store/project-config.js';

export interface PipelineResult {
  published: boolean;
  queued: boolean;
  reason: string;
}

export async function runPipeline(push: GitHubPush): Promise<PipelineResult> {
  const projectName = push.repository.name;
  const newCommits = extractCommits(push);

  if (newCommits.length === 0) {
    return { published: false, queued: false, reason: 'No commits.' };
  }

  addCommits(projectName, newCommits);
  const { commits: allCommits, notes: priorNotes } = getBuffer(projectName);

  const philosophy = await fetchPhilosophy(projectName);
  const postHistory = getPostHistory(projectName);
  const config = getProjectConfig(projectName);

  const decision = await decide(allCommits, priorNotes, philosophy, projectName, postHistory);

  if (decision.action === 'wait') {
    console.log(`[cawcawcaw] ${projectName}: waiting (${allCommits.length} commits buffered)`);
    updateNotes(projectName, decision.notes);
    logActivity({ project: projectName, worthy: false, reason: decision.notes });
    return { published: false, queued: false, reason: decision.notes };
  }

  const { draft } = decision;

  clearBuffer(projectName);
  if (decision.carryForwardNotes) {
    updateNotes(projectName, decision.carryForwardNotes);
  }

  // Determine target platforms — project config overrides global
  const platforms = config.platforms; // empty = all configured, scheduler resolves at publish time

  const post = enqueue(projectName, draft, 'live', platforms, config.reviewRequired);
  console.log(`[cawcawcaw] ${projectName}: queued post ${post.id} (status: ${post.status})`);

  // Record in history now so future decisions don't rehash this
  recordPost(projectName, draft.headline, draft.philosophyPoint, draft.body);
  logActivity({ project: projectName, worthy: true, reason: draft.philosophyPoint });

  return { published: false, queued: true, reason: draft.philosophyPoint };
}
