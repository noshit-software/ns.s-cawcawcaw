import { BskyAgent, RichText } from '@atproto/api';
import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class BlueskyAdapter implements PublisherAdapter {
  readonly platform = 'bluesky';

  readonly constraints: PlatformConstraints = {
    maxChars: 300,
    supportsMarkdown: false,
    supportsHashtags: true,
    supportsLinks: true,
    maxHashtags: undefined,
  };

  isConfigured(): boolean {
    return !!(getCredential('bluesky', 'handle') && getCredential('bluesky', 'app_password'));
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    const handle = getCredential('bluesky', 'handle')!;
    const appPassword = getCredential('bluesky', 'app_password')!;

    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({ identifier: handle, password: appPassword });

    // Use summary for short-form platforms; fall back to headline if no summary
    let text = draft.summary || draft.headline || draft.body;
    if (text.length > 300) text = text.slice(0, 297) + '...';

    // RichText detects links, mentions, hashtags automatically
    const rt = new RichText({ text });
    await rt.detectFacets(agent);

    const res = await agent.post({
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    });

    const uri = res.uri; // at://did:plc:.../app.bsky.feed.post/...
    const did = uri.split('/')[2];
    const rkey = uri.split('/').pop();
    const url = `https://bsky.app/profile/${did}/post/${rkey}`;

    return { platform: this.platform, success: true, url };
  }
}
