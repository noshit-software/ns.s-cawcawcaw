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
}

export const PLATFORM_MANIFEST: Record<string, PlatformDef> = {
  linkedin: {
    label: 'LinkedIn',
    description: 'Professional network',
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
};
