// Single source of truth for session-death math, shared by main globe
// (js/app.js) and article pages (js/article.js). Extracted during the
// articles-page plan (plan-articles-page.md, 2026-04-17) so both pages
// produce byte-identical counter values and the "WHILE YOU READ THIS"
// mirror on the article page matches the globe's live counter.
//
// Math policy (locked in /plan-eng-review A3):
//   annualRate = Σ (conflict.casualties / yearsActive)
//   deathsPerSecond = annualRate / (365.25 × 24 × 3600)
// Fallback constants are a snapshot of conflicts.json at plan time — used
// when the fetch fails so the emotional arc still renders.

export const FALLBACK_ANNUAL = 273000; // 2026-04-17 conflicts.json baseline
export const FALLBACK_DAILY = 748;     // FALLBACK_ANNUAL / 365.25, rounded
export const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

export function calculateAnnualDeathRate(conflicts) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return FALLBACK_ANNUAL;
  const currentYear = new Date().getFullYear();
  return conflicts.reduce((sum, c) => {
    const yearsActive = Math.max(1, currentYear - (c.startYear || currentYear));
    const cas = Number(c.casualties) || 0;
    return sum + cas / yearsActive;
  }, 0);
}

export function deathsPerSecond(annualDeathRate) {
  return annualDeathRate / SECONDS_PER_YEAR;
}

export function dailyDeaths(annualDeathRate) {
  return Math.round(annualDeathRate / 365);
}

// sessionStorage key shared across globe + article pages so the
// "while you read this" counter continues across navigation. Uses
// Date.now() (wall-clock) intentionally — deaths happen in wall-clock
// time, not in page-active time (accepted in OV1).
const SESSION_KEY = 'pow-session-start-ms';

export function getSessionStartMs() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return Number(stored);
    const now = Date.now();
    sessionStorage.setItem(SESSION_KEY, String(now));
    return now;
  } catch {
    // Private mode / quota — fall back to per-call Date.now() so the
    // counter still runs; it just restarts on each page load.
    return Date.now();
  }
}

export function getSessionDeaths(annualDeathRate, startMs = getSessionStartMs()) {
  const elapsedSec = Math.max(0, (Date.now() - startMs) / 1000);
  return Math.floor(deathsPerSecond(annualDeathRate) * elapsedSec);
}
