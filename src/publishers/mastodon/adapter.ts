import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';
import { splitThread } from '../thread.js';

export class MastodonAdapter implements PublisherAdapter {
  readonly platform = 'mastodon';

  readonly constraints: PlatformConstraints = {
    maxChars: 500,
    supportsMarkdown: false,
    supportsHashtags: true,
    supportsLinks: true,
    maxHashtags: undefined,
  };

  isConfigured(): boolean {
    return !!(getCredential('mastodon', 'instance_url') && getCredential('mastodon', 'access_token'));
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    const instanceUrl = getCredential('mastodon', 'instance_url')!.replace(/\/+$/, '');
    const accessToken = getCredential('mastodon', 'access_token')!;

    let fullText = draft.headline ? `${draft.headline}\n\n${draft.body}` : draft.body;

    const hashtagLine = draft.tags.slice(0, 5).map(t => `#${t.replace(/\s+/g, '')}`).join(' ');

    // Reserve space for hashtags in each chunk
    const reserveLen = hashtagLine.length + 2; // +2 for \n\n
    const chunkLimit = 500 - reserveLen;
    const chunks = splitThread(fullText, chunkLimit > 200 ? chunkLimit : 500);

    // Append hashtags to every chunk
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].length + 2 + hashtagLine.length <= 500) {
        chunks[i] = chunks[i] + '\n\n' + hashtagLine;
      }
    }

    let firstUrl = '';
    let parentId: string | undefined;

    for (let i = 0; i < chunks.length; i++) {
      const body: Record<string, string> = { status: chunks[i] };
      if (parentId) body.in_reply_to_id = parentId;

      const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { platform: this.platform, success: false, error: `Mastodon API error ${res.status}: ${errorText}` };
      }

      const data = await res.json() as { id: string; url?: string };
      if (i === 0) firstUrl = data.url ?? '';
      parentId = data.id;
    }

    return { platform: this.platform, success: true, url: firstUrl };
  }
}
