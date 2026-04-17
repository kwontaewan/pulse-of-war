// Lightweight i18n engine for static site

let strings = {};
let currentLang = 'en';

export async function initI18n(lang) {
  let all;
  try {
    const res = await fetch('/data/i18n.json');
    if (!res.ok) throw new Error(`i18n HTTP ${res.status}`);
    all = await res.json();
  } catch (err) {
    console.warn('i18n load failed, using defaults:', err);
    all = { en: {}, ko: {} };
  }

  currentLang = lang ||
    new URLSearchParams(location.search).get('lang') ||
    localStorage.getItem('pow-lang') ||
    (navigator.language.startsWith('ko') ? 'ko' : 'en');

  strings = all[currentLang] || all['en'];
  applyDOM();
  return currentLang;
}

export function t(key, vars) {
  let str = strings[key] || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replaceAll(`{${k}}`, v);
    });
  }
  return str;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  localStorage.setItem('pow-lang', lang);
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  location.href = url.toString();
}

function applyDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (!strings[key]) return;
    if (el.dataset.i18nHtml !== undefined) {
      el.innerHTML = strings[key];
    } else {
      el.textContent = strings[key];
    }
  });
}
