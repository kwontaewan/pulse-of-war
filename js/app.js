// Pulse of War — main entry point

import { initMap, flyTo } from './map.js';
import { CasualtyCounter } from './counter.js';
import { DetailPanel } from './panel.js';
import { HeartbeatSound } from './sound.js';
import { initI18n, t, getLang, setLang } from './i18n.js';
import { StocksPanel } from './stocks.js';

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

  // Annual conflict-death rate — sum of each conflict's own per-year rate
  // (c.casualties / years_active). Previous buggy math divided the cumulative
  // multi-year totalCasualties by a single year, overstating the rate ~5x.
  const currentYear = new Date().getFullYear();
  const annualDeathRate = conflicts.reduce((sum, c) => {
    const yearsActive = Math.max(1, currentYear - (c.startYear || currentYear));
    return sum + c.casualties / yearsActive;
  }, 0);
  const dailyDeaths = Math.round(annualDeathRate / 365);

  // Step 4: Counter
  const counterEl = document.querySelector('.counter__number');
  const counter = new CasualtyCounter(counterEl, totalCasualties);

  // Step 4b: Session death counter — throttled to 1/sec
  const sessionDeathEl = document.getElementById('js-session-deaths');
  const deathsPerSecond = annualDeathRate / (365.25 * 24 * 3600);
  const sessionStart = performance.now();
  function updateSessionDeaths() {
    setInterval(() => {
      const elapsed = (performance.now() - sessionStart) / 1000;
      sessionDeathEl.textContent = Math.floor(deathsPerSecond * elapsed).toLocaleString('en-US');
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
    return Math.floor(deathsPerSecond * ((performance.now() - sessionStart) / 1000));
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
  const dramaEl = document.getElementById('js-live-drama');
  // Rotating conflict highlight (subset with economicImpact only — those are
  // the ones with narrative weight). Reuse sorted list from sidebar step.
  const spotlightPool = sorted.filter(c => c.economicImpact && c.casualties > 0);
  let dramaTick = 0;

  // Pre-compute global interval between deaths, e.g. "1 person every ~2 min".
  const secPerDeath = deathsPerSecond > 0 ? Math.round(1 / deathsPerSecond) : 0;

  function renderDramaLine() {
    if (!dramaEl) return;
    // Alternate between (a) rolling prediction and (b) spotlighted conflict.
    const phase = dramaTick % 2;
    if (phase === 0 && secPerDeath > 0) {
      const interval = secPerDeath < 60
        ? (lang === 'ko' ? `${secPerDeath}초` : `${secPerDeath}s`)
        : (lang === 'ko' ? `약 ${Math.round(secPerDeath / 60)}분` : `about ${Math.round(secPerDeath / 60)} min`);
      dramaEl.textContent = lang === 'ko'
        ? `⏱ ${interval}마다 전쟁으로 1명 사망`
        : `⏱ 1 death every ${interval} in active conflicts`;
    } else if (spotlightPool.length > 0) {
      const c = spotlightPool[dramaTick % spotlightPool.length];
      const name = (lang === 'ko' && c.name_ko) ? c.name_ko : c.name;
      const cas = c.casualties.toLocaleString('en-US');
      dramaEl.textContent = lang === 'ko'
        ? `🎯 ${name} · 누적 사망자 ${cas}`
        : `🎯 ${name} · ${cas} total dead`;
    }
    dramaEl.classList.remove('live-drama--flash');
    // force reflow so animation restarts
    void dramaEl.offsetWidth;
    dramaEl.classList.add('live-drama--flash');
    dramaTick += 1;
  }
  // First frame immediately so the UI isn't empty.
  renderDramaLine();

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
    // Drama line rotates every 7s (separate cadence, not disruptive).
    setInterval(renderDramaLine, 7000);
  }

  // Step 15: Exit overlay — show stats when user leaves
  let exitShown = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !exitShown) {
      exitShown = true;
      // When they come back, show the overlay
      const onReturn = () => {
        document.removeEventListener('visibilitychange', onReturn);
        showExitOverlay();
      };
      document.addEventListener('visibilitychange', onReturn);
    }
  });

  function showExitOverlay() {
    const deaths = getSessionDeaths();
    if (deaths < 1) return;
    const overlay = document.createElement('div');
    overlay.className = 'exit-overlay';
    const msg = lang === 'ko'
      ? `이 페이지를 보는 동안<br><span class="exit-overlay__number">${deaths.toLocaleString('en-US')}</span><br>명이 전쟁으로 사망했습니다`
      : `While you were reading this page<br><span class="exit-overlay__number">${deaths.toLocaleString('en-US')}</span><br>people died in armed conflicts`;
    const subMsg = lang === 'ko' ? '이 숫자는 멈추지 않습니다.' : 'This number never stops.';
    overlay.innerHTML = `
      <div class="exit-overlay__content">
        <div class="exit-overlay__text">${msg}</div>
        <div class="exit-overlay__sub">${subMsg}</div>
        <div class="exit-overlay__actions">
          <button class="exit-overlay__share">${lang === 'ko' ? 'X에 공유' : 'SHARE ON X'}</button>
          <button class="exit-overlay__close">${lang === 'ko' ? '닫기' : 'CLOSE'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('exit-overlay--visible'), 50);

    overlay.querySelector('.exit-overlay__close').addEventListener('click', () => {
      overlay.classList.remove('exit-overlay--visible');
      setTimeout(() => overlay.remove(), 500);
    });

    overlay.querySelector('.exit-overlay__share').addEventListener('click', () => {
      const text = encodeURIComponent(
        (lang === 'ko'
          ? `이 페이지를 보는 동안 ${deaths}명이 전쟁으로 사망했습니다.\n이 숫자는 멈추지 않습니다.`
          : `${deaths} people died in armed conflicts while I was reading this page.\nThis number never stops.`)
      );
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(location.origin)}`, '_blank');
    });
  }

  // Done — start everything
  let autoStartTimer = null;
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
    } else {
      autoStartTimer = setTimeout(() => {
        if (!tourActive) startTour();
      }, 3000);
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
