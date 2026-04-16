// Conflict detail panel with economic impact + clickable news

import { t } from './i18n.js';
import { openShareModal } from './share-modal.js';

export class DetailPanel {
  constructor(panelEl) {
    this.el = panelEl;
    this.currentConflict = null;
    this.closeBtn = panelEl.querySelector('.panel__close');
    this.closeBtn.addEventListener('click', () => this.close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    const shareBtn = panelEl.querySelector('[data-action="share-pnl"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (this.currentConflict) openShareModal(this.currentConflict);
      });
    }
  }

  open(conflict, lang) {
    this.lang = lang || 'en';
    this.currentConflict = conflict;
    this.el.querySelector('.panel__type').textContent = conflict.type.toUpperCase();
    this.el.querySelector('.panel__title').textContent = conflict.name;

    // Use Korean description if available
    const desc = (lang === 'ko' && conflict.description_ko)
      ? conflict.description_ko
      : conflict.description;
    this.el.querySelector('.panel__desc').textContent = desc;

    this.el.querySelector('[data-stat="casualties"]').textContent =
      conflict.casualties.toLocaleString('en-US');
    this.el.querySelector('[data-stat="refugees"]').textContent =
      conflict.refugees.toLocaleString('en-US');
    this.el.querySelector('[data-stat="since"]').textContent = conflict.startYear;

    // Parties
    const partyList = this.el.querySelector('.panel__party-list');
    partyList.innerHTML = '';
    conflict.parties.forEach(p => {
      const span = document.createElement('span');
      span.className = 'panel__party';
      span.textContent = p;
      partyList.appendChild(span);
    });

    this.el.querySelector('.panel__source').textContent = `${t('panel.source')}: ${conflict.source}`;

    // Economic data
    const econ = conflict.economicImpact;
    const econSections = this.el.querySelectorAll('.panel__section, .panel__war-cost, .panel__share-pnl');

    if (econ) {
      econSections.forEach(el => el.style.display = '');

      const costEl = this.el.querySelector('[data-econ="warCost"]');
      const costNote = this.el.querySelector('[data-econ="warCostNote"]');
      if (costEl) costEl.textContent = econ.warCost || '—';
      if (costNote) costNote.textContent = econ.warCostNote || '';

      this.renderStocks(econ.stocks || []);
      this.renderCommodities(econ.commodities || []);
      this.renderNews(econ.news || []);

      // Hide share button if no stocks to render
      const shareBtn = this.el.querySelector('.panel__share-pnl');
      if (shareBtn) {
        shareBtn.style.display = (econ.stocks?.length > 0) ? '' : 'none';
      }
    } else {
      econSections.forEach(el => el.style.display = 'none');
    }

    this.el.classList.add('panel--open');
    this.el.scrollTop = 0;
  }

  renderStocks(stocks) {
    const container = this.el.querySelector('[data-econ="stocks"]');
    if (!container) return;
    container.innerHTML = '';

    stocks.forEach(s => {
      const up = s.change >= 0;
      const el = document.createElement('div');
      el.className = `panel__stock ${up ? 'stock--up' : 'stock--down'}`;
      el.innerHTML = `
        <div class="panel__stock-left">
          <span class="panel__stock-ticker">${esc(s.ticker)}</span>
          <span class="panel__stock-name">${esc(s.name)}</span>
        </div>
        <div class="panel__stock-right">
          <span class="panel__stock-change">${up ? '+' : ''}${s.change}%</span>
          <span class="panel__stock-since">since ${esc(s.since)}</span>
        </div>
      `;
      container.appendChild(el);
    });
  }

  renderCommodities(commodities) {
    const container = this.el.querySelector('[data-econ="commodities"]');
    if (!container) return;
    container.innerHTML = '';

    const maxAbs = Math.max(...commodities.map(c => Math.abs(c.change)), 1);

    commodities.forEach(c => {
      const up = c.change >= 0;
      const barW = Math.round((Math.abs(c.change) / maxAbs) * 100);
      const el = document.createElement('div');
      el.className = 'panel__commodity';
      el.innerHTML = `
        <div class="panel__commodity-header">
          <span class="panel__commodity-name">${esc(c.name)}</span>
          <span class="panel__commodity-change ${up ? 'commodity--up' : 'commodity--down'}">
            ${up ? '+' : ''}${c.change}%
          </span>
        </div>
        <div class="panel__commodity-bar-track">
          <div class="panel__commodity-bar ${up ? 'commodity-bar--up' : 'commodity-bar--down'}"
               style="width: ${barW}%"></div>
        </div>
      `;
      container.appendChild(el);
    });
  }

  renderNews(news) {
    const container = this.el.querySelector('[data-econ="news"]');
    if (!container) return;
    container.innerHTML = '';

    news.forEach(n => {
      const el = document.createElement('div');
      el.className = 'panel__news-item';
      const headline = (this.lang === 'ko' && n.headline_ko) ? n.headline_ko : n.headline;

      if (n.url) {
        const a = document.createElement('a');
        a.className = 'panel__news-link';
        a.href = n.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.innerHTML = `
          <div class="panel__news-headline">${esc(headline)}</div>
          <div class="panel__news-meta">${esc(n.source)} · ${esc(n.date)} ↗</div>
        `;
        el.appendChild(a);
      } else {
        el.innerHTML = `
          <div class="panel__news-headline">${esc(headline)}</div>
          <div class="panel__news-meta">${esc(n.source)} · ${esc(n.date)}</div>
        `;
      }

      container.appendChild(el);
    });
  }

  close() {
    this.el.classList.remove('panel--open');
  }
}

function esc(text) {
  const d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
}
