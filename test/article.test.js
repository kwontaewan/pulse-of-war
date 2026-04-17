// node --test test/article.test.js
// Unit tests for pure logic in js/article.js.
// DOM-tied code (progress bar, TOC IntersectionObserver, lang notice
// rendering, 26-dot hydrate, back-to-top) runs in the browser and is
// covered by the E2E suite TODO'd in test/e2e/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSlug, fetchWithTimeout } from '../js/article.js';

test('toSlug: matches js/app.js slug format (globe deep link parity)', () => {
  // If these diverge, article data-card links lead to a conflict that
  // app.js never matches in handleDeepLink. Keep in sync.
  assert.equal(toSlug('Ukraine-Russia War'), 'ukraine-russia-war');
  assert.equal(toSlug('US-Iran Conflict 2026'), 'us-iran-conflict-2026');
  assert.equal(toSlug('  Gaza   War  '), 'gaza-war');
  assert.equal(toSlug('DR Congo (M23 / ADF)'), 'dr-congo-m23-adf');
});

test('toSlug: strips non-ascii (Korean name collapses to empty)', () => {
  // Matches the app.js regex that only keeps [a-z0-9-]. Korean falls
  // back to empty; caller should fall back to conflict.slug if empty.
  assert.equal(toSlug('한국전쟁'), '');
  assert.equal(toSlug('Korean 전쟁'), 'korean');
});

test('toSlug: handles already-slugged input idempotently', () => {
  assert.equal(toSlug('ukraine-russia-war'), 'ukraine-russia-war');
});

test('fetchWithTimeout: rejects on HTTP error status', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(
      () => fetchWithTimeout('/data/conflicts.json', 1000),
      /HTTP 503/
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('fetchWithTimeout: resolves with JSON on 200', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ hello: 'world' }) });
  try {
    const data = await fetchWithTimeout('/data/conflicts.json', 1000);
    assert.deepEqual(data, { hello: 'world' });
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('fetchWithTimeout: aborts after the given deadline', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = (url, { signal }) =>
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  try {
    const start = Date.now();
    await assert.rejects(() => fetchWithTimeout('/slow', 50));
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 200, `fetch took ${elapsed}ms, expected fast abort`);
  } finally {
    globalThis.fetch = origFetch;
  }
});
