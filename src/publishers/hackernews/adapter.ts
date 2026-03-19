import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';
import { getCredential } from '../../store/credentials.js';

export class HackerNewsAdapter implements PublisherAdapter {
  readonly platform = 'hackernews';

  readonly constraints: PlatformConstraints = {
    maxChars: undefined,
    supportsMarkdown: false,
    supportsHashtags: false,
    supportsLinks: true,
  };

  isConfigured(): boolean {
    return !!(getCredential('hackernews', 'username') && getCredential('hackernews', 'password'));
  }

  async publish(_draft: PostDraft): Promise<PublishResult> {
    // HN has no official API for posting — requires cookie-based auth
    // and form submission. Implementing this properly requires a session flow.
    return {
      platform: this.platform,
      success: false,
      error: 'Hacker News posting not yet implemented — no official write API',
    };
  }
}
