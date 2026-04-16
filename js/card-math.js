// P&L card pure math + formatting. No DOM, no side effects.
// Exported so `node --test` can run against them.

// Current value if `amount` was invested on war-start date.
// change is a % number from conflicts.json (e.g. 24.4 means +24.4%).
export function calculateGain(amount, changePct) {
  const a = Number(amount);
  const c = Number(changePct);
  if (!Number.isFinite(a) || !Number.isFinite(c)) return null;
  if (a < 0) return null;
  const today = a * (1 + c / 100);
  const profit = today - a;
  return {
    invested: a,
    today: today,
    profit: profit,
    gainPct: c,
    isLoss: c < 0,
  };
}

// Compact USD formatter. No decimals for amounts >= $1000.
export function formatCurrency(n, lang = 'en') {
  if (!Number.isFinite(n)) return '—';
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const abs = Math.abs(n);
  const opts = abs >= 1000
    ? { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }
    : { style: 'currency', currency: 'USD', maximumFractionDigits: 2 };
  return new Intl.NumberFormat(locale, opts).format(n);
}

// Percentage with explicit sign and one decimal.
export function formatPct(n) {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

// Stock list formatted for the card: sorted by absolute change desc.
// Returns [{ticker, name, change, since}, ...]
export function topStocksByAbsChange(stocks, limit = 3) {
  if (!Array.isArray(stocks)) return [];
  return [...stocks]
    .filter(s => Number.isFinite(s.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, limit);
}

// Preset investment amounts for the slider UI.
export const AMOUNT_PRESETS = [100, 1000, 10000, 100000];
