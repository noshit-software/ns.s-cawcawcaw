import { BskyAgent, RichText } from '@atproto/api';
import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';
import { splitThread } from '../thread.js';

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

    const hashtagLine = draft.tags.slice(0, 5).map(t => `#${t.replace(/\s+/g, '')}`).join(' ');

    const fullText = draft.headline
      ? `${draft.headline}\n\n${draft.body}`
      : draft.body;

    // Reserve space for hashtags in each chunk
    const reserveLen = hashtagLine.length + 2; // +2 for \n\n
    const chunkLimit = 300 - reserveLen;
    const chunks = splitThread(fullText, chunkLimit > 100 ? chunkLimit : 300);

    // Append hashtags to every chunk
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].length + 2 + hashtagLine.length <= 300) {
        chunks[i] = chunks[i] + '\n\n' + hashtagLine;
      }
    }
    let rootUri: string | undefined;
    let rootCid: string | undefined;
    let parentUri: string | undefined;
    let parentCid: string | undefined;
    let firstUrl = '';

    for (let i = 0; i < chunks.length; i++) {
      const rt = new RichText({ text: chunks[i] });
      await rt.detectFacets(agent);

      const record: Record<string, unknown> = {
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
      };

      if (rootUri && parentUri) {
        record.reply = {
          root: { uri: rootUri, cid: rootCid },
          parent: { uri: parentUri, cid: parentCid },
        };
      }

      const res = await agent.post(record);

      if (i === 0) {
        rootUri = res.uri;
        rootCid = res.cid;
        const did = res.uri.split('/')[2];
        const rkey = res.uri.split('/').pop();
        firstUrl = `https://bsky.app/profile/${did}/post/${rkey}`;
      }

      parentUri = res.uri;
      parentCid = res.cid;
    }

    return { platform: this.platform, success: true, url: firstUrl };
  }
}
