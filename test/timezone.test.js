import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userTimezone, _resetTimezoneCache } from '../js/timezone.js';

test('userTimezone: returns a plausible IANA string', () => {
  _resetTimezoneCache();
  const tz = userTimezone();
  assert.ok(typeof tz === 'string' && tz.length > 0, `got: ${tz}`);
  // Either valid IANA ('/' separated) or UTC fallback
  assert.ok(tz === 'UTC' || tz.includes('/'), `unexpected tz: ${tz}`);
});

test('userTimezone: cached — same value across calls', () => {
  _resetTimezoneCache();
  const a = userTimezone();
  const b = userTimezone();
  assert.equal(a, b);
});

test('userTimezone: falls back to UTC when Intl throws', () => {
  _resetTimezoneCache();
  const orig = Intl.DateTimeFormat;
  globalThis.Intl = {
    ...Intl,
    DateTimeFormat: function () {
      return { resolvedOptions: () => { throw new Error('nope'); } };
    },
  };
  try {
    const tz = userTimezone();
    assert.equal(tz, 'UTC');
  } finally {
    globalThis.Intl.DateTimeFormat = orig;
    _resetTimezoneCache();
  }
});
