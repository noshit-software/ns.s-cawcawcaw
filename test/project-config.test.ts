import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { PATHS } from '../src/store/paths.js';

const CONFIG_PATH = PATHS.projects;

// Save/restore the real config file around each test
let originalContent: string | null = null;

function backup() {
  originalContent = existsSync(CONFIG_PATH)
    ? readFileSync(CONFIG_PATH, 'utf-8')
    : null;
}

function restore() {
  if (originalContent !== null) {
    writeFileSync(CONFIG_PATH, originalContent, 'utf-8');
  } else if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
  }
}

// Dynamically import to avoid module caching issues across tests
async function loadModule() {
  // Each test suite shares the same import, but we reset file state
  const mod = await import('../src/store/project-config.js');
  return mod;
}

describe('project-config store', () => {
  let mod: Awaited<ReturnType<typeof loadModule>>;

  beforeEach(async () => {
    backup();
    mod = await loadModule();
  });

  afterEach(() => {
    restore();
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have reviewRequired set to true', () => {
      assert.strictEqual(mod.DEFAULT_CONFIG.reviewRequired, true);
    });

    it('should have a sensible default for voice', () => {
      assert.ok(mod.DEFAULT_CONFIG.voice.length > 0, 'voice should not be empty');
      assert.ok(
        mod.DEFAULT_CONFIG.voice.toLowerCase().includes('first person'),
        'voice should mention first person'
      );
    });

    it('should have a sensible default for detailLevel', () => {
      assert.ok(mod.DEFAULT_CONFIG.detailLevel.length > 0, 'detailLevel should not be empty');
      assert.strictEqual(mod.DEFAULT_CONFIG.detailLevel, 'high-level');
    });
  });

  describe('getProjectConfig', () => {
    it('should return DEFAULT_CONFIG for unknown projects', () => {
      // Write an empty store
      writeFileSync(CONFIG_PATH, '{}', 'utf-8');
      const config = mod.getProjectConfig('nonexistent-project-xyz');
      assert.deepStrictEqual(config, mod.DEFAULT_CONFIG);
    });

    it('should merge stored values with defaults', () => {
      writeFileSync(CONFIG_PATH, JSON.stringify({
        'test-proj': { schedule: '09:00', reviewRequired: false }
      }), 'utf-8');
      const config = mod.getProjectConfig('test-proj');
      assert.strictEqual(config.schedule, '09:00');
      assert.strictEqual(config.reviewRequired, false);
      // Defaults should fill in the rest
      assert.strictEqual(config.voice, mod.DEFAULT_CONFIG.voice);
      assert.strictEqual(config.detailLevel, mod.DEFAULT_CONFIG.detailLevel);
    });
  });

  describe('setProjectConfig', () => {
    it('should filter out undefined values and not override existing fields', () => {
      // Set initial config
      writeFileSync(CONFIG_PATH, JSON.stringify({
        'test-proj': { ...mod.DEFAULT_CONFIG, schedule: '09:00', tagline: 'CAW.' }
      }), 'utf-8');

      // Call setProjectConfig with some undefined values
      mod.setProjectConfig('test-proj', {
        schedule: '12:00',
        tagline: undefined,  // should NOT override existing 'CAW.'
        philosophy: undefined,
      });

      const config = mod.getProjectConfig('test-proj');
      assert.strictEqual(config.schedule, '12:00', 'schedule should be updated');
      assert.strictEqual(config.tagline, 'CAW.', 'tagline should NOT be overridden by undefined');
    });

    it('should merge with defaults for a new project', () => {
      writeFileSync(CONFIG_PATH, '{}', 'utf-8');
      mod.setProjectConfig('brand-new', { schedule: 'immediate' });
      const config = mod.getProjectConfig('brand-new');
      assert.strictEqual(config.schedule, 'immediate');
      assert.strictEqual(config.reviewRequired, true, 'should inherit default reviewRequired');
      assert.strictEqual(config.voice, mod.DEFAULT_CONFIG.voice);
    });
  });

  describe('getAllProjectConfigs', () => {
    it('should merge defaults into all stored configs so new fields are always present', () => {
      // Simulate a store written before voice/detailLevel existed
      writeFileSync(CONFIG_PATH, JSON.stringify({
        'old-proj': { schedule: '05:00', reviewRequired: false, platforms: [], githubRepo: '', philosophy: '', tagline: '', lastCatchupCommit: '' }
      }), 'utf-8');

      const all = mod.getAllProjectConfigs();
      assert.ok(all['old-proj'], 'old-proj should exist');
      assert.strictEqual(all['old-proj'].voice, mod.DEFAULT_CONFIG.voice, 'voice should be merged from defaults');
      assert.strictEqual(all['old-proj'].detailLevel, mod.DEFAULT_CONFIG.detailLevel, 'detailLevel should be merged from defaults');
      assert.strictEqual(all['old-proj'].reviewRequired, false, 'stored reviewRequired should not be overridden');
    });
  });
});
