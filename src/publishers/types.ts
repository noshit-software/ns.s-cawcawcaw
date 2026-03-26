export interface PostDraft {
  headline: string;        // 1-sentence lede
  body: string;            // full narrative body, no character limit applied
  summary: string;         // short-form version for character-limited platforms (≤280 chars)
  tags: string[];          // thematic tags, no # prefix
  projectName: string;
  philosophyPoint: string; // which philosophy point this post advances
}

export interface PublishResult {
  platform: string;
  success: boolean;
  url?: string;
  error?: string;
}

export interface PlatformConstraints {
  maxChars?: number;
  supportsMarkdown: boolean;
  supportsHashtags: boolean;
  supportsLinks: boolean;
  maxHashtags?: number;
}

export interface PublisherAdapter {
  readonly platform: string;
  readonly constraints: PlatformConstraints;
  isConfigured(): boolean;
  publish(draft: PostDraft): Promise<PublishResult>;
}
