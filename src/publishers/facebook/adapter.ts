import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class FacebookAdapter implements PublisherAdapter {
  readonly platform = 'facebook';

  readonly constraints: PlatformConstraints = {
    maxChars: 63206,
    supportsMarkdown: false,
    supportsHashtags: true,
    supportsLinks: true,
  };

  isConfigured(): boolean {
    return !!(getCredential('facebook', 'page_access_token') && getCredential('facebook', 'page_id'));
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    const token = getCredential('facebook', 'page_access_token')!;
    const pageId = getCredential('facebook', 'page_id')!;
    const tags = draft.tags.map(t => `#${t}`).join(' ');
    const message = `${draft.body}\n\n${tags}`;

    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: token }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { platform: this.platform, success: false, error: `Facebook API error ${res.status}: ${errorText}` };
    }

    const data = await res.json() as { id?: string };
    const url = data.id ? `https://www.facebook.com/${data.id}` : undefined;
    return { platform: this.platform, success: true, url };
  }
}
