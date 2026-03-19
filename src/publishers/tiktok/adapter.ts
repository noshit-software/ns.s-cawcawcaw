import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class TikTokAdapter implements PublisherAdapter {
  readonly platform = 'tiktok';

  readonly constraints: PlatformConstraints = {
    maxChars: 2200,
    supportsMarkdown: false,
    supportsHashtags: true,
    supportsLinks: false,
    maxHashtags: 5,
  };

  isConfigured(): boolean {
    return !!getCredential('tiktok', 'access_token');
  }

  async publish(_draft: PostDraft): Promise<PublishResult> {
    // TikTok Content Posting API requires photo or video content.
    // Text-only posts are possible via photo post with a generated image card.
    // Needs an image generation step before this adapter can work.
    return {
      platform: this.platform,
      success: false,
      error: 'TikTok posting not yet implemented — requires media content',
    };
  }
}
