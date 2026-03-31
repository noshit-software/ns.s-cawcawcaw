import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class GhostAdapter implements PublisherAdapter {
  readonly platform = 'ghost';

  readonly constraints: PlatformConstraints = {
    maxChars: undefined,
    supportsMarkdown: true,
    supportsHashtags: false,
    supportsLinks: true,
    maxHashtags: undefined,
  };

  isConfigured(): boolean {
    return !!(getCredential('ghost', 'api_url') && getCredential('ghost', 'admin_api_key'));
  }

  async publish(_draft: PostDraft): Promise<PublishResult> {
    // TODO: Implement Ghost Admin API publishing
    // Ghost Admin API uses JWT signed with the admin API key
    // POST {api_url}/ghost/api/admin/posts/
    return {
      platform: this.platform,
      success: false,
      error: 'Ghost adapter not yet implemented',
    };
  }
}
