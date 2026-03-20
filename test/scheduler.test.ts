import { describe, it } from 'node:test';
import assert from 'node:assert';

// parseSchedule and shouldPublishNow are pure functions — no file I/O needed
async function loadModule() {
  const mod = await import('../src/store/project-config.js');
  return mod;
}

describe('parseSchedule', () => {
  let parseSchedule: Awaited<ReturnType<typeof loadModule>>['parseSchedule'];

  it('setup', async () => {
    const mod = await loadModule();
    parseSchedule = mod.parseSchedule;
  });

  it('should return type immediate for "immediate"', async () => {
    const mod = await loadModule();
    const spec = mod.parseSchedule('immediate');
    assert.strictEqual(spec.type, 'immediate');
    assert.strictEqual(spec.hour, undefined);
    assert.strictEqual(spec.minute, undefined);
  });

  it('should return type immediate for empty string', async () => {
    const mod = await loadModule();
    const spec = mod.parseSchedule('');
    assert.strictEqual(spec.type, 'immediate');
  });

  it('should parse "05:00" correctly', async () => {
    const mod = await loadModule();
    const spec = mod.parseSchedule('05:00');
    assert.strictEqual(spec.type, 'timed');
    assert.strictEqual(spec.hour, 5);
    assert.strictEqual(spec.minute, 0);
    assert.strictEqual(spec.days, 'all');
  });

  it('should parse "09:00 weekdays" correctly', async () => {
    const mod = await loadModule();
    const spec = mod.parseSchedule('09:00 weekdays');
    assert.strictEqual(spec.type, 'timed');
    assert.strictEqual(spec.hour, 9);
    assert.strictEqual(spec.minute, 0);
    assert.strictEqual(spec.days, 'weekdays');
  });

  it('should parse "17:30 weekends" correctly', async () => {
    const mod = await loadModule();
    const spec = mod.parseSchedule('17:30 weekends');
    assert.strictEqual(spec.type, 'timed');
    assert.strictEqual(spec.hour, 17);
    assert.strictEqual(spec.minute, 30);
    assert.strictEqual(spec.days, 'weekends');
  });

  it('should return immediate for malformed input', async () => {
    const mod = await loadModule();
    const spec = mod.parseSchedule('not-a-schedule');
    assert.strictEqual(spec.type, 'immediate');
  });
});

describe('shouldPublishNow', () => {
  it('should always return true for immediate schedule', async () => {
    const mod = await loadModule();
    const spec = mod.parseSchedule('immediate');
    assert.strictEqual(mod.shouldPublishNow(spec), true);
    assert.strictEqual(mod.shouldPublishNow(spec, new Date().toISOString()), true);
  });

  it('should return false for timed schedule when hour does not match', async () => {
    const mod = await loadModule();
    // Pick an hour that definitely isn't the current hour
    const now = new Date();
    const wrongHour = (now.getHours() + 12) % 24;
    const spec = mod.parseSchedule(`${String(wrongHour).padStart(2, '0')}:00`);
    assert.strictEqual(mod.shouldPublishNow(spec), false);
  });
});
