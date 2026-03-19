import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return _client;
}

export const MODEL = 'claude-sonnet-4-6';
