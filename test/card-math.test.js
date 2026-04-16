// node --test test/card-math.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGain,
  formatCurrency,
  formatPct,
  topStocksByAbsChange,
  AMOUNT_PRESETS,
} from '../js/card-math.js';

test('calculateGain: positive change', () => {
  const r = calculateGain(1000, 24.4);
  assert.equal(r.invested, 1000);
  assert.ok(Math.abs(r.today - 1244) < 0.01);
  assert.ok(Math.abs(r.profit - 244) < 0.01);
  assert.equal(r.gainPct, 24.4);
  assert.equal(r.isLoss, false);
});

test('calculateGain: negative change (loss)', () => {
  const r = calculateGain(1000, -15);
  assert.ok(Math.abs(r.today - 850) < 0.01);
  assert.ok(Math.abs(r.profit - -150) < 0.01);
  assert.equal(r.isLoss, true);
});

test('calculateGain: zero change', () => {
  const r = calculateGain(1000, 0);
  assert.equal(r.today, 1000);
  assert.equal(r.profit, 0);
  assert.equal(r.isLoss, false);
});

test('calculateGain: string inputs coerce', () => {
  const r = calculateGain('500', '10');
  assert.equal(r.invested, 500);
  assert.equal(r.today, 550);
});

test('calculateGain: invalid inputs return null', () => {
  assert.equal(calculateGain(NaN, 10), null);
  assert.equal(calculateGain(1000, NaN), null);
  assert.equal(calculateGain(-100, 10), null);
  assert.equal(calculateGain('abc', 10), null);
});

test('formatCurrency: large amount no decimals', () => {
  assert.equal(formatCurrency(3420), '$3,420');
  assert.equal(formatCurrency(1000), '$1,000');
});

test('formatCurrency: small amount with decimals', () => {
  assert.equal(formatCurrency(99.5), '$99.50');
});

test('formatCurrency: invalid', () => {
  assert.equal(formatCurrency(NaN), '—');
  assert.equal(formatCurrency(null), '—');
});

test('formatPct: positive with sign', () => {
  assert.equal(formatPct(24.4), '+24.4%');
  assert.equal(formatPct(24.44), '+24.4%');
});

test('formatPct: negative keeps sign', () => {
  assert.equal(formatPct(-5), '-5.0%');
});

test('formatPct: zero', () => {
  assert.equal(formatPct(0), '0.0%');
});

test('topStocksByAbsChange: sorted by absolute change', () => {
  const stocks = [
    { ticker: 'A', change: 5 },
    { ticker: 'B', change: 50 },
    { ticker: 'C', change: -60 },
    { ticker: 'D', change: 20 },
  ];
  const top = topStocksByAbsChange(stocks, 3);
  assert.equal(top.length, 3);
  assert.equal(top[0].ticker, 'C'); // |-60| highest
  assert.equal(top[1].ticker, 'B');
  assert.equal(top[2].ticker, 'D');
});

test('topStocksByAbsChange: filters invalid change', () => {
  const stocks = [
    { ticker: 'A', change: 10 },
    { ticker: 'B', change: null },
    { ticker: 'C' }, // no change field
  ];
  const top = topStocksByAbsChange(stocks);
  assert.equal(top.length, 1);
  assert.equal(top[0].ticker, 'A');
});

test('topStocksByAbsChange: empty/null input', () => {
  assert.deepEqual(topStocksByAbsChange([]), []);
  assert.deepEqual(topStocksByAbsChange(null), []);
});

test('AMOUNT_PRESETS: sane values', () => {
  assert.ok(AMOUNT_PRESETS.includes(1000));
  assert.ok(AMOUNT_PRESETS.length >= 3);
});
