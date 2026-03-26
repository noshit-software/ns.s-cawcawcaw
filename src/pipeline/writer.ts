import { getClient, MODEL } from '../claude/client.js';
import { type ProjectPhilosophy } from '../philosophy/client.js';
import { type PostDraft } from '../publishers/types.js';
import { type CommitSummary } from '../webhook/github.js';
import { type PostRecord } from '../store/post-history.js';

export type WriteDecision =
  | { action: 'publish'; draft: PostDraft; carryForwardNotes: string }
  | { action: 'wait'; notes: string };

const TOOLS = [
  {
    name: 'publish_post',
    description: 'The accumulated work has a story worth telling. Write and publish it now.',
    input_schema: {
      type: 'object' as const,
      properties: {
        headline: {
          type: 'string',
          description: 'One sentence lede — the single most important idea in this post',
        },
        body: {
          type: 'string',
          description: 'Full narrative body. No character limits. No code. No implementation details. First person, present tense.',
        },
        summary: {
          type: 'string',
          description: 'Short-form version of this post for character-limited platforms (Bluesky, Twitter). Max 280 characters. Same voice, same story — just compressed. Should work as a standalone post, not a teaser. No hashtags in the summary.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Thematic tags — no # prefix, no spam. 3-5 max.',
        },
        philosophyPoint: {
          type: 'string',
          description: 'One sentence: which specific philosophy point or narrative beat this post advances',
        },
        carry_forward_notes: {
          type: 'string',
          description: 'Optional. If the commit buffer contained work on OTHER threads not covered by this post, summarize those threads here. These notes will be waiting for you on the next push so you can pick up where you left off. Leave empty if the buffer was fully consumed by this story.',
        },
      },
      required: ['headline', 'body', 'summary', 'tags', 'philosophyPoint'],
    },
  },
  {
    name: 'wait_for_more',
    description: 'The story is not ready yet. Wait for more commits before publishing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        notes: {
          type: 'string',
          description: 'Your notes to yourself about what narrative thread you are tracking, what the accumulated work is building toward, and what you are waiting to see before you publish. You will read these notes on the next push.',
        },
      },
      required: ['notes'],
    },
  },
];

export async function decide(
  commits: CommitSummary[],
  priorNotes: string,
  philosophy: ProjectPhilosophy,
  projectName: string,
  postHistory: PostRecord[],
  voice?: string,
  detailLevel?: string
): Promise<WriteDecision> {
  const client = getClient();

  const suppressionNote =
    philosophy.doNotPublishPatterns.length > 0
      ? `\nDo NOT mention or allude to any of the following: ${philosophy.doNotPublishPatterns.join(', ')}.`
      : '';

  const notesBlock = priorNotes
    ? `Your notes from last time:\n${priorNotes}\n\n`
    : '';

  const historyBlock = postHistory.length > 0
    ? `What you have already published (do not repeat or rehash these):\n${postHistory.map(p =>
        `- [${p.timestamp.slice(0, 10)}] "${p.headline}" — ${p.philosophyPoint}`
      ).join('\n')}\n\n`
    : '';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: TOOLS,
    tool_choice: { type: 'any' },
    system: `You are the narrative voice for the project "${projectName}".

Project philosophy:
${philosophy.statement}

${philosophy.narrativeArc ? `Current narrative arc:\n${philosophy.narrativeArc}` : ''}

Your job is to decide when the story is ready to tell. You see all commits since the last post. Some pushes have 2 commits. Some have 12. You decide when there is enough to say something that matters.

When you publish, follow these rules:
- No code snippets, no function names, no file paths
- Detail level: ${detailLevel || 'high-level'} — ${detailLevel === 'technical' ? 'you may reference architecture and design decisions' : detailLevel === 'moderate' ? 'mention what was built but not how' : 'the story is the why, not the what. No implementation details.'}
- No sensitive information: no API keys, internal URLs, team names, credentials
- Write as if continuing a story, not announcing a release
- Voice: ${voice || 'First person singular ("I", never "we"). Present tense. Confident but not arrogant.'}
- No corporate speak: never say "excited to share", "thrilled to announce", "proud to present"
- No bullet points in the body
- End with a forward-looking sentence that sets up the next narrative beat
- Vary your openings. Never start with "I built" or "I created" — find the problem, the moment, the question, the surprise${suppressionNote}

When you wait, leave yourself honest notes — what thread you see forming, what you are waiting to see, what would make this worth saying.

Audience: builders, founders, people who care about craft.`,

    messages: [
      {
        role: 'user',
        content: `${historyBlock}${notesBlock}Commits since last post (${commits.length} total):
${commits.map(c => `- ${c.message}`).join('\n')}

Is the story ready?`,
      },
    ],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('No decision returned from writer.');
  }

  if (toolUse.name === 'publish_post') {
    const input = toolUse.input as Omit<PostDraft, 'projectName'> & { carry_forward_notes?: string };
    return {
      action: 'publish',
      draft: { headline: input.headline, body: input.body, summary: input.summary ?? '', tags: input.tags, philosophyPoint: input.philosophyPoint, projectName },
      carryForwardNotes: input.carry_forward_notes ?? '',
    };
  }

  const input = toolUse.input as { notes: string };
  return { action: 'wait', notes: input.notes };
}
