import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class YouTubeAdapter implements PublisherAdapter {
  readonly platform = 'youtube';

  readonly constraints: PlatformConstraints = {
    maxChars: 5000,
    supportsMarkdown: false,
    supportsHashtags: true,
    supportsLinks: true,
  };

  isConfigured(): boolean {
    return !!(getCredential('youtube', 'access_token') && getCredential('youtube', 'channel_id'));
  }

  async publish(_draft: PostDraft): Promise<PublishResult> {
    // YouTube Community Posts API is not publicly available —
    // it's restricted to channels with 500+ subscribers and
    // requires YouTube Data API v3 with special access.
    // This will need manual OAuth flow setup.
    return {
      platform: this.platform,
      success: false,
      error: 'YouTube Community posting not yet implemented — requires special API access',
    };
  }
}
