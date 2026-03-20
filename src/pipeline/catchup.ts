import { getClient, MODEL } from '../claude/client.js';
import { type ProjectPhilosophy } from '../philosophy/client.js';
import { type PostDraft } from '../publishers/types.js';
import { type CommitSummary } from '../webhook/github.js';
import { type PostRecord } from '../store/post-history.js';

export interface CatchupCommit {
  message: string;
  author?: string;
  date?: string;
}

export interface CatchupResult {
  drafts: PostDraft[];
  notes: string;
}

const QUEUE_POST_TOOL = {
  name: 'queue_post',
  description: 'Queue a post for publishing. Call this once per story you find. Call it multiple times if the history contains multiple distinct narrative moments.',
  input_schema: {
    type: 'object' as const,
    properties: {
      headline: { type: 'string', description: 'One sentence lede' },
      body: { type: 'string', description: 'Full narrative body. No code. No implementation details. Philosophy over mechanics.' },
      tags: { type: 'array', items: { type: 'string' }, description: '3-5 thematic tags, no # prefix' },
      philosophyPoint: { type: 'string', description: 'Which philosophy point or narrative beat this advances' },
    },
    required: ['headline', 'body', 'tags', 'philosophyPoint'],
  },
};

const DONE_TOOL = {
  name: 'done',
  description: 'Call this when you have finished reviewing the history. Include any notes about ongoing threads or what to watch for in future commits.',
  input_schema: {
    type: 'object' as const,
    properties: {
      notes: { type: 'string', description: 'Notes about threads still in progress or what to watch for next' },
    },
    required: ['notes'],
  },
};

export async function runCatchup(
  commits: CatchupCommit[],
  philosophy: ProjectPhilosophy,
  projectName: string,
  postHistory: PostRecord[]
): Promise<CatchupResult> {
  const client = getClient();

  const historyBlock = postHistory.length > 0
    ? `Already published (do not repeat):\n${postHistory.map(p =>
        `- "${p.headline}" — ${p.philosophyPoint}`
      ).join('\n')}\n\n`
    : '';

  const suppressionNote = philosophy.doNotPublishPatterns.length > 0
    ? `\nDo NOT mention or allude to: ${philosophy.doNotPublishPatterns.join(', ')}.`
    : '';

  const commitList = commits
    .map(c => [c.date, c.message, c.author].filter(Boolean).join('  '))
    .join('\n');

  // Agentic loop — Claude calls queue_post N times then calls done
  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
    {
      role: 'user',
      content: `${historyBlock}Here is the full commit history for "${projectName}" (oldest first):

${commitList}

Find the stories. Call queue_post once for each narrative moment worth publishing about. When you are done, call done with any notes about threads still forming.`,
    },
  ];

  const drafts: PostDraft[] = [];
  let notes = '';
  const MAX_ITERATIONS = 20;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [QUEUE_POST_TOOL, DONE_TOOL],
      tool_choice: { type: 'any' },
      system: `You are reviewing the full git history of "${projectName}" to find stories worth telling publicly.

Project philosophy:
${philosophy.statement}

${philosophy.narrativeArc ? `Narrative arc:\n${philosophy.narrativeArc}` : ''}

Rules for every post you write:
- No code snippets, no function names, no file paths
- The story is the why, not the what
- No sensitive information
- First person singular ("I", never "we") — present tense, confident
- No corporate speak
- No bullet points in the body
- Each post should stand alone and advance a distinct narrative beat
- Posts should be in chronological order — call queue_post in the order things happened${suppressionNote}

Quality over quantity. If the history only has one real story, queue one post. If it has six, queue six.`,
      messages: messages as Parameters<typeof client.messages.create>[0]['messages'],
    });

    // Collect all tool uses from this response
    const toolUses = response.content.filter(b => b.type === 'tool_use');

    // Build assistant message with all content
    messages.push({ role: 'assistant', content: response.content });

    // Process each tool use
    const toolResults: unknown[] = [];
    let isDone = false;

    for (const toolUse of toolUses) {
      if (toolUse.type !== 'tool_use') continue;

      if (toolUse.name === 'queue_post') {
        const input = toolUse.input as Omit<PostDraft, 'projectName'>;
        drafts.push({ ...input, projectName });
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'Queued.' });
      }

      if (toolUse.name === 'done') {
        const input = toolUse.input as { notes: string };
        notes = input.notes ?? '';
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'Done.' });
        isDone = true;
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }

    if (isDone || response.stop_reason === 'end_turn') break;
  }

  return { drafts, notes };
}

// Read git history directly from a local repo path
interface GitHubCommitResponse {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
}

// Fetch commits from GitHub API — paginates to get all
export async function fetchGitHubCommits(repo: string, sinceSha?: string): Promise<{ commits: CatchupCommit[]; latestSha: string }> {
  const commits: CatchupCommit[] = [];
  let latestSha = '';
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = new URL(`https://api.github.com/repos/${repo}/commits`);
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    if (sinceSha) url.searchParams.set('since', ''); // we'll filter by sha below

    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken) headers.Authorization = `Bearer ${ghToken}`;

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);

    const data = await res.json() as GitHubCommitResponse[];
    if (data.length === 0) break;

    if (page === 1 && data.length > 0) latestSha = data[0].sha;

    for (const c of data) {
      // Stop if we've reached the last catchup commit
      if (sinceSha && c.sha === sinceSha) {
        // Reverse so oldest is first
        commits.reverse();
        return { commits, latestSha };
      }
      commits.push({
        message: c.commit.message.split('\n')[0], // first line only
        author: c.commit.author.name,
        date: c.commit.author.date,
      });
    }

    if (data.length < perPage) break;
    page++;
  }

  commits.reverse(); // oldest first
  return { commits, latestSha };
}

// Count commits since a SHA via GitHub API
export async function getNewCommitCount(repo: string, sinceSha: string): Promise<number> {
  if (!sinceSha) return 0;
  try {
    const url = `https://api.github.com/repos/${repo}/compare/${sinceSha}...HEAD`;
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken) headers.Authorization = `Bearer ${ghToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return 0;
    const data = await res.json() as { ahead_by: number };
    return data.ahead_by;
  } catch {
    return 0;
  }
}

// Parse raw git log output into CatchupCommits
// Accepts several formats:
//   - "abc1234 commit message" (git log --oneline)
//   - "commit message|author|2026-03-01" (custom format)
//   - plain "commit message" (one per line)
export function parseGitLog(raw: string): CatchupCommit[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => {
      // Try pipe-delimited: message|author|date
      if (line.includes('|')) {
        const [message, author, date] = line.split('|').map(s => s.trim());
        return { message, author, date };
      }
      // Try git log --oneline: strip leading short hash
      const oneline = line.match(/^[0-9a-f]{4,12}\s+(.+)$/);
      if (oneline) return { message: oneline[1] };
      return { message: line };
    })
    .filter(c => c.message.length > 0);
}
