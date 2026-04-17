// node --test test/exit-overlay.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupExitOverlay, showExitOverlay } from '../js/exit-overlay.js';

// Minimal DOM mock — node has no document/window.
function makeDoc() {
  const listeners = new Map();
  const body = {
    _children: [],
    appendChild(el) { this._children.push(el); },
  };
  const doc = {
    hidden: false,
    body,
    createElement(tag) {
      const el = {
        _tag: tag,
        className: '',
        innerHTML: '',
        _listeners: new Map(),
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
          contains(c) { return this._classes.has(c); },
        },
        addEventListener(ev, fn) { this._listeners.set(ev, fn); },
        querySelector(sel) {
          // Minimal — only used for .exit-overlay__share / close
          return {
            addEventListener(ev, fn) { el._listeners.set(`${sel}:${ev}`, fn); },
          };
        },
        remove() {},
      };
      return el;
    },
    addEventListener(ev, fn) {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev).add(fn);
    },
    removeEventListener(ev, fn) {
      if (listeners.has(ev)) listeners.get(ev).delete(fn);
    },
    _fire(ev) {
      const fns = listeners.get(ev);
      if (fns) Array.from(fns).forEach(fn => fn());
    },
    _listenerCount(ev) {
      return listeners.has(ev) ? listeners.get(ev).size : 0;
    },
  };
  return doc;
}

test('setupExitOverlay: attaches visibilitychange listener on init', () => {
  const doc = makeDoc();
  setupExitOverlay({ getSessionDeaths: () => 10, lang: 'en', doc });
  assert.equal(doc._listenerCount('visibilitychange'), 1);
});

test('setupExitOverlay: hidden → return fires showExitOverlay', () => {
  const doc = makeDoc();
  setupExitOverlay({ getSessionDeaths: () => 10, lang: 'en', doc });
  // Go hidden
  doc.hidden = true;
  doc._fire('visibilitychange');
  // After hidden, listener count increases (onReturn added)
  assert.equal(doc._listenerCount('visibilitychange'), 2);
  // Return — overlay should render
  doc.hidden = false;
  doc._fire('visibilitychange');
  assert.equal(doc.body._children.length, 1, 'overlay appended to body');
  assert.equal(doc.body._children[0]._tag, 'div');
  assert.equal(doc.body._children[0].className, 'exit-overlay');
});

test('setupExitOverlay: only fires once per page-load', () => {
  const doc = makeDoc();
  setupExitOverlay({ getSessionDeaths: () => 10, lang: 'en', doc });
  doc.hidden = true;
  doc._fire('visibilitychange');
  doc.hidden = false;
  doc._fire('visibilitychange');
  // Try second leave+return
  doc.hidden = true;
  doc._fire('visibilitychange');
  doc.hidden = false;
  doc._fire('visibilitychange');
  assert.equal(doc.body._children.length, 1, 'should still only have one overlay');
});

test('setupExitOverlay: cleanup fn removes listeners', () => {
  const doc = makeDoc();
  const cleanup = setupExitOverlay({ getSessionDeaths: () => 10, lang: 'en', doc });
  cleanup();
  assert.equal(doc._listenerCount('visibilitychange'), 0);
});

test('showExitOverlay: deaths < 1 → no overlay rendered', () => {
  const doc = makeDoc();
  const result = showExitOverlay({ getSessionDeaths: () => 0, lang: 'en', doc });
  assert.equal(result, null);
  assert.equal(doc.body._children.length, 0);
});

test('showExitOverlay: Korean message when lang=ko', () => {
  const doc = makeDoc();
  const overlay = showExitOverlay({ getSessionDeaths: () => 42, lang: 'ko', doc });
  assert.ok(overlay.innerHTML.includes('사망했습니다'));
  assert.ok(overlay.innerHTML.includes('42'));
});

test('showExitOverlay: English message when lang=en', () => {
  const doc = makeDoc();
  const overlay = showExitOverlay({ getSessionDeaths: () => 42, lang: 'en', doc });
  assert.ok(overlay.innerHTML.includes('people died'));
  assert.ok(overlay.innerHTML.includes('42'));
});

test('R2 regression: overlay markup structure matches pre-extraction (CSS selectors)', () => {
  // Main globe CSS (css/style.css) targets these classes. Extraction
  // must not rename them or the existing styling breaks.
  const doc = makeDoc();
  const overlay = showExitOverlay({ getSessionDeaths: () => 1, lang: 'en', doc });
  assert.equal(overlay.className, 'exit-overlay');
  assert.ok(overlay.innerHTML.includes('exit-overlay__content'));
  assert.ok(overlay.innerHTML.includes('exit-overlay__text'));
  assert.ok(overlay.innerHTML.includes('exit-overlay__sub'));
  assert.ok(overlay.innerHTML.includes('exit-overlay__actions'));
  assert.ok(overlay.innerHTML.includes('exit-overlay__share'));
  assert.ok(overlay.innerHTML.includes('exit-overlay__close'));
  assert.ok(overlay.innerHTML.includes('exit-overlay__number'));
});
