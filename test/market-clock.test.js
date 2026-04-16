// node --test test/market-clock.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  localParts,
  marketStatus,
  nextOpenAt,
  formatCountdown,
  checkHolidaysFreshness,
} from '../js/market-clock.js';

const nyse = JSON.parse(readFileSync(new URL('../data/us-market-holidays.json', import.meta.url)));
const krx = JSON.parse(readFileSync(new URL('../data/kr-market-holidays.json', import.meta.url)));

// Helper: construct an instant that represents the given local wall-clock in
// the given tz. Used to author tests without hard-coding UTC offsets that
// change around DST.
function atLocalTime(dateStr, timeStr, tz) {
  // UTC midday gives a stable anchor, then the code under test handles tz.
  const probe = new Date(`${dateStr}T${timeStr}:00Z`);
  // Shift until localParts matches the target.
  for (let i = 0; i < 3; i++) {
    const p = localParts(probe, tz);
    const [targetH, targetM] = timeStr.split(':').map(Number);
    const [localH, localM] = p.time.split(':').map(Number);
    const delta = (targetH - localH) * 60 + (targetM - localM);
    if (delta === 0 && p.date === dateStr) return probe;
    probe.setTime(probe.getTime() + delta * 60 * 1000);
  }
  return probe;
}

test('localParts: Seoul 09:00 on 2026-04-20', () => {
  const d = atLocalTime('2026-04-20', '09:00', 'Asia/Seoul');
  const p = localParts(d, 'Asia/Seoul');
  assert.equal(p.date, '2026-04-20');
  assert.equal(p.time, '09:00');
  assert.equal(p.weekday, 'Mon');
});

test('marketStatus NYSE: open at 10:00 ET on a weekday', () => {
  const d = atLocalTime('2026-04-20', '10:00', 'America/New_York');
  const s = marketStatus(d, nyse);
  assert.equal(s.state, 'OPEN');
  assert.equal(s.closeAt, '16:00');
});

test('marketStatus NYSE: closed on Saturday', () => {
  const d = atLocalTime('2026-04-18', '12:00', 'America/New_York');
  const s = marketStatus(d, nyse);
  assert.equal(s.state, 'CLOSED');
  assert.equal(s.reason, 'weekend');
});

test('marketStatus NYSE: closed on Christmas 2026', () => {
  const d = atLocalTime('2026-12-25', '10:00', 'America/New_York');
  const s = marketStatus(d, nyse);
  assert.equal(s.state, 'CLOSED');
  assert.equal(s.reason, 'holiday');
});

test('marketStatus NYSE: open but early close on day after Thanksgiving', () => {
  const d = atLocalTime('2026-11-27', '12:00', 'America/New_York');
  const s = marketStatus(d, nyse);
  assert.equal(s.state, 'OPEN');
  assert.equal(s.early, true);
  assert.equal(s.closeAt, '13:00');
});

test('marketStatus NYSE: closed after early close', () => {
  const d = atLocalTime('2026-11-27', '13:30', 'America/New_York');
  const s = marketStatus(d, nyse);
  assert.equal(s.state, 'CLOSED');
  assert.equal(s.reason, 'after_close');
});

test('marketStatus NYSE: DST boundary — 2026-03-08 early (spring forward)', () => {
  // DST started 2026-03-08 at 02:00 ET → skipped to 03:00. Monday 2026-03-09 open.
  const d = atLocalTime('2026-03-09', '09:45', 'America/New_York');
  const s = marketStatus(d, nyse);
  assert.equal(s.state, 'OPEN');
});

test('marketStatus NYSE: DST boundary — 2026-11-01 late (fall back)', () => {
  // DST ends 2026-11-01 at 02:00 ET → repeats 01:00. Monday 2026-11-02 open.
  const d = atLocalTime('2026-11-02', '10:00', 'America/New_York');
  const s = marketStatus(d, nyse);
  assert.equal(s.state, 'OPEN');
});

test('marketStatus KRX: open at 10:00 KST on weekday', () => {
  const d = atLocalTime('2026-04-20', '10:00', 'Asia/Seoul');
  const s = marketStatus(d, krx);
  assert.equal(s.state, 'OPEN');
  assert.equal(s.closeAt, '15:30');
});

test('marketStatus KRX: closed on 설날 2026-02-17', () => {
  const d = atLocalTime('2026-02-17', '10:00', 'Asia/Seoul');
  const s = marketStatus(d, krx);
  assert.equal(s.state, 'CLOSED');
  assert.equal(s.reason, 'holiday');
});

test('marketStatus KRX: closed before 09:00', () => {
  const d = atLocalTime('2026-04-20', '08:30', 'Asia/Seoul');
  const s = marketStatus(d, krx);
  assert.equal(s.state, 'CLOSED');
  assert.equal(s.reason, 'before_open');
});

test('nextOpenAt NYSE: from Friday 5pm → Monday 09:30', () => {
  const d = atLocalTime('2026-04-17', '17:00', 'America/New_York');
  const next = nextOpenAt(d, nyse);
  const p = localParts(next, 'America/New_York');
  assert.equal(p.date, '2026-04-20');
  assert.equal(p.time, '09:30');
});

test('nextOpenAt KRX: before open → same day 09:00', () => {
  const d = atLocalTime('2026-04-20', '08:00', 'Asia/Seoul');
  const next = nextOpenAt(d, krx);
  const p = localParts(next, 'Asia/Seoul');
  assert.equal(p.date, '2026-04-20');
  assert.equal(p.time, '09:00');
});

test('nextOpenAt KRX: 설날 주 → skip 3 holidays', () => {
  const d = atLocalTime('2026-02-15', '12:00', 'Asia/Seoul');
  const next = nextOpenAt(d, krx);
  const p = localParts(next, 'Asia/Seoul');
  // 2/16-17-18 all holidays, open resumes 2026-02-19 (Thu)
  assert.equal(p.date, '2026-02-19');
});

test('formatCountdown EN', () => {
  assert.equal(formatCountdown(34 * 60_000, 'en'), '34m');
  assert.equal(formatCountdown((3 * 60 + 24) * 60_000, 'en'), '3h 24m');
  assert.equal(formatCountdown(25 * 60 * 60_000, 'en'), '1d 1h');
  assert.equal(formatCountdown(30_000, 'en'), 'less than 1 minute');
  assert.equal(formatCountdown(0, 'en'), 'now');
});

test('formatCountdown KO', () => {
  assert.equal(formatCountdown(34 * 60_000, 'ko'), '34분');
  assert.equal(formatCountdown((3 * 60 + 24) * 60_000, 'ko'), '3시간 24분');
  assert.equal(formatCountdown(30_000, 'ko'), '1분 미만');
});

test('checkHolidaysFreshness: fresh', () => {
  const fresh = { market: 'NYSE', valid_through: '2026-12-31' };
  const r = checkHolidaysFreshness(fresh, new Date('2026-04-17'));
  assert.equal(r, 'ok');
});

test('checkHolidaysFreshness: warn (<30 days)', () => {
  const soon = { market: 'NYSE', valid_through: '2026-12-31' };
  const r = checkHolidaysFreshness(soon, new Date('2026-12-15'));
  assert.equal(r, 'warn');
});

test('checkHolidaysFreshness: expired', () => {
  const stale = { market: 'NYSE', valid_through: '2025-12-31' };
  const r = checkHolidaysFreshness(stale, new Date('2026-04-17'));
  assert.equal(r, 'expired');
});
