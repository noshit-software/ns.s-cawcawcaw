import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

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

    let text = draft.headline ? `${draft.headline}\n\n${draft.body}` : draft.body;

    // Add hashtags if they fit
    const hashtagLine = draft.tags.slice(0, 5).map(t => `#${t.replace(/\s+/g, '')}`).join(' ');
    if (text.length + 2 + hashtagLine.length <= 500) {
      text = text + '\n\n' + hashtagLine;
    }

    // Truncate if still over 500
    if (text.length > 500) text = text.slice(0, 497) + '...';

    const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: text }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { platform: this.platform, success: false, error: `Mastodon API error ${res.status}: ${errorText}` };
    }

    const data = await res.json() as { url?: string };
    return { platform: this.platform, success: true, url: data.url };
  }
}
