// node --test test/deaths.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FALLBACK_ANNUAL,
  FALLBACK_DAILY,
  SECONDS_PER_YEAR,
  calculateAnnualDeathRate,
  deathsPerSecond,
  dailyDeaths,
  getSessionStartMs,
  getSessionDeaths,
} from '../js/deaths.js';

// In-memory sessionStorage shim — node has no sessionStorage.
let _store = {};
globalThis.sessionStorage = {
  getItem: (k) => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { _store = {}; },
};

const conflicts = JSON.parse(readFileSync(new URL('../data/conflicts.json', import.meta.url)));

test('FALLBACK_ANNUAL is a plausible snapshot (~150k-500k)', () => {
  assert.ok(FALLBACK_ANNUAL > 150000, `annual ${FALLBACK_ANNUAL} too low`);
  assert.ok(FALLBACK_ANNUAL < 500000, `annual ${FALLBACK_ANNUAL} too high`);
});

test('FALLBACK_DAILY ≈ FALLBACK_ANNUAL / 365', () => {
  const delta = Math.abs(FALLBACK_DAILY - FALLBACK_ANNUAL / 365);
  assert.ok(delta < 5, `daily ${FALLBACK_DAILY} off from annual/365 by ${delta}`);
});

test('calculateAnnualDeathRate: empty array → fallback', () => {
  assert.equal(calculateAnnualDeathRate([]), FALLBACK_ANNUAL);
});

test('calculateAnnualDeathRate: non-array → fallback', () => {
  assert.equal(calculateAnnualDeathRate(null), FALLBACK_ANNUAL);
  assert.equal(calculateAnnualDeathRate(undefined), FALLBACK_ANNUAL);
});

test('calculateAnnualDeathRate: single conflict with valid data', () => {
  const startYear = new Date().getFullYear() - 2; // 2 years active
  const rate = calculateAnnualDeathRate([{ casualties: 10000, startYear }]);
  assert.equal(rate, 5000); // 10000 / 2
});

test('calculateAnnualDeathRate: missing startYear → yearsActive=1', () => {
  const rate = calculateAnnualDeathRate([{ casualties: 10000 }]);
  assert.equal(rate, 10000); // 10000 / max(1, 0) = 10000
});

test('calculateAnnualDeathRate: missing casualties → contributes 0', () => {
  const rate = calculateAnnualDeathRate([
    { casualties: 10000, startYear: new Date().getFullYear() - 1 },
    { startYear: new Date().getFullYear() - 1 },
  ]);
  assert.equal(rate, 10000);
});

test('R1 regression: conflicts.json produces same value as app.js formula', () => {
  // This is the IRON RULE regression — must match js/app.js:51-54
  // (pre-extraction logic) byte-for-byte.
  const currentYear = new Date().getFullYear();
  const expected = conflicts.reduce((sum, c) => {
    const yearsActive = Math.max(1, currentYear - (c.startYear || currentYear));
    return sum + c.casualties / yearsActive;
  }, 0);
  const actual = calculateAnnualDeathRate(conflicts);
  assert.equal(actual, expected, 'deaths.js output diverged from app.js formula');
});

test('R1 regression: dailyDeaths from live conflicts.json matches stats-bar formula', () => {
  // app.js:55 — dailyDeaths = Math.round(annualDeathRate / 365)
  const annual = calculateAnnualDeathRate(conflicts);
  const expected = Math.round(annual / 365);
  assert.equal(dailyDeaths(annual), expected);
});

test('deathsPerSecond: divides by 365.25 * 24 * 3600', () => {
  assert.equal(deathsPerSecond(SECONDS_PER_YEAR), 1);
  assert.equal(deathsPerSecond(SECONDS_PER_YEAR * 2), 2);
  assert.equal(deathsPerSecond(0), 0);
});

test('deathsPerSecond: fallback annual rate gives reasonable per-second', () => {
  // ~273000/year / (365.25 * 86400) ≈ 0.00866 death/sec
  const rate = deathsPerSecond(FALLBACK_ANNUAL);
  assert.ok(rate > 0.008 && rate < 0.009, `rate ${rate} out of expected band`);
});

test('getSessionStartMs: fresh session creates key', () => {
  _store = {};
  const t1 = getSessionStartMs();
  assert.ok(typeof t1 === 'number');
  assert.ok(t1 > 0);
  assert.equal(_store['pow-session-start-ms'], String(t1));
});

test('getSessionStartMs: existing key is reused', () => {
  _store = { 'pow-session-start-ms': '1700000000000' };
  const t = getSessionStartMs();
  assert.equal(t, 1700000000000);
});

test('getSessionStartMs: sessionStorage throwing falls back to Date.now()', () => {
  const orig = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    getItem: () => { throw new Error('disabled'); },
    setItem: () => { throw new Error('disabled'); },
  };
  const t = getSessionStartMs();
  assert.ok(typeof t === 'number' && t > 0);
  globalThis.sessionStorage = orig;
});

test('getSessionDeaths: zero elapsed → 0', () => {
  _store = {};
  const now = Date.now();
  const count = getSessionDeaths(FALLBACK_ANNUAL, now);
  assert.equal(count, 0);
});

test('getSessionDeaths: 1 year elapsed → annualRate', () => {
  _store = {};
  const pastStart = Date.now() - (SECONDS_PER_YEAR * 1000);
  const count = getSessionDeaths(FALLBACK_ANNUAL, pastStart);
  // Should be close to FALLBACK_ANNUAL (floor due to Math.floor)
  assert.ok(count >= FALLBACK_ANNUAL - 1 && count <= FALLBACK_ANNUAL + 1,
    `count ${count} not within ±1 of ${FALLBACK_ANNUAL}`);
});

test('getSessionDeaths: future start (clock skew) → 0', () => {
  _store = {};
  const futureStart = Date.now() + 10000;
  const count = getSessionDeaths(FALLBACK_ANNUAL, futureStart);
  assert.equal(count, 0);
});
