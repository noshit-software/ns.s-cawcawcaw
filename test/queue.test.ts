import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { PATHS } from '../src/store/paths.js';

const QUEUE_PATH = PATHS.queue;

let originalContent: string | null = null;

function backup() {
  originalContent = existsSync(QUEUE_PATH)
    ? readFileSync(QUEUE_PATH, 'utf-8')
    : null;
}

function restore() {
  if (originalContent !== null) {
    writeFileSync(QUEUE_PATH, originalContent, 'utf-8');
  } else if (existsSync(QUEUE_PATH)) {
    unlinkSync(QUEUE_PATH);
  }
}

async function loadModule() {
  const mod = await import('../src/store/queue.js');
  return mod;
}

describe('queue store', () => {
  let mod: Awaited<ReturnType<typeof loadModule>>;

  beforeEach(async () => {
    backup();
    // Start with an empty queue
    writeFileSync(QUEUE_PATH, '[]', 'utf-8');
    mod = await loadModule();
  });

  afterEach(() => {
    restore();
  });

  describe('enqueue with missing/null tags', () => {
    it('should default tags to empty array when tags is null', () => {
      const draft = {
        headline: 'Test',
        body: 'Body',
        tags: null as unknown as string[],
        projectName: 'proj',
        philosophyPoint: 'point',
      };
      const post = mod.enqueue('proj', draft, 'live', [], true);
      assert.ok(Array.isArray(post.draft.tags), 'tags should be an array');
      assert.deepStrictEqual(post.draft.tags, []);
    });

    it('should default tags to empty array when tags is undefined', () => {
      const draft = {
        headline: 'Test',
        body: 'Body',
        tags: undefined as unknown as string[],
        projectName: 'proj',
        philosophyPoint: 'point',
      };
      const post = mod.enqueue('proj', draft, 'live', [], true);
      assert.ok(Array.isArray(post.draft.tags), 'tags should be an array');
      assert.deepStrictEqual(post.draft.tags, []);
    });

    it('should preserve valid tags array', () => {
      const draft = {
        headline: 'Test',
        body: 'Body',
        tags: ['rust', 'wasm'],
        projectName: 'proj',
        philosophyPoint: 'point',
      };
      const post = mod.enqueue('proj', draft, 'live', [], true);
      assert.deepStrictEqual(post.draft.tags, ['rust', 'wasm']);
    });
  });

  describe('enqueue with missing fields', () => {
    it('should default headline to empty string when missing', () => {
      const draft = {
        body: 'Body',
        tags: [],
        projectName: 'proj',
        philosophyPoint: 'point',
      } as any;
      const post = mod.enqueue('proj', draft, 'live', [], true);
      assert.strictEqual(post.draft.headline, '');
    });

    it('should default body to empty string when missing', () => {
      const draft = {
        headline: 'Title',
        tags: [],
        projectName: 'proj',
        philosophyPoint: 'point',
      } as any;
      delete draft.body;
      const post = mod.enqueue('proj', draft, 'live', [], true);
      assert.strictEqual(post.draft.body, '');
    });

    it('should default philosophyPoint to empty string when missing', () => {
      const draft = {
        headline: 'Title',
        body: 'Body',
        tags: [],
        projectName: 'proj',
      } as any;
      const post = mod.enqueue('proj', draft, 'live', [], true);
      assert.strictEqual(post.draft.philosophyPoint, '');
    });

    it('should default projectName to the project argument when missing', () => {
      const draft = {
        headline: 'Title',
        body: 'Body',
        tags: [],
        philosophyPoint: 'point',
      } as any;
      const post = mod.enqueue('my-project', draft, 'live', [], true);
      assert.strictEqual(post.draft.projectName, 'MY-PROJECT');
    });
  });

  describe('enqueue status based on reviewRequired', () => {
    it('should set status to pending_review when reviewRequired is true', () => {
      const draft = {
        headline: 'Test',
        body: 'Body',
        tags: [],
        projectName: 'proj',
        philosophyPoint: 'point',
      };
      const post = mod.enqueue('proj', draft, 'live', [], true);
      assert.strictEqual(post.status, 'pending_review');
    });

    it('should set status to approved when reviewRequired is false', () => {
      const draft = {
        headline: 'Test',
        body: 'Body',
        tags: [],
        projectName: 'proj',
        philosophyPoint: 'point',
      };
      const post = mod.enqueue('proj', draft, 'live', [], false);
      assert.strictEqual(post.status, 'approved');
    });
  });
});
