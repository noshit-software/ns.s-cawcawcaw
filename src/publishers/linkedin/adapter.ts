import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { formatForLinkedIn, LINKEDIN_CONSTRAINTS } from './format.js';
import { getCredential } from '../../store/credentials.js';

export class LinkedInAdapter implements PublisherAdapter {
  readonly platform = 'linkedin';
  readonly constraints: PlatformConstraints = LINKEDIN_CONSTRAINTS;

  isConfigured(): boolean {
    return !!(getCredential('linkedin', 'access_token') && getCredential('linkedin', 'author_urn'));
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    const accessToken = getCredential('linkedin', 'access_token')!;
    const authorUrn = getCredential('linkedin', 'author_urn')!;
    const text = formatForLinkedIn(draft);

    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        platform: this.platform,
        success: false,
        error: `LinkedIn API error ${res.status}: ${errorText}`,
      };
    }

    const postId = res.headers.get('x-restli-id') ?? 'unknown';
    const url = `https://www.linkedin.com/feed/update/${postId}/`;

    return { platform: this.platform, success: true, url };
  }
}
