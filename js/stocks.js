// War Stocks panel — sector-filtered stock list with detail view

import { t, getLang } from './i18n.js';

export class StocksPanel {
  constructor(containerEl) {
    this.el = containerEl;
    this.data = null;
    this.activeSector = 'all';
    this.lang = 'en';
  }

  init(data, lang) {
    this.data = data;
    this.lang = lang || 'en';
    this.render();
  }

  render() {
    if (!this.data) return;
    const { sectors, stocks, lastUpdated } = this.data;
    const ko = this.lang === 'ko';

    const updated = ko ? `최근 업데이트: ${lastUpdated}` : `Updated: ${lastUpdated}`;

    // Sector tabs with outlook
    const allLabel = ko ? '전체' : 'ALL';
    const sectorTabs = [
      `<button class="stocks__sector-tab stocks__sector-tab--active" data-sector="all">${allLabel}</button>`,
      ...sectors.map(s => {
        const name = ko ? s.name_ko : s.name;
        const arrow = s.outlook === 'bullish' ? '↑' : s.outlook === 'bearish' ? '↓' : '→';
        const outlookClass = s.outlook === 'bullish' ? 'outlook--bull' : s.outlook === 'bearish' ? 'outlook--bear' : '';
        return `<button class="stocks__sector-tab" data-sector="${s.id}">${s.icon} ${name} <span class="stocks__outlook ${outlookClass}">${arrow}</span></button>`;
      })
    ].join('');

    // Sector outlook summary
    const outlookSummary = sectors
      .filter(s => s.outlookNote)
      .map(s => {
        const name = ko ? s.name_ko : s.name;
        const note = ko ? (s.outlookNote_ko || s.outlookNote) : s.outlookNote;
        const arrow = s.outlook === 'bullish' ? '▲' : s.outlook === 'bearish' ? '▼' : '▶';
        const cls = s.outlook === 'bullish' ? 'outlook-card--bull' : s.outlook === 'bearish' ? 'outlook-card--bear' : '';
        return `<div class="outlook-card ${cls}"><span class="outlook-card__arrow">${arrow}</span><span class="outlook-card__sector">${s.icon} ${name}</span><span class="outlook-card__note">${esc(note)}</span></div>`;
      }).join('');

    // Stock list
    const sorted = [...stocks].sort((a, b) => a.rank - b.rank);
    const stocksHtml = sorted.map(s => this.renderStock(s)).join('');

    this.el.innerHTML = `
      <div class="stocks__updated">${updated}</div>
      ${outlookSummary ? `<div class="stocks__outlook-section"><div class="stocks__outlook-title">${ko ? '📊 섹터별 전망' : '📊 SECTOR OUTLOOK'}</div>${outlookSummary}</div>` : ''}
      <div class="stocks__sectors">${sectorTabs}</div>
      <div class="stocks__list">${stocksHtml}</div>
      <div class="stock-detail" style="display:none"></div>
    `;

    // Sector filter
    this.el.querySelectorAll('.stocks__sector-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeSector = tab.dataset.sector;
        this.el.querySelectorAll('.stocks__sector-tab').forEach(t =>
          t.classList.toggle('stocks__sector-tab--active', t === tab)
        );
        this.filterStocks();
      });
    });

    // Stock card click → detail view
    this.el.querySelectorAll('.stock-card').forEach(card => {
      card.addEventListener('click', () => {
        const ticker = card.dataset.ticker;
        const stock = this.data.stocks.find(s => s.ticker === ticker);
        if (stock) this.showDetail(stock);
      });
    });
  }

  renderStock(s) {
    const up = s.warReturn >= 0;
    const colorClass = up ? 'stock-card--up' : 'stock-card--down';
    const sign = up ? '+' : '';
    const name = this.lang === 'ko' ? (s.name_ko || s.name) : s.name;
    const trendBadge = s.trending ? '<span class="stock-card__trend">HOT</span>' : '';
    const exchangeBadge = `<span class="stock-card__exchange">${esc(s.exchange)}</span>`;
    const conflictTags = s.conflicts.map(c => `<span class="stock-card__conflict">${esc(c)}</span>`).join('');

    return `
      <div class="stock-card ${colorClass}" data-sector="${s.sector}" data-ticker="${esc(s.ticker)}">
        <div class="stock-card__header">
          <div class="stock-card__ticker-row">
            <span class="stock-card__ticker">${esc(s.ticker.endsWith('.KS') ? (this.lang === 'ko' ? (s.name_ko || s.name) : s.name) : s.ticker)}</span>
            ${exchangeBadge}
            ${trendBadge}
            <span class="stock-card__price">${s.price}</span>
          </div>
          <div class="stock-card__name">${esc(name)}</div>
        </div>
        <div class="stock-card__returns">
          <div class="stock-card__return">
            <span class="stock-card__return-label">${this.lang === 'ko' ? '오늘' : 'DoD'}</span>
            <span class="stock-card__return-value ${s.dod != null ? (s.dod >= 0 ? 'val--up' : 'val--down') : ''}">${s.dod != null ? (s.dod >= 0 ? '+' : '') + s.dod + '%' : '—'}</span>
          </div>
          <div class="stock-card__return">
            <span class="stock-card__return-label">YTD</span>
            <span class="stock-card__return-value">${sign}${s.ytdReturn}%</span>
          </div>
          <div class="stock-card__return">
            <span class="stock-card__return-label">${this.lang === 'ko' ? '전쟁' : 'WAR'}</span>
            <span class="stock-card__return-value stock-card__return-value--war">${sign}${s.warReturn}%</span>
          </div>
        </div>
        <div class="stock-card__conflicts">${conflictTags}</div>
      </div>
    `;
  }

  showDetail(s) {
    const ko = this.lang === 'ko';
    const up = s.warReturn >= 0;
    const sign = up ? '+' : '';
    const name = ko ? (s.name_ko || s.name) : s.name;
    const desc = ko ? (s.description_ko || s.description) : s.description;
    const sectorInfo = this.data.sectors.find(sec => sec.id === s.sector);
    const sectorName = sectorInfo ? (ko ? sectorInfo.name_ko : sectorInfo.name) : s.sector;
    const outlookNote = sectorInfo?.outlookNote ? (ko ? (sectorInfo.outlookNote_ko || sectorInfo.outlookNote) : sectorInfo.outlookNote) : '';
    const outlookLabel = sectorInfo?.outlook === 'bullish' ? (ko ? '강세' : 'BULLISH') : sectorInfo?.outlook === 'bearish' ? (ko ? '약세' : 'BEARISH') : (ko ? '중립' : 'NEUTRAL');
    const outlookClass = sectorInfo?.outlook === 'bullish' ? 'outlook--bull' : sectorInfo?.outlook === 'bearish' ? 'outlook--bear' : '';

    const yahooUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(s.ticker)}`;
    const tradingViewUrl = `https://www.tradingview.com/symbols/${encodeURIComponent(s.exchange + ':' + s.ticker.replace('.', '-'))}/`;

    const detail = this.el.querySelector('.stock-detail');
    const list = this.el.querySelector('.stocks__list');
    const outlookSection = this.el.querySelector('.stocks__outlook-section');
    const sectors = this.el.querySelector('.stocks__sectors');

    // Return helpers
    const rv = (val) => val != null ? `${val >= 0 ? '+' : ''}${val}%` : '—';
    const rc = (val) => val == null ? '' : val >= 0 ? 'val--up' : 'val--down';

    // 52-week range bar
    const rangePercent = (s.weekHigh52 && s.weekLow52 && s.priceNumeric)
      ? Math.round(((s.priceNumeric - s.weekLow52) / (s.weekHigh52 - s.weekLow52)) * 100)
      : null;

    const rangeHtml = rangePercent != null ? `
      <div class="stock-detail__section-label">${ko ? '52주 레인지' : '52-WEEK RANGE'}</div>
      <div class="stock-detail__range">
        <span class="stock-detail__range-val">${s.weekLow52.toLocaleString()}</span>
        <div class="stock-detail__range-track">
          <div class="stock-detail__range-marker" style="left:${rangePercent}%"></div>
        </div>
        <span class="stock-detail__range-val">${s.weekHigh52.toLocaleString()}</span>
      </div>` : '';

    // Valuation metrics
    const metrics = [];
    if (s.pe != null) metrics.push(`<div class="stock-detail__metric"><span class="stock-detail__metric-label">PER</span><span class="stock-detail__metric-val">${s.pe}x</span></div>`);
    if (s.dividendYield != null) metrics.push(`<div class="stock-detail__metric"><span class="stock-detail__metric-label">${ko ? '배당수익률' : 'Div Yield'}</span><span class="stock-detail__metric-val">${s.dividendYield}%</span></div>`);
    if (s.volume) metrics.push(`<div class="stock-detail__metric"><span class="stock-detail__metric-label">${ko ? '거래량' : 'Volume'}</span><span class="stock-detail__metric-val">${s.volume}</span></div>`);
    const metricsHtml = metrics.length > 0 ? `<div class="stock-detail__metrics">${metrics.join('')}</div>` : '';

    detail.innerHTML = `
      <button class="stock-detail__back">${ko ? '← 목록으로' : '← Back to list'}</button>
      <div class="stock-detail__header ${up ? 'stock-card--up' : 'stock-card--down'}">
        <div class="stock-detail__ticker">${esc(s.ticker.endsWith('.KS') ? (ko ? (s.name_ko || s.name) : s.name) : s.ticker)}</div>
        <div class="stock-detail__name">${esc(name)}</div>
        <div class="stock-detail__exchange-badge">${esc(s.exchange)}</div>
      </div>
      <div class="stock-detail__price-row">
        <span class="stock-detail__price">${s.price}</span>
        <span class="stock-detail__dod ${rc(s.dod)}">${rv(s.dod)} ${ko ? '오늘' : 'today'}</span>
      </div>
      <div class="stock-detail__mcap-row">
        <span>${ko ? '시가총액' : 'Mkt Cap'}: ${s.marketCap}</span>
      </div>

      <div class="stock-detail__section-label">${ko ? '수익률' : 'RETURNS'}</div>
      <div class="stock-detail__returns-grid">
        <div class="stock-detail__return-card">
          <div class="stock-detail__return-label">${ko ? '전일대비' : 'DoD'}</div>
          <div class="stock-detail__return-val ${rc(s.dod)}">${rv(s.dod)}</div>
        </div>
        <div class="stock-detail__return-card">
          <div class="stock-detail__return-label">${ko ? '월간' : 'MoM'}</div>
          <div class="stock-detail__return-val ${rc(s.mom)}">${rv(s.mom)}</div>
        </div>
        <div class="stock-detail__return-card">
          <div class="stock-detail__return-label">${ko ? '연간' : 'YoY'}</div>
          <div class="stock-detail__return-val ${rc(s.yoy)}">${rv(s.yoy)}</div>
        </div>
        <div class="stock-detail__return-card">
          <div class="stock-detail__return-label">${ko ? '전쟁 이후' : 'WAR'}</div>
          <div class="stock-detail__return-val ${rc(s.warReturn)}">${rv(s.warReturn)}</div>
        </div>
      </div>

      ${rangeHtml}
      ${metricsHtml}

      <div class="stock-detail__desc">${esc(desc)}</div>
      <div class="stock-detail__sector-outlook">
        <div class="stock-detail__sector-label">${ko ? '섹터 전망' : 'SECTOR OUTLOOK'}: ${esc(sectorName)}</div>
        <div class="stock-detail__outlook-badge ${outlookClass}">${outlookLabel}</div>
        ${outlookNote ? `<div class="stock-detail__outlook-note">${esc(outlookNote)}</div>` : ''}
      </div>
      <div class="stock-detail__conflicts-label">${ko ? '관련 분쟁' : 'Related Conflicts'}</div>
      <div class="stock-detail__conflicts">${s.conflicts.map(c => `<span class="stock-card__conflict">${esc(c)}</span>`).join('')}</div>
      <div class="stock-detail__links">
        <a class="stock-detail__link" href="${yahooUrl}" target="_blank" rel="noopener">Yahoo Finance ↗</a>
        <a class="stock-detail__link" href="${tradingViewUrl}" target="_blank" rel="noopener">TradingView ↗</a>
      </div>
    `;

    list.style.display = 'none';
    if (outlookSection) outlookSection.style.display = 'none';
    if (sectors) sectors.style.display = 'none';
    detail.style.display = 'block';

    detail.querySelector('.stock-detail__back').addEventListener('click', () => {
      detail.style.display = 'none';
      list.style.display = '';
      if (outlookSection) outlookSection.style.display = '';
      if (sectors) sectors.style.display = '';
    });
  }

  filterStocks() {
    this.el.querySelectorAll('.stock-card').forEach(card => {
      if (this.activeSector === 'all' || card.dataset.sector === this.activeSector) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }
}

function esc(text) {
  const d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
}
