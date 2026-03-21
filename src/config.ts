function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string): string | undefined {
  return process.env[key] || undefined;
}

function number(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const n = parseInt(val, 10);
  if (isNaN(n)) throw new Error(`Env var ${key} must be a number, got: ${val}`);
  return n;
}

export const config = {
  port: number('PORT', 3000),
  githubWebhookSecret: required('GITHUB_WEBHOOK_SECRET'),
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  knightsrookMcpUrl: optional('KNIGHTSROOK_MCP_URL'),
  uiPassword: optional('UI_PASSWORD'),

  // Platform credentials — adapter is silently skipped if its block is incomplete
  linkedin: {
    clientId: optional('LINKEDIN_CLIENT_ID'),
    clientSecret: optional('LINKEDIN_CLIENT_SECRET'),
    accessToken: optional('LINKEDIN_ACCESS_TOKEN'),
    authorUrn: optional('LINKEDIN_AUTHOR_URN'),
  },

  // bluesky: {
  //   handle: optional('BLUESKY_HANDLE'),
  //   appPassword: optional('BLUESKY_APP_PASSWORD'),
  // },

  // twitter: {
  //   apiKey: optional('TWITTER_API_KEY'),
  //   apiSecret: optional('TWITTER_API_SECRET'),
  //   accessToken: optional('TWITTER_ACCESS_TOKEN'),
  //   accessSecret: optional('TWITTER_ACCESS_SECRET'),
  // },

  // discord: {
  //   webhookUrl: optional('DISCORD_WEBHOOK_URL'),
  // },

  // mastodon: {
  //   instanceUrl: optional('MASTODON_INSTANCE_URL'),
  //   accessToken: optional('MASTODON_ACCESS_TOKEN'),
  // },

  // reddit: {
  //   clientId: optional('REDDIT_CLIENT_ID'),
  //   clientSecret: optional('REDDIT_CLIENT_SECRET'),
  //   username: optional('REDDIT_USERNAME'),
  //   password: optional('REDDIT_PASSWORD'),
  //   subreddit: optional('REDDIT_SUBREDDIT'),
  // },
};

export type Config = typeof config;
