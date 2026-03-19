import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class InstagramAdapter implements PublisherAdapter {
  readonly platform = 'instagram';

  readonly constraints: PlatformConstraints = {
    maxChars: 2200,
    supportsMarkdown: false,
    supportsHashtags: true,
    supportsLinks: false,
    maxHashtags: 30,
  };

  isConfigured(): boolean {
    return !!(getCredential('instagram', 'access_token') && getCredential('instagram', 'account_id'));
  }

  async publish(_draft: PostDraft): Promise<PublishResult> {
    // Instagram Graph API requires an image/video for every post.
    // Text-only posting is not supported. This adapter will need
    // an image generation step (or template card) before it can publish.
    return {
      platform: this.platform,
      success: false,
      error: 'Instagram requires media — text-only posting not supported by API',
    };
  }
}
