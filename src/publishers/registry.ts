import { type PublisherAdapter } from './types.js';
import { LinkedInAdapter } from './linkedin/adapter.js';
import { BlueskyAdapter } from './bluesky/adapter.js';
// import { TwitterAdapter } from './twitter/adapter.js';
// import { DiscordAdapter } from './discord/adapter.js';
import { MastodonAdapter } from './mastodon/adapter.js';
// import { RedditAdapter } from './reddit/adapter.js';
import { DevtoAdapter } from './devto/adapter.js';
import { HashnodeAdapter } from './hashnode/adapter.js';
import { HackerNewsAdapter } from './hackernews/adapter.js';
import { FacebookAdapter } from './facebook/adapter.js';
import { InstagramAdapter } from './instagram/adapter.js';
import { ThreadsAdapter } from './threads/adapter.js';
import { TikTokAdapter } from './tiktok/adapter.js';
import { MediumAdapter } from './medium/adapter.js';
import { YouTubeAdapter } from './youtube/adapter.js';

const ALL_ADAPTERS: PublisherAdapter[] = [
  new LinkedInAdapter(),
  new BlueskyAdapter(),
  // new TwitterAdapter(),
  // new DiscordAdapter(),
  new MastodonAdapter(),
  // new RedditAdapter(),
  new DevtoAdapter(),
  new FacebookAdapter(),
  new HackerNewsAdapter(),
  new HashnodeAdapter(),
  new InstagramAdapter(),
  new MediumAdapter(),
  new ThreadsAdapter(),
  new TikTokAdapter(),
  new YouTubeAdapter(),
];

export function getEnabledAdapters(): PublisherAdapter[] {
  return ALL_ADAPTERS.filter(a => a.isConfigured());
}
