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

    const fullText = draft.headline
      ? `${draft.headline}\n\n${draft.body}`
      : draft.body;

    const chunks = splitThread(fullText, 300);
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

      // Thread replies reference both root and parent
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

/** Split text into thread chunks at sentence or word boundaries. */
function splitThread(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }

    // Find best split point: last sentence-ending punctuation within limit
    let splitAt = -1;
    const searchZone = remaining.slice(0, maxChars);

    // Try splitting at sentence boundaries (. ! ? followed by space or newline)
    for (let j = searchZone.length - 1; j >= maxChars * 0.4; j--) {
      if ('.!?\n'.includes(searchZone[j]) && (j + 1 >= searchZone.length || ' \n\t'.includes(searchZone[j + 1]))) {
        splitAt = j + 1;
        break;
      }
    }

    // Fall back to last space
    if (splitAt === -1) {
      splitAt = searchZone.lastIndexOf(' ');
    }

    // Last resort: hard cut
    if (splitAt <= 0) {
      splitAt = maxChars;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks;
}
