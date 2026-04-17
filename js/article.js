// Pulse of War — Articles page orchestration.
// Keep this file slim (≤ 5KB gz budget, eng review P1). Reuses deaths.js
// (session math single source) and exit-overlay.js (shared moment).

import {
  calculateAnnualDeathRate,
  getSessionStartMs,
  getSessionDeaths,
  dailyDeaths as computeDailyDeaths,
  FALLBACK_ANNUAL,
  FALLBACK_DAILY,
} from './deaths.js';
import { setupExitOverlay } from './exit-overlay.js';
import { initI18n, t, getLang, setLang } from './i18n.js';

const CONFLICTS_URL = '/data/conflicts.json';
const DISMISS_KEY = 'pow-lang-notice-dismissed';

async function main() {
  const lang = await initI18n();
  document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
  applyI18n();

  setupLangToggle(lang);
  setupLangNotice(lang);
  setupProgressBar();
  setupSkipLink();

  // Seed counter with fallback so the emotional close renders even if
  // conflicts.json never resolves (eng review CQ1).
  let annual = FALLBACK_ANNUAL;
  let daily = FALLBACK_DAILY;
  const sessionStartMs = getSessionStartMs();
  startEndCtaCounter(() => annual, sessionStartMs);
  renderTodaySoFar(daily, sessionStartMs);
  renderSkeletonGrid();

  // Exit overlay — mirrors globe behavior via shared module.
  setupExitOverlay({
    getSessionDeaths: () => getSessionDeaths(annual, sessionStartMs),
    lang,
  });

  // Fetch conflicts — hydrate grid + replace fallback rate.
  try {
    const conflicts = await fetchWithTimeout(CONFLICTS_URL, 10000);
    if (Array.isArray(conflicts) && conflicts.length > 0) {
      annual = calculateAnnualDeathRate(conflicts);
      daily = computeDailyDeaths(annual);
      hydrateGrid(conflicts, lang);
      renderTodaySoFar(daily, sessionStartMs);
    } else {
      hideGridOnEmpty();
    }
  } catch (err) {
    console.warn('[article] conflicts fetch failed, using fallback', err);
    // Grid stays in skeleton state. Counter continues with fallback math.
  }
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val && val !== key) el.textContent = val;
  });
}

function setupLangToggle(startLang) {
  const btn = document.getElementById('js-lang-toggle');
  if (!btn) return;
  btn.textContent = startLang === 'ko' ? 'EN' : 'KO';
  btn.addEventListener('click', () => {
    setLang(startLang === 'ko' ? 'en' : 'ko');
  });
}

function setupLangNotice(lang) {
  const notice = document.querySelector('.article-lang-notice');
  if (!notice) return;
  const browserLang = (navigator.language || 'en').toLowerCase();
  const isEnglish = browserLang.startsWith('en');
  const dismissed = safeLocalGet(DISMISS_KEY) === '1';
  if (!isEnglish || dismissed) return;
  const deeplLink = notice.querySelector('[data-deepl]');
  if (deeplLink) {
    deeplLink.href = `https://www.deepl.com/translator#auto/en/${encodeURIComponent(location.href)}`;
  }
  notice.hidden = false;
  notice.querySelector('.article-lang-notice__close').addEventListener('click', () => {
    notice.hidden = true;
    safeLocalSet(DISMISS_KEY, '1');
  });
}

function setupProgressBar() {
  const bar = document.querySelector('.article-progress');
  if (!bar) return;
  let ticking = false;
  function update() {
    const h = document.documentElement;
    const total = h.scrollHeight - h.clientHeight;
    const pct = total > 0 ? Math.min(100, Math.max(0, (h.scrollTop / total) * 100)) : 0;
    bar.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

function setupSkipLink() {
  const link = document.querySelector('.skip-link');
  if (!link) return;
  link.addEventListener('click', (e) => {
    const tgt = document.querySelector(link.getAttribute('href'));
    if (tgt) {
      e.preventDefault();
      tgt.setAttribute('tabindex', '-1');
      tgt.focus();
      tgt.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

function startEndCtaCounter(getAnnual, startMs) {
  const el = document.getElementById('js-end-deaths');
  if (!el) return;
  function tick() {
    el.textContent = getSessionDeaths(getAnnual(), startMs).toLocaleString('en-US');
  }
  tick();
  setInterval(tick, 1000);
}

function renderTodaySoFar(dailyRate, sessionStartMs) {
  const el = document.getElementById('js-today-deaths');
  if (!el) return;
  // Elapsed seconds since local midnight → deaths so far today.
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const secSinceMidnight = (now.getTime() - midnight.getTime()) / 1000;
  const perSec = dailyRate / 86400;
  const today = Math.floor(perSec * secSinceMidnight);
  el.textContent = today.toLocaleString('en-US');
}

function renderSkeletonGrid() {
  const grid = document.getElementById('js-conflicts-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 26; i++) {
    const dot = document.createElement('button');
    dot.className = 'article-end-cta__dot article-end-cta__dot--dim';
    dot.setAttribute('role', 'listitem');
    dot.setAttribute('aria-label', 'Loading conflict');
    dot.disabled = true;
    grid.appendChild(dot);
  }
}

function hydrateGrid(conflicts, lang) {
  const grid = document.getElementById('js-conflicts-grid');
  if (!grid) return;
  grid.innerHTML = '';
  // Sort: featured first, then by casualties — match main globe's conflict list.
  const sorted = [...conflicts].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return (b.casualties || 0) - (a.casualties || 0);
  });
  sorted.slice(0, 26).forEach((c, i) => {
    const dot = document.createElement('a');
    dot.className = 'article-end-cta__dot article-end-cta__dot--loaded';
    dot.href = `/#conflict=${toSlug(c.name)}`;
    dot.setAttribute('role', 'listitem');
    const casualties = (c.casualties || 0).toLocaleString('en-US');
    dot.setAttribute('aria-label', `${c.name} — ${casualties} casualties — view on globe`);
    dot.title = `${c.name} · ${casualties}`;
    // Randomize pulse delay so 26 dots don't blink in unison.
    dot.style.animationDelay = `${(i * 0.11) % 2.4}s`;
    if (!c.casualties) {
      dot.classList.add('article-end-cta__dot--dim');
      dot.setAttribute('aria-label', `${c.name} — data pending`);
    }
    grid.appendChild(dot);
  });
}

function hideGridOnEmpty() {
  const grid = document.getElementById('js-conflicts-grid');
  if (grid) grid.hidden = true;
  const title = document.querySelector('.article-end-cta__title');
  if (title) title.hidden = true;
  const divider = document.querySelector('.article-end-cta__divider');
  if (divider) divider.hidden = true;
}

// Match js/app.js toSlug exactly so deep links resolve.
function toSlug(name) {
  return String(name).toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function safeLocalGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLocalSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

main().catch(err => console.error('[article] init failed', err));

// Exported for tests — node unit tests can import without a DOM.
export { toSlug, fetchWithTimeout };
