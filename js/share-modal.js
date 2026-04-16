// Share modal — opens on "Share P&L" button click.
// Controls: ticker select, amount slider, live preview canvas,
// actions: Download PNG, Copy image, Share on X.

import { renderCard, canvasToBlob } from './card-generator.js';
import { topStocksByAbsChange, formatCurrency, AMOUNT_PRESETS } from './card-math.js';
import { t, getLang } from './i18n.js';

let modalEl = null;
let canvasEl = null;
let currentConflict = null;
let currentStock = null;
let currentAmount = 1000;
let renderQueued = false;

export function openShareModal(conflict) {
  if (!conflict?.economicImpact?.stocks?.length) {
    console.warn('No stocks data for conflict:', conflict?.name);
    return;
  }
  currentConflict = conflict;
  const topStocks = topStocksByAbsChange(conflict.economicImpact.stocks, 6);
  currentStock = topStocks[0];
  currentAmount = 1000;

  ensureModal();
  populateStockButtons(topStocks);
  updateAmountLabel();
  queueRender();
  modalEl.classList.add('share-modal--open');
  document.body.style.overflow = 'hidden';
}

export function closeShareModal() {
  if (!modalEl) return;
  modalEl.classList.remove('share-modal--open');
  document.body.style.overflow = '';
}

function ensureModal() {
  if (modalEl) return;
  modalEl = document.createElement('div');
  modalEl.className = 'share-modal';
  modalEl.innerHTML = `
    <div class="share-modal__backdrop" data-action="close"></div>
    <div class="share-modal__panel" role="dialog" aria-modal="true">
      <button class="share-modal__close" data-action="close" aria-label="Close">&times;</button>
      <div class="share-modal__title" data-i18n="card.modalTitle">If you bought…</div>

      <div class="share-modal__canvas-wrap">
        <canvas class="share-modal__canvas"></canvas>
      </div>

      <div class="share-modal__controls">
        <div class="share-modal__ctrl">
          <label class="share-modal__label" data-i18n="card.ticker">Ticker</label>
          <div class="share-modal__stocks"></div>
        </div>
        <div class="share-modal__ctrl">
          <label class="share-modal__label">
            <span data-i18n="card.amount">Amount</span>
            <span class="share-modal__amount-value"></span>
          </label>
          <div class="share-modal__amount-buttons">
            ${AMOUNT_PRESETS.map(a => `<button class="share-modal__preset" data-amount="${a}">${formatCurrency(a)}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="share-modal__actions">
        <button class="share-modal__action share-modal__action--primary" data-action="download" data-i18n="card.download">Download PNG</button>
        <button class="share-modal__action" data-action="copy" data-i18n="card.copy">Copy image</button>
        <button class="share-modal__action" data-action="tweet" data-i18n="card.tweet">Share on X</button>
        <button class="share-modal__action" data-action="copyReddit" data-i18n="card.copyReddit">Copy Reddit text</button>
      </div>

      <div class="share-modal__status" aria-live="polite"></div>
    </div>
  `;
  document.body.appendChild(modalEl);
  canvasEl = modalEl.querySelector('.share-modal__canvas');

  // Apply i18n to static labels
  modalEl.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (val && val !== key) el.textContent = val;
  });

  // Hide Copy image if clipboard image API not supported
  if (!supportsClipboardImage()) {
    const copyBtn = modalEl.querySelector('[data-action="copy"]');
    if (copyBtn) copyBtn.style.display = 'none';
  }

  modalEl.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
}

function supportsClipboardImage() {
  return typeof ClipboardItem !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === 'function';
}

function populateStockButtons(stocks) {
  const wrap = modalEl.querySelector('.share-modal__stocks');
  wrap.innerHTML = stocks.map((s, i) => `
    <button class="share-modal__stock ${i === 0 ? 'share-modal__stock--active' : ''}" data-ticker="${escapeAttr(s.ticker)}">
      <span class="share-modal__stock-ticker">$${escapeHtml(s.ticker)}</span>
      <span class="share-modal__stock-change ${s.change >= 0 ? 'is-up' : 'is-down'}">${s.change >= 0 ? '+' : ''}${s.change}%</span>
    </button>
  `).join('');
}

function updateAmountLabel() {
  const el = modalEl.querySelector('.share-modal__amount-value');
  if (el) el.textContent = formatCurrency(currentAmount);
  modalEl.querySelectorAll('.share-modal__preset').forEach(btn => {
    btn.classList.toggle('share-modal__preset--active', Number(btn.dataset.amount) === currentAmount);
  });
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    try {
      renderCard(canvasEl, {
        conflict: currentConflict,
        stock: currentStock,
        amount: currentAmount,
        lang: getLang(),
      });
    } catch (err) {
      console.error('Card render failed:', err);
      setStatus(t('card.renderError') || 'Render failed.');
    }
  });
}

function handleClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'close') return closeShareModal();
    if (action === 'download') return doDownload();
    if (action === 'copy') return doCopyImage();
    if (action === 'tweet') return doTweet();
    if (action === 'copyReddit') return doCopyReddit();
  }

  const stockBtn = e.target.closest('[data-ticker]');
  if (stockBtn) {
    const ticker = stockBtn.dataset.ticker;
    const stock = currentConflict.economicImpact.stocks.find(s => s.ticker === ticker);
    if (stock) {
      currentStock = stock;
      modalEl.querySelectorAll('.share-modal__stock').forEach(b =>
        b.classList.toggle('share-modal__stock--active', b === stockBtn));
      queueRender();
    }
    return;
  }

  const preset = e.target.closest('[data-amount]');
  if (preset) {
    currentAmount = Number(preset.dataset.amount);
    updateAmountLabel();
    queueRender();
  }
}

function handleKeydown(e) {
  if (modalEl?.classList.contains('share-modal--open') && e.key === 'Escape') {
    closeShareModal();
  }
}

async function doDownload() {
  try {
    const blob = await canvasToBlob(canvasEl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-of-war-${currentStock.ticker}-${toSlug(currentConflict.name)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus(t('card.downloaded') || 'Downloaded.');
  } catch (err) {
    console.error('Download failed:', err);
    setStatus(t('card.downloadError') || 'Download failed.');
  }
}

async function doCopyImage() {
  try {
    const blob = await canvasToBlob(canvasEl);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    setStatus(t('card.copied') || 'Image copied to clipboard.');
  } catch (err) {
    console.error('Clipboard write failed:', err);
    setStatus(t('card.copyError') || 'Copy failed. Try Download instead.');
  }
}

function doTweet() {
  const L = getLang();
  const gainStr = `${currentStock.change >= 0 ? '+' : ''}${currentStock.change}%`;
  const text = L === 'ko'
    ? `${currentConflict.name_ko || currentConflict.name} 시작 시점에 $${currentStock.ticker}를 샀다면 오늘 ${gainStr}.\n\n차트는 거짓말 안 함. 전쟁도 시장임.`
    : `If you bought $${currentStock.ticker} when ${currentConflict.name} started, you'd be ${gainStr} today.\n\nWar is a trade. Here's the data.`;
  const url = window.location.origin + '/#conflict=' + toSlug(currentConflict.name);
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(tweetUrl, '_blank', 'noopener');
}

async function doCopyReddit() {
  const L = getLang();
  const gainStr = `${currentStock.change >= 0 ? '+' : ''}${currentStock.change}%`;
  const body = L === 'ko'
    ? `📊 ${currentConflict.name_ko || currentConflict.name} 개전 이후 $${currentStock.ticker}: ${gainStr}\n\nPulse of War 에서 데이터 봤는데 이 숫자 불편함.\n\n*Not financial advice, just dark math.*\n\npulseofwar.com/#conflict=${toSlug(currentConflict.name)}`
    : `📊 Since ${currentConflict.name}, $${currentStock.ticker} = ${gainStr}\n\nPulse of war. Literally.\n\n*Not financial advice, just dark math.*\n\npulseofwar.com/#conflict=${toSlug(currentConflict.name)}`;
  try {
    await navigator.clipboard.writeText(body);
    setStatus(t('card.redditCopied') || 'Reddit-ready text copied. Paste into r/wallstreetbets.');
  } catch (err) {
    console.error('Clipboard text failed:', err);
    setStatus(t('card.copyError') || 'Copy failed.');
  }
}

function setStatus(msg) {
  const el = modalEl.querySelector('.share-modal__status');
  if (!el) return;
  el.textContent = msg;
  clearTimeout(setStatus._t);
  setStatus._t = setTimeout(() => { el.textContent = ''; }, 3000);
}

function toSlug(name) {
  return String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
