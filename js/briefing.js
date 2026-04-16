// Briefing page — loads data/briefing.json and renders.

import { initI18n, t, getLang, setLang } from './i18n.js';

const STALE_HOURS = 26;

async function main() {
  const lang = await initI18n();
  document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';

  const langBtn = document.getElementById('js-lang-toggle');
  langBtn.textContent = lang === 'ko' ? 'EN' : 'KO';
  langBtn.addEventListener('click', () => setLang(lang === 'ko' ? 'en' : 'ko'));

  const container = document.getElementById('js-briefing');

  let briefing;
  try {
    const r = await fetch('./data/briefing.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    briefing = await r.json();
  } catch (err) {
    renderComingSoon(container, lang);
    return;
  }

  // Treat dry-run / canned briefings as "not yet live" — the AI pipeline is
  // not generating real output on this deployment.
  if (briefing.model === 'dry-run' || !briefing.en) {
    renderComingSoon(container, lang);
    return;
  }

  checkStale(briefing);
  render(container, briefing, lang);
}

function renderComingSoon(root, lang) {
  const title = lang === 'ko'
    ? '브리핑 준비 중'
    : 'Daily briefing — coming soon';
  const body = lang === 'ko'
    ? '매일 자동 생성되는 전쟁 + 시장 브리핑을 준비 중입니다. 지금은 지도와 P&L 카드를 둘러보세요.'
    : "Auto-generated daily war + market briefing is in the works. For now, explore the map and P&L cards.";
  const back = lang === 'ko' ? '← 지도로 돌아가기' : '← Back to the map';
  root.innerHTML = `
    <div class="briefing-coming-soon">
      <div class="briefing-coming-soon__badge">COMING SOON</div>
      <h1 class="briefing-headline">${escapeHtml(title)}</h1>
      <p class="briefing-coming-soon__body">${escapeHtml(body)}</p>
      <a class="briefing-coming-soon__back" href="/">${escapeHtml(back)}</a>
    </div>
  `;
}

function checkStale(briefing) {
  const banner = document.getElementById('js-stale-banner');
  if (!banner || !briefing.generated_at) return;
  const age = (Date.now() - new Date(briefing.generated_at).getTime()) / 1000 / 3600;
  if (age > STALE_HOURS) {
    const key = 'briefing.stale';
    banner.textContent = t(key) || `Data delayed — latest briefing is ${Math.round(age)}h old.`;
    banner.hidden = false;
  }
}

function render(root, briefing, lang) {
  const body = (lang === 'ko' && briefing.ko) ? briefing.ko : briefing.en;
  if (!body) {
    renderEmpty(root, lang);
    return;
  }

  const dateStr = formatDate(briefing.date, lang);
  const headline = escapeHtml(body.headline || '');

  root.innerHTML = `
    <div class="briefing-meta">
      <span class="briefing-meta__date">${escapeHtml(dateStr)}</span>
      <span class="briefing-meta__model">${escapeHtml(briefing.model || '')}</span>
    </div>
    <h1 class="briefing-headline">${headline}</h1>
    ${(body.sections || []).map(renderSection).join('')}
  `;
}

function renderSection(section) {
  const bullets = (section.bullets || []).map(b => {
    const txt = typeof b === 'string' ? b : (b.text || '');
    return `<li class="briefing-bullet">${escapeHtml(txt)}</li>`;
  }).join('');
  return `
    <section class="briefing-section">
      <h2 class="briefing-section__title">${escapeHtml(section.title || '')}</h2>
      <ul class="briefing-bullets">${bullets}</ul>
    </section>
  `;
}

function renderEmpty(root, lang) {
  const msg = lang === 'ko'
    ? '오늘 브리핑이 아직 준비되지 않았습니다. 다시 방문해주세요.'
    : "Today's briefing is not ready yet. Check back soon.";
  root.innerHTML = `<div class="briefing-empty">${escapeHtml(msg)}</div>`;
}

function formatDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

main().catch(err => {
  console.error('briefing failed:', err);
});
