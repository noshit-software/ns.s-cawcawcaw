import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class ThreadsAdapter implements PublisherAdapter {
  readonly platform = 'threads';

  readonly constraints: PlatformConstraints = {
    maxChars: 500,
    supportsMarkdown: false,
    supportsHashtags: true,
    supportsLinks: true,
  };

  isConfigured(): boolean {
    return !!(getCredential('threads', 'access_token') && getCredential('threads', 'user_id'));
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    const token = getCredential('threads', 'access_token')!;
    const userId = getCredential('threads', 'user_id')!;
    const tags = draft.tags.slice(0, 5).map(t => `#${t}`).join(' ');
    const text = `${draft.headline}\n\n${draft.body}\n\n${tags}`.slice(0, 500);

    // Step 1: Create media container
    const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'TEXT', text, access_token: token }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      return { platform: this.platform, success: false, error: `Threads create error ${createRes.status}: ${errorText}` };
    }

    const { id: containerId } = await createRes.json() as { id: string };

    // Step 2: Publish
    const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });

    if (!publishRes.ok) {
      const errorText = await publishRes.text();
      return { platform: this.platform, success: false, error: `Threads publish error ${publishRes.status}: ${errorText}` };
    }

    const { id: postId } = await publishRes.json() as { id: string };
    return { platform: this.platform, success: true, url: `https://www.threads.net/post/${postId}` };
  }
}
