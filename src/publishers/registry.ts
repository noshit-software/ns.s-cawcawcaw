import { type PublisherAdapter } from './types.js';
import { LinkedInAdapter } from './linkedin/adapter.js';
// import { BlueskyAdapter } from './bluesky/adapter.js';
// import { TwitterAdapter } from './twitter/adapter.js';
// import { DiscordAdapter } from './discord/adapter.js';
// import { MastodonAdapter } from './mastodon/adapter.js';
// import { RedditAdapter } from './reddit/adapter.js';

const ALL_ADAPTERS: PublisherAdapter[] = [
  new LinkedInAdapter(),
  // new BlueskyAdapter(),
  // new TwitterAdapter(),
  // new DiscordAdapter(),
  // new MastodonAdapter(),
  // new RedditAdapter(),
];

export function getEnabledAdapters(): PublisherAdapter[] {
  return ALL_ADAPTERS.filter(a => a.isConfigured());
}
