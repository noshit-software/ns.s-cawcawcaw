import { type PostDraft, type PlatformConstraints } from '../types.js';

export const LINKEDIN_CONSTRAINTS: PlatformConstraints = {
  maxChars: 3000,
  supportsMarkdown: false,
  supportsHashtags: true,
  supportsLinks: true,
  maxHashtags: 5,
};

export function formatForLinkedIn(draft: PostDraft): string {
  const hashtags = draft.tags
    .slice(0, LINKEDIN_CONSTRAINTS.maxHashtags)
    .map(t => `#${t.replace(/\s+/g, '')}`)
    .join(' ');

  const body = [draft.headline, '', draft.body, '', hashtags]
    .join('\n')
    .trim();

  if (body.length <= LINKEDIN_CONSTRAINTS.maxChars!) {
    return body;
  }

  // Truncate body to fit, preserving headline and hashtags
  const overhead = draft.headline.length + 2 + hashtags.length + 2 + 3; // +3 for '...'
  const available = LINKEDIN_CONSTRAINTS.maxChars! - overhead;
  const truncatedBody = draft.body.slice(0, available).trimEnd();

  return [draft.headline, '', truncatedBody + '...', '', hashtags].join('\n').trim();
}
