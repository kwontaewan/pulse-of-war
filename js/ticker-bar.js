// Top fixed ticker bar — market clock + TradingView ticker tape + session deaths.
//
// Layout:
//   [🕒 NYSE opens in 3h 24m]   [💀 1,247]   [TV widget scrolling tickers…]
//
// Desktop only — hidden on <768px via CSS media query. Mobile shows a
// condensed market-clock line inside the header instead (wired by app.js).
//
// Widget load strategy:
//   1. requestIdleCallback (polyfilled for Safari < 16.4) injects the TV
//      script after first paint so LCP isn't blocked.
//   2. 5-second timeout watchdog. If the TV iframe hasn't rendered, swap to
//      a static fallback row using last-known values from data/stocks.json.

import { userTimezone } from './timezone.js';
import {
  marketStatus,
  nextOpenAt,
  formatCountdown,
  checkHolidaysFreshness,
} from './market-clock.js';
import { t, getLang } from './i18n.js';

const TV_SCRIPT_URL = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
const TV_LOAD_TIMEOUT_MS = 5000;

const ric = typeof window !== 'undefined' && window.requestIdleCallback
  ? window.requestIdleCallback
  : (cb) => setTimeout(cb, 0);

let nyseHolidays = null;
let krxHolidays = null;
let tvSymbols = null;

export async function initTickerBar() {
  const bar = document.querySelector('.ticker-bar');
  if (!bar) return;

  // Load data in parallel.
  [nyseHolidays, krxHolidays, tvSymbols] = await Promise.all([
    fetchJSON('./data/us-market-holidays.json'),
    fetchJSON('./data/kr-market-holidays.json'),
    fetchJSON('./data/tv-symbols.json'),
  ]).catch(err => {
    console.error('[ticker-bar] data load failed:', err);
    return [null, null, null];
  });

  if (nyseHolidays) checkHolidaysFreshness(nyseHolidays);
  if (krxHolidays) checkHolidaysFreshness(krxHolidays);

  // Markets clock — tick every 30s.
  renderMarketClock(bar);
  renderMobileClock();
  setInterval(() => {
    renderMarketClock(bar);
    renderMobileClock();
  }, 30 * 1000);

  // Deaths counter — small duplicate of header counter, same source.
  // app.js already updates `#js-session-deaths`, we just mirror here.
  renderDeathsMirror(bar);

  // TV widget — inject when idle, fall back if it doesn't show in time.
  ric(() => injectTradingViewWidget(bar), { timeout: 2000 });
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

function renderMarketClock(bar) {
  if (!nyseHolidays || !krxHolidays) return;
  const el = bar.querySelector('.ticker-bar__clock');
  if (!el) return;
  const lang = getLang();
  const now = new Date();

  const nyse = marketStatus(now, nyseHolidays);
  const krx = marketStatus(now, krxHolidays);

  const fmt = (market, status, holidays) => {
    const label = market === 'NYSE' ? 'NYSE' : 'KOSDAQ';
    if (status.state === 'OPEN') {
      const closeMs = closesInMs(now, status, holidays);
      return lang === 'ko'
        ? `🟢 ${label} ${formatCountdown(closeMs, 'ko')} 후 마감`
        : `🟢 ${label} closes in ${formatCountdown(closeMs, 'en')}`;
    }
    const nextOpen = nextOpenAt(now, holidays);
    if (!nextOpen) return `${label} — schedule unknown`;
    const openMs = nextOpen.getTime() - now.getTime();
    return lang === 'ko'
      ? `⚪ ${label} ${formatCountdown(openMs, 'ko')} 후 개장`
      : `⚪ ${label} opens in ${formatCountdown(openMs, 'en')}`;
  };

  el.innerHTML = `
    <span class="ticker-bar__market">${fmt('NYSE', nyse, nyseHolidays)}</span>
    <span class="ticker-bar__sep">·</span>
    <span class="ticker-bar__market">${fmt('KRX', krx, krxHolidays)}</span>
  `;
}

// Compute ms until today's close given an OPEN status. Rough but fine — the
// clock re-renders every 30s so edge slop of a minute around close is OK.
function closesInMs(now, status, holidays) {
  const [h, m] = status.closeAt.split(':').map(Number);
  const tz = holidays.timezone;
  // Build a Date representing closeAt today in the local timezone using the
  // same resolve technique as market-clock internally. We re-derive the day
  // from status.localDate so DST edges stay honest.
  const probe = new Date(`${status.localDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  // Nudge the probe so formatted local time matches — pragmatic 3-pass loop.
  for (let i = 0; i < 3; i++) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(probe).map(p => [p.type, p.value]));
    const localH = parts.hour === '24' ? 0 : Number(parts.hour);
    const localM = Number(parts.minute);
    const delta = (h - localH) * 60 + (m - localM);
    if (delta === 0) break;
    probe.setTime(probe.getTime() + delta * 60 * 1000);
  }
  return probe.getTime() - now.getTime();
}

// Condensed market clock rendered into the existing header on mobile
// (<768px). The desktop ticker bar is display:none there — this keeps the
// "market opens in X" hook visible without fighting for vertical space.
function renderMobileClock() {
  const el = document.getElementById('js-mobile-clock');
  if (!el || !nyseHolidays || !krxHolidays) return;
  const lang = getLang();
  const now = new Date();

  const nyse = marketStatus(now, nyseHolidays);
  const krx = marketStatus(now, krxHolidays);

  // Show whichever market is open, otherwise whichever opens soonest.
  let primary;
  if (krx.state === 'OPEN') {
    primary = lang === 'ko' ? '🟢 KOSDAQ 개장 중' : '🟢 KOSDAQ open';
  } else if (nyse.state === 'OPEN') {
    primary = lang === 'ko' ? '🟢 NYSE 개장 중' : '🟢 NYSE open';
  } else {
    const krxNext = nextOpenAt(now, krxHolidays);
    const nyseNext = nextOpenAt(now, nyseHolidays);
    const krxMs = krxNext ? krxNext.getTime() - now.getTime() : Infinity;
    const nyseMs = nyseNext ? nyseNext.getTime() - now.getTime() : Infinity;
    if (krxMs <= nyseMs && krxNext) {
      primary = lang === 'ko'
        ? `⚪ KOSDAQ ${formatCountdown(krxMs, 'ko')} 후 개장`
        : `⚪ KOSDAQ opens in ${formatCountdown(krxMs, 'en')}`;
    } else if (nyseNext) {
      primary = lang === 'ko'
        ? `⚪ NYSE ${formatCountdown(nyseMs, 'ko')} 후 개장`
        : `⚪ NYSE opens in ${formatCountdown(nyseMs, 'en')}`;
    } else {
      primary = '';
    }
  }
  el.textContent = primary;
}

function renderDeathsMirror(bar) {
  const el = bar.querySelector('.ticker-bar__deaths');
  if (!el) return;
  const src = document.getElementById('js-session-deaths');
  if (!src) return;

  const update = () => {
    el.textContent = `💀 ${src.textContent}`;
  };
  update();
  // Observe changes to the source counter so we don't have to duplicate math.
  new MutationObserver(update).observe(src, { childList: true, characterData: true, subtree: true });
}

function injectTradingViewWidget(bar) {
  const host = bar.querySelector('.ticker-bar__tv');
  if (!host || !tvSymbols?.ticker_tape) {
    renderTVFallback(host);
    return;
  }

  const container = document.createElement('div');
  container.className = 'tradingview-widget-container';
  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container__widget';
  container.appendChild(widget);
  host.appendChild(container);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = TV_SCRIPT_URL;
  script.innerHTML = JSON.stringify({
    symbols: tvSymbols.ticker_tape,
    colorTheme: 'dark',
    isTransparent: true,
    displayMode: 'adaptive',
    locale: getLang() === 'ko' ? 'kr' : 'en',
  });
  container.appendChild(script);

  // Watchdog: if no iframe shows up in 5s, fall back.
  setTimeout(() => {
    if (!container.querySelector('iframe')) {
      console.warn('[ticker-bar] TV widget did not render, using fallback');
      host.innerHTML = '';
      renderTVFallback(host);
    }
  }, TV_LOAD_TIMEOUT_MS);
}

// Static fallback when TV CDN is blocked (adblocker, network, timeout).
// Reads stocks.json and shows a rotating subset of last-known values.
async function renderTVFallback(host) {
  if (!host) return;
  try {
    const stocks = await fetchJSON('./data/stocks.json');
    const flat = [];
    for (const sector of stocks.sectors || []) {
      for (const s of sector.stocks || []) {
        if (s.ticker && typeof s.dod === 'number') {
          flat.push({ t: s.ticker, c: s.dod });
        }
      }
    }
    const top = flat.sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 6);
    host.innerHTML = top.map(s => {
      const cls = s.c >= 0 ? 'is-up' : 'is-down';
      const sign = s.c >= 0 ? '+' : '';
      return `<span class="ticker-bar__tv-item ${cls}">$${s.t} ${sign}${s.c}%</span>`;
    }).join(' · ');
  } catch {
    host.innerHTML = '<span class="ticker-bar__tv-fallback">market data offline</span>';
  }
}

// Run once DOM ready.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTickerBar);
  } else {
    initTickerBar();
  }
}
