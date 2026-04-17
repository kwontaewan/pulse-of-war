// Pulse of War — main entry point

import { initMap, flyTo } from './map.js';
import { CasualtyCounter } from './counter.js';
import { DetailPanel } from './panel.js';
import { HeartbeatSound } from './sound.js';
import { initI18n, t, getLang, setLang } from './i18n.js';
import { StocksPanel } from './stocks.js';
import {
  calculateAnnualDeathRate,
  deathsPerSecond as computeDeathsPerSecond,
  dailyDeaths as computeDailyDeaths,
  getSessionStartMs,
  getSessionDeaths as computeSessionDeaths,
} from './deaths.js';
import { setupExitOverlay } from './exit-overlay.js';

async function main() {
  const loadingEl = document.querySelector('.loading');
  const loadingFill = document.querySelector('.loading__fill');

  // Step 1: Load i18n + data in parallel
  loadingFill.style.width = '20%';

  const [lang, conflicts, stocksData] = await Promise.all([
    initI18n(),
    fetch('./data/conflicts.json').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    fetch('./data/stocks.json').then(r => r.ok ? r.json() : null).catch(() => null)
  ]);

  document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';

  loadingFill.style.width = '50%';

  // Step 2: Init map
  const container = document.getElementById('map-container');
  const panel = new DetailPanel(document.querySelector('.panel'));
  const sound = new HeartbeatSound();

  const map = initMap(container, conflicts, (conflict) => {
    panel.open(conflict, lang);
    stopTour();
  });

  loadingFill.style.width = '80%';

  // Step 3: Aggregate stats
  const totalCasualties = conflicts.reduce((sum, c) => sum + c.casualties, 0);
  const totalRefugees = conflicts.reduce((sum, c) => sum + c.refugees, 0);
  const conflictCount = conflicts.length;

  // Annual conflict-death rate — extracted to js/deaths.js so the article
  // page and globe produce byte-identical counter values (eng review A3).
  const annualDeathRate = calculateAnnualDeathRate(conflicts);
  const dailyDeaths = computeDailyDeaths(annualDeathRate);

  // Step 4: Counter
  const counterEl = document.querySelector('.counter__number');
  const counter = new CasualtyCounter(counterEl, totalCasualties);

  // Step 4b: Session death counter — throttled to 1/sec. Timing moved from
  // performance.now() to Date.now() via sessionStorage so the counter
  // survives cross-page navigation (globe ↔ article) and reflects deaths
  // that happened while the tab was backgrounded (OV1 accepted).
  const sessionDeathEl = document.getElementById('js-session-deaths');
  const sessionStartMs = getSessionStartMs();
  function updateSessionDeaths() {
    setInterval(() => {
      sessionDeathEl.textContent =
        computeSessionDeaths(annualDeathRate, sessionStartMs).toLocaleString('en-US');
    }, 1000);
  }

  // Step 5: Header stats
  document.querySelector('[data-conflict-count]').textContent = conflictCount;
  const uniqueCountries = new Set();
  conflicts.forEach(c => c.parties.forEach(p => uniqueCountries.add(p)));
  document.querySelector('[data-country-count]').textContent = uniqueCountries.size;

  // Step 6: Stats bar
  document.querySelector('[data-stat-refugees]').textContent = formatNumber(totalRefugees);
  document.querySelector('[data-stat-daily]').textContent = dailyDeaths.toLocaleString('en-US');
  document.querySelector('[data-stat-countries]').textContent = uniqueCountries.size;

  // Step 7: Sidebar (conflicts + stocks tabs)
  const sidebar = document.querySelector('.sidebar');
  // Sort: featured first, then by casualties
  const sorted = [...conflicts].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return b.casualties - a.casualties;
  });

  // Populate conflict list
  const listContainer = document.querySelector('.conflict-list__items');
  sorted.forEach(c => {
    const isFeatured = c.featured === true;
    const isHot = c.economicImpact != null;
    const item = document.createElement('div');
    item.className = 'conflict-list__item' + (isFeatured ? ' conflict-list__item--featured' : '') + (isHot ? ' conflict-list__item--hot' : '');
    const badge = isFeatured ? `<span class="conflict-list__badge conflict-list__badge--featured">⚠ HOT</span>` : isHot ? `<span class="conflict-list__badge">📈</span>` : '';
    item.innerHTML = `
      <div class="conflict-list__item-name">${badge}${escapeHtml(c.name)}</div>
      <div class="conflict-list__item-meta">
        <span>${c.casualties.toLocaleString('en-US')}</span> ${t('list.casualties')} · ${t('list.since')} ${c.startYear}
        ${c.economicImpact ? `· <span class="conflict-list__item-cost">${c.economicImpact.warCost}</span>` : ''}
      </div>
    `;
    item.addEventListener('click', () => {
      flyTo(map, c);
      panel.open(c, lang);
      closeSidebar();
      stopTour();
    });
    listContainer.appendChild(item);
  });

  // Init stocks panel
  const stocksPanel = new StocksPanel(document.querySelector('.stocks-container'));
  if (stocksData) stocksPanel.init(stocksData, lang);

  // Sidebar toggle buttons
  const toggleConflictsBtn = document.getElementById('js-toggle-conflicts');
  const toggleStocksBtn = document.getElementById('js-toggle-stocks');

  toggleConflictsBtn.addEventListener('click', () => openSidebar('conflicts'));
  toggleStocksBtn.addEventListener('click', () => openSidebar('stocks'));
  document.querySelector('.sidebar__close').addEventListener('click', closeSidebar);

  // Tab switching inside sidebar
  sidebar.querySelectorAll('.sidebar__tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  function openSidebar(tab) {
    sidebar.classList.add('sidebar--open');
    switchTab(tab || 'conflicts');
  }

  function closeSidebar() {
    sidebar.classList.remove('sidebar--open');
  }

  function switchTab(tabId) {
    sidebar.querySelectorAll('.sidebar__tab').forEach(t =>
      t.classList.toggle('sidebar__tab--active', t.dataset.tab === tabId)
    );
    sidebar.querySelectorAll('.sidebar__panel').forEach(p =>
      p.classList.toggle('sidebar__panel--active', p.dataset.panel === tabId)
    );
  }

  // Step 8: Language toggle
  const langBtn = document.getElementById('js-lang-toggle');
  langBtn.textContent = lang === 'ko' ? 'EN' : 'KO';
  langBtn.addEventListener('click', () => {
    setLang(lang === 'ko' ? 'en' : 'ko');
  });

  // Step 9: Sound
  const soundBtn = document.querySelector('.sound-toggle');
  soundBtn.addEventListener('click', () => {
    const isPlaying = sound.toggle();
    soundBtn.classList.toggle('sound-toggle--active', isPlaying);
    soundBtn.textContent = isPlaying ? t('btn.soundOn') : t('btn.soundOff');
  });

  // Step 10: Share (with session death count)
  function getSessionDeaths() {
    return computeSessionDeaths(annualDeathRate, sessionStartMs);
  }

  document.querySelector('[data-share="twitter"]').addEventListener('click', () => {
    const sessionD = getSessionDeaths();
    const extra = lang === 'ko'
      ? `\n\n이 페이지를 보는 동안 ${sessionD}명이 추가로 사망했습니다.`
      : `\n\n${sessionD} more people died while I was reading this page.`;
    const text = encodeURIComponent(
      t('share.text', {
        count: conflictCount,
        refugees: formatNumber(totalRefugees),
        daily: dailyDeaths.toLocaleString('en-US')
      }) + extra
    );
    const url = encodeURIComponent(window.location.origin + window.location.pathname);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  });

  document.querySelector('[data-share="copy"]').addEventListener('click', (e) => {
    try {
      navigator.clipboard.writeText(window.location.href);
      e.target.textContent = t('btn.copied');
    } catch {
      e.target.textContent = t('btn.copyFailed');
    }
    setTimeout(() => { e.target.textContent = t('btn.copyLink'); }, 2000);
  });

  // Step 11: Auto focus tour (toggleable, cycles ALL conflicts)
  const tourTooltip = document.querySelector('.tour-tooltip');
  const tourBtn = document.querySelector('.autofocus-toggle');
  let tourIndex = 0;
  let tourTimer = null;
  let tourActive = false; // starts off, user can toggle

  function runTour() {
    if (!tourActive) return;
    const c = sorted[tourIndex % sorted.length];
    flyTo(map, c);

    const nameText = c.name;
    const econTag = c.economicImpact
      ? (lang === 'ko' ? ` · 전쟁비용 ${c.economicImpact.warCost}` : ` · War cost ${c.economicImpact.warCost}`)
      : '';
    tourTooltip.querySelector('.tour-tooltip__name').textContent = nameText;
    tourTooltip.querySelector('.tour-tooltip__fact').textContent =
      `${c.casualties.toLocaleString('en-US')} ${t('tour.casualties')} · ${c.refugees.toLocaleString('en-US')} ${t('tour.displaced')}${econTag}`;
    tourTooltip.classList.add('tour-tooltip--visible');

    tourIndex++;
    tourTimer = setTimeout(() => {
      tourTooltip.classList.remove('tour-tooltip--visible');
      setTimeout(() => runTour(), 500);
    }, 5000);
  }

  function stopTour() {
    tourActive = false;
    clearTimeout(tourTimer);
    tourTooltip.classList.remove('tour-tooltip--visible');
    if (tourBtn) {
      tourBtn.classList.remove('autofocus-toggle--active');
      tourBtn.textContent = lang === 'ko' ? '▶ 자동 포커스' : '▶ AUTO FOCUS';
    }
  }

  function startTour() {
    tourActive = true;
    if (tourBtn) {
      tourBtn.classList.add('autofocus-toggle--active');
      tourBtn.textContent = lang === 'ko' ? '■ 포커스 중지' : '■ STOP FOCUS';
    }
    runTour();
  }

  if (tourBtn) {
    tourBtn.addEventListener('click', () => {
      if (tourActive) stopTour();
      else startTour();
    });
  }

  // Stop tour when user interacts with map
  container.addEventListener('mousedown', () => { if (tourActive) stopTour(); }, { once: false });
  container.addEventListener('touchstart', () => { if (tourActive) stopTour(); }, { once: false });

  // Step 12: Deep linking — unified slug function
  function toSlug(name) {
    return name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleDeepLink() {
    const hash = location.hash;
    if (hash && hash.startsWith('#conflict=')) {
      const slug = decodeURIComponent(hash.replace('#conflict=', '')).toLowerCase();
      const match = conflicts.find(c => toSlug(c.name) === slug || c.name.toLowerCase().includes(slug));
      if (match) {
        stopTour();
        flyTo(map, match);
        setTimeout(() => panel.open(match, lang), 800);
      }
    }
  }

  // Step 13: Update hash when panel opens
  const origPanelOpen = panel.open.bind(panel);
  panel.open = function(conflict, lng) {
    history.replaceState(null, '', `#conflict=${toSlug(conflict.name)}`);
    origPanelOpen(conflict, lng);
  };

  // Step 14: Real-time comparison counter ("X deaths = ...")
  const comparisonEl = document.querySelector('.live-comparison');
  const comparisons = lang === 'ko'
    ? [
        [1, '1명'], [10, '축구팀 1팀'], [50, '버스 1대 승객'],
        [100, '비행기 1대'], [250, '보잉 747 전원'], [500, '대형 학교 전교생'],
        [1000, '9/11 사망자의 1/3'], [3000, '9/11 사망자 수']
      ]
    : [
        [1, '1 person'], [10, 'a soccer team'], [50, 'a full bus'],
        [100, 'a plane crash'], [250, 'a Boeing 747'], [500, 'a large school'],
        [1000, '1/3 of 9/11 deaths'], [3000, 'all 9/11 deaths']
      ];

  let lastComparison = '';
  function updateComparison() {
    setInterval(() => {
      const deaths = getSessionDeaths();
      let label = '';
      for (let i = comparisons.length - 1; i >= 0; i--) {
        if (deaths >= comparisons[i][0]) { label = comparisons[i][1]; break; }
      }
      if (label && label !== lastComparison && comparisonEl) {
        lastComparison = label;
        comparisonEl.textContent = `= ${label}`;
        comparisonEl.classList.add('live-comparison--flash');
        setTimeout(() => comparisonEl.classList.remove('live-comparison--flash'), 1000);
      }
    }, 2000);
  }

  // Step 15: Exit overlay — show stats when user leaves and returns.
  // Extracted to js/exit-overlay.js so /articles pages can reuse the
  // same moment. The closure here owns getSessionDeaths and lang.
  setupExitOverlay({ getSessionDeaths, lang });

  // Done — start everything. Auto-tour is OFF by default; user toggles with
  // the "▶ AUTO FOCUS" button. Previous behavior (auto-start after 3s) was
  // disorienting for first-time visitors — the camera panned before they
  // could orient themselves.
  loadingFill.style.width = '100%';
  setTimeout(() => {
    loadingEl.classList.add('loading--hidden');
    setTimeout(() => {
      loadingEl.remove();
      if (!localStorage.getItem('pow-visited')) {
        showOnboardingHint();
        localStorage.setItem('pow-visited', '1');
      }
    }, 600);
    counter.start();
    updateSessionDeaths();
    updateComparison();

    if (location.hash && location.hash.startsWith('#conflict=')) {
      handleDeepLink();
    }

    // Handle address-bar hash changes without full reload
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith('#conflict=')) handleDeepLink();
    });
  }, 500);
}

function showOnboardingHint() {
  const hint = document.createElement('div');
  hint.className = 'onboarding-hint';
  hint.innerHTML = `
    <div class="onboarding-hint__icon">👆</div>
    <div class="onboarding-hint__text">${t('onboarding')}</div>
  `;
  document.body.appendChild(hint);
  setTimeout(() => hint.classList.add('onboarding-hint--visible'), 100);
  setTimeout(() => {
    hint.classList.remove('onboarding-hint--visible');
    setTimeout(() => hint.remove(), 500);
  }, 5000);

  // Dismiss on any click
  document.addEventListener('click', () => {
    hint.classList.remove('onboarding-hint--visible');
    setTimeout(() => hint.remove(), 500);
  }, { once: true });
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toLocaleString('en-US');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

main().catch(err => {
  console.error('App failed:', err);
  const loading = document.querySelector('.loading');
  if (loading) loading.querySelector('.loading__text').textContent = 'Something went wrong';
});
