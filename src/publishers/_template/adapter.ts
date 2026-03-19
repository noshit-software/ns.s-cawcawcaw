/**
 * Platform adapter template — copy this folder to add a new platform.
 *
 * Steps:
 * 1. cp -r src/publishers/_template src/publishers/<platform>
 * 2. Implement isConfigured(), publish(), and constraints
 * 3. Add platform credentials to src/config.ts (optional block)
 * 4. Import + register in src/publishers/registry.ts
 * 5. Update README.md
 */

import { type PublisherAdapter, type PostDraft, type PublishResult, type PlatformConstraints } from '../types.js';

export class TemplatePlatformAdapter implements PublisherAdapter {
  readonly platform = 'template'; // replace with platform name

  readonly constraints: PlatformConstraints = {
    maxChars: undefined,        // set if platform has a character limit
    supportsMarkdown: false,    // true if the platform renders markdown
    supportsHashtags: false,    // true if hashtags are conventional on this platform
    supportsLinks: true,        // false for platforms that strip links (e.g. some Instagram)
    maxHashtags: undefined,
  };

  isConfigured(): boolean {
    // Return true only when all required credentials are present
    // e.g.: return !!(config.template.apiKey && config.template.secret);
    return false;
  }

  async publish(draft: PostDraft): Promise<PublishResult> {
    // 1. Format the draft for this platform using this.constraints
    //    (truncate, strip/add markdown, inject hashtags, etc.)
    const _text = formatForPlatform(draft);

    // 2. Call the platform API

    // 3. Return result
    return {
      platform: this.platform,
      success: false,
      error: 'Not implemented',
    };
  }
}

function formatForPlatform(draft: PostDraft): string {
  // Shape draft.body to fit this.constraints
  // Keep it simple — truncate if needed, add hashtags if supported
  void draft;
  return '';
}
