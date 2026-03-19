import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class HashnodeAdapter implements PublisherAdapter {
  readonly platform = 'hashnode';

  readonly constraints: PlatformConstraints = {
    maxChars: undefined,
    supportsMarkdown: true,
    supportsHashtags: true,
    supportsLinks: true,
  };

  isConfigured(): boolean {
    return !!(getCredential('hashnode', 'access_token') && getCredential('hashnode', 'publication_id'));
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    const token = getCredential('hashnode', 'access_token')!;
    const publicationId = getCredential('hashnode', 'publication_id')!;

    const query = `mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) { post { url } }
    }`;

    const res = await fetch('https://gql.hashnode.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            title: draft.headline,
            contentMarkdown: draft.body,
            publicationId,
            tags: draft.tags.map(t => ({ name: t })),
          },
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { platform: this.platform, success: false, error: `Hashnode API error ${res.status}: ${errorText}` };
    }

    const data = await res.json() as { data?: { publishPost?: { post?: { url?: string } } } };
    return { platform: this.platform, success: true, url: data.data?.publishPost?.post?.url };
  }
}
