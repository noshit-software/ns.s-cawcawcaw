import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class MediumAdapter implements PublisherAdapter {
  readonly platform = 'medium';

  readonly constraints: PlatformConstraints = {
    maxChars: undefined,
    supportsMarkdown: true,
    supportsHashtags: true,
    supportsLinks: true,
    maxHashtags: 5,
  };

  isConfigured(): boolean {
    return !!getCredential('medium', 'integration_token');
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    const token = getCredential('medium', 'integration_token')!;

    // Get authenticated user ID
    const meRes = await fetch('https://api.medium.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) {
      return { platform: this.platform, success: false, error: `Medium auth error ${meRes.status}` };
    }
    const { data: user } = await meRes.json() as { data: { id: string } };

    const res = await fetch(`https://api.medium.com/v1/users/${user.id}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: draft.headline,
        contentFormat: 'markdown',
        content: draft.body,
        tags: draft.tags.slice(0, 5),
        publishStatus: 'public',
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { platform: this.platform, success: false, error: `Medium API error ${res.status}: ${errorText}` };
    }

    const { data } = await res.json() as { data: { url?: string } };
    return { platform: this.platform, success: true, url: data.url };
  }
}
