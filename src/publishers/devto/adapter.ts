import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class DevtoAdapter implements PublisherAdapter {
  readonly platform = 'devto';

  readonly constraints: PlatformConstraints = {
    maxChars: undefined,
    supportsMarkdown: true,
    supportsHashtags: true,
    supportsLinks: true,
    maxHashtags: 4,
  };

  isConfigured(): boolean {
    return !!getCredential('devto', 'api_key');
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    const apiKey = getCredential('devto', 'api_key')!;
    const tags = draft.tags.slice(0, 4).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''));

    const res = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        article: {
          title: draft.headline,
          body_markdown: draft.body,
          published: true,
          tags,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { platform: this.platform, success: false, error: `Dev.to API error ${res.status}: ${errorText}` };
    }

    const data = await res.json() as { url?: string };
    return { platform: this.platform, success: true, url: data.url };
  }
}
