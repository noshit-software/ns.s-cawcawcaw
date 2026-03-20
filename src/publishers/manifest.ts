export interface FieldDef {
  key: string;
  label: string;
  secret: boolean;
  placeholder?: string;
}

export interface PlatformDef {
  label: string;
  description: string;
  fields: FieldDef[];
  oauth?: string;  // URL path to start OAuth flow, e.g. '/auth/linkedin'
}

export const PLATFORM_MANIFEST: Record<string, PlatformDef> = {
  linkedin: {
    label: 'LinkedIn',
    description: 'Professional network',
    oauth: '/auth/linkedin',
    fields: [
      { key: 'access_token', label: 'ACCESS TOKEN', secret: true, placeholder: 'OAuth 2.0 access token' },
      { key: 'author_urn', label: 'AUTHOR URN', secret: false, placeholder: 'urn:li:person:XXXXXXXXXX' },
    ],
  },
  bluesky: {
    label: 'Bluesky',
    description: 'AT Protocol social',
    fields: [
      { key: 'handle', label: 'HANDLE', secret: false, placeholder: 'you.bsky.social' },
      { key: 'app_password', label: 'APP PASSWORD', secret: true, placeholder: 'xxxx-xxxx-xxxx-xxxx' },
    ],
  },
  twitter: {
    label: 'X/Twitter',
    description: 'Twitter/X API v2',
    fields: [
      { key: 'api_key', label: 'API KEY', secret: true },
      { key: 'api_secret', label: 'API SECRET', secret: true },
      { key: 'access_token', label: 'ACCESS TOKEN', secret: true },
      { key: 'access_secret', label: 'ACCESS SECRET', secret: true },
    ],
  },
  discord: {
    label: 'Discord',
    description: 'Webhook post',
    fields: [
      { key: 'webhook_url', label: 'WEBHOOK URL', secret: true, placeholder: 'https://discord.com/api/webhooks/...' },
    ],
  },
  mastodon: {
    label: 'Mastodon',
    description: 'Fediverse',
    fields: [
      { key: 'instance_url', label: 'INSTANCE URL', secret: false, placeholder: 'https://mastodon.social' },
      { key: 'access_token', label: 'ACCESS TOKEN', secret: true },
    ],
  },
  reddit: {
    label: 'Reddit',
    description: 'Subreddit post',
    fields: [
      { key: 'client_id', label: 'CLIENT ID', secret: false },
      { key: 'client_secret', label: 'CLIENT SECRET', secret: true },
      { key: 'username', label: 'USERNAME', secret: false },
      { key: 'password', label: 'PASSWORD', secret: true },
      { key: 'subreddit', label: 'SUBREDDIT', secret: false, placeholder: 'r/programming' },
    ],
  },
  devto: {
    label: 'Dev.to',
    description: 'Developer blogging platform',
    fields: [
      { key: 'api_key', label: 'API KEY', secret: true, placeholder: 'dev.to API key' },
    ],
  },
  hashnode: {
    label: 'Hashnode',
    description: 'Developer blogging platform',
    fields: [
      { key: 'access_token', label: 'ACCESS TOKEN', secret: true, placeholder: 'Hashnode personal access token' },
      { key: 'publication_id', label: 'PUBLICATION ID', secret: false, placeholder: 'Your publication/blog ID' },
    ],
  },
  hackernews: {
    label: 'Hacker News',
    description: 'Y Combinator tech forum',
    fields: [
      { key: 'username', label: 'USERNAME', secret: false },
      { key: 'password', label: 'PASSWORD', secret: true },
    ],
  },
  facebook: {
    label: 'Facebook',
    description: 'Facebook Page post',
    fields: [
      { key: 'page_access_token', label: 'PAGE ACCESS TOKEN', secret: true },
      { key: 'page_id', label: 'PAGE ID', secret: false },
    ],
  },
  instagram: {
    label: 'Instagram',
    description: 'Instagram Business post',
    fields: [
      { key: 'access_token', label: 'ACCESS TOKEN', secret: true, placeholder: 'Instagram Graph API token' },
      { key: 'account_id', label: 'ACCOUNT ID', secret: false, placeholder: 'Instagram Business account ID' },
    ],
  },
  threads: {
    label: 'Threads',
    description: 'Meta Threads',
    fields: [
      { key: 'access_token', label: 'ACCESS TOKEN', secret: true, placeholder: 'Threads API token' },
      { key: 'user_id', label: 'USER ID', secret: false },
    ],
  },
  tiktok: {
    label: 'TikTok',
    description: 'TikTok text/photo post',
    fields: [
      { key: 'access_token', label: 'ACCESS TOKEN', secret: true, placeholder: 'TikTok Content Posting API token' },
    ],
  },
  medium: {
    label: 'Medium',
    description: 'General-audience blogging',
    fields: [
      { key: 'integration_token', label: 'INTEGRATION TOKEN', secret: true, placeholder: 'Medium integration token' },
    ],
  },
  youtube: {
    label: 'YouTube Community',
    description: 'YouTube Community post',
    fields: [
      { key: 'access_token', label: 'ACCESS TOKEN', secret: true, placeholder: 'YouTube OAuth token' },
      { key: 'channel_id', label: 'CHANNEL ID', secret: false },
    ],
  },
};
