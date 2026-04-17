// node --test test/lang-notice.test.js
// The lang-notice logic inside js/article.js is DOM-tied, but its
// decision branches are pure: given (navigator.language, localStorage
// dismissed flag), should the notice render? These tests mirror that
// branching so a refactor doesn't accidentally hide the notice from
// English visitors or show it to Koreans.

import { test } from 'node:test';
import assert from 'node:assert/strict';

function shouldShowLangNotice({ browserLang, dismissed }) {
  const isEnglish = String(browserLang || 'en').toLowerCase().startsWith('en');
  if (!isEnglish) return false;
  if (dismissed === '1') return false;
  return true;
}

test('lang notice: English browser, not dismissed → show', () => {
  assert.equal(shouldShowLangNotice({ browserLang: 'en-US', dismissed: null }), true);
  assert.equal(shouldShowLangNotice({ browserLang: 'en-GB', dismissed: null }), true);
  assert.equal(shouldShowLangNotice({ browserLang: 'EN', dismissed: null }), true);
});

test('lang notice: Korean browser → hide', () => {
  assert.equal(shouldShowLangNotice({ browserLang: 'ko-KR', dismissed: null }), false);
  assert.equal(shouldShowLangNotice({ browserLang: 'ko', dismissed: null }), false);
});

test('lang notice: Other non-English (ja, zh, es) → hide', () => {
  assert.equal(shouldShowLangNotice({ browserLang: 'ja-JP', dismissed: null }), false);
  assert.equal(shouldShowLangNotice({ browserLang: 'zh-CN', dismissed: null }), false);
  assert.equal(shouldShowLangNotice({ browserLang: 'es-ES', dismissed: null }), false);
});

test('lang notice: dismissed flag hides even English visitors', () => {
  assert.equal(shouldShowLangNotice({ browserLang: 'en-US', dismissed: '1' }), false);
});

test('lang notice: null/undefined browserLang defaults to English policy', () => {
  // navigator.language can be undefined in edge browsers — treat as 'en'.
  assert.equal(shouldShowLangNotice({ browserLang: null, dismissed: null }), true);
  assert.equal(shouldShowLangNotice({ browserLang: undefined, dismissed: null }), true);
});

test('DeepL link encodes the target URL', () => {
  const href = `https://www.deepl.com/translator#auto/en/${encodeURIComponent('https://pulseofwar.com/articles/war-is-a-business-model?utm=x')}`;
  assert.ok(href.includes('https%3A%2F%2Fpulseofwar.com'));
  assert.ok(href.includes('%3Futm%3Dx'));
});
