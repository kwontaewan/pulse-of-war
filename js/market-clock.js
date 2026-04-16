// Market clock — pure functions.
//
// `marketStatus(now, holidays)` returns whether a market is open, when it
// closes next, or when it reopens. All time math goes through `Intl` with an
// explicit IANA timezone so DST is handled automatically — never do
// manual UTC offset arithmetic here.
//
// Holidays are loaded as JSON (shape in data/us-market-holidays.json).
// `valid_through` is checked on load; expired tables log a warning but still
// fall back to weekday-only "open" logic rather than breaking the page.

const DAY_MS = 24 * 60 * 60 * 1000;

// Low-level: what is the local date (YYYY-MM-DD) + time (HH:MM) at `date` in
// the given IANA timezone? Returns an object, never throws.
export function localParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map(p => [p.type, p.value])
  );
  // Chrome sometimes returns "24:00" for midnight — normalize.
  let hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
    weekday: parts.weekday, // Mon, Tue, ... Sun
  };
}

function hhmmToMinutes(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function isWeekend(weekday) {
  return weekday === 'Sat' || weekday === 'Sun';
}

function findEarlyClose(earlyClose, dateStr) {
  if (!Array.isArray(earlyClose)) return null;
  const hit = earlyClose.find(e => e.date === dateStr);
  return hit || null;
}

function isHoliday(fullClose, dateStr) {
  return Array.isArray(fullClose) && fullClose.includes(dateStr);
}

// Returns { state, closeAt, nextOpenDate, early? }.
// state ∈ 'OPEN' | 'CLOSED'
//
// NOTE: this does NOT compute Date objects for future open/close. It answers
// "is the market open right now, and when does today close?" and leaves the
// caller to decide how to format countdowns. Keeps this function pure/test-
// friendly; countdown formatting lives in `formatCountdown` below.
export function marketStatus(now, holidays) {
  const { timezone, regular_hours, full_close, early_close } = holidays;
  const { date, time, weekday } = localParts(now, timezone);

  // Weekends: always closed.
  if (isWeekend(weekday)) {
    return { state: 'CLOSED', reason: 'weekend', localDate: date, localTime: time };
  }

  // Full-day holiday.
  if (isHoliday(full_close, date)) {
    return { state: 'CLOSED', reason: 'holiday', localDate: date, localTime: time };
  }

  // Determine close time for today (accounts for early close).
  const early = findEarlyClose(early_close, date);
  const closeStr = early ? early.close : regular_hours.close;

  const nowMin = hhmmToMinutes(time);
  const openMin = hhmmToMinutes(regular_hours.open);
  const closeMin = hhmmToMinutes(closeStr);

  if (nowMin >= openMin && nowMin < closeMin) {
    return {
      state: 'OPEN',
      reason: early ? 'early_close_today' : 'regular',
      localDate: date,
      localTime: time,
      closeAt: closeStr,
      early: !!early,
    };
  }

  return {
    state: 'CLOSED',
    reason: nowMin < openMin ? 'before_open' : 'after_close',
    localDate: date,
    localTime: time,
  };
}

// Returns a Date representing the next time `holidays.market` will open.
// Walks forward day by day, skipping weekends + full_close entries. Caps at
// 14 days of lookahead (protects against malformed holiday data covering an
// entire fortnight — logs and returns null).
export function nextOpenAt(now, holidays) {
  const { timezone, regular_hours, full_close } = holidays;
  const todayParts = localParts(now, timezone);
  const todayMin = hhmmToMinutes(todayParts.time);
  const openMin = hhmmToMinutes(regular_hours.open);

  // Start from today if we're before open, otherwise tomorrow.
  let probe = new Date(now);
  if (todayMin >= openMin) {
    probe = new Date(probe.getTime() + DAY_MS);
  }

  for (let i = 0; i < 14; i++) {
    const parts = localParts(probe, timezone);
    if (!isWeekend(parts.weekday) && !isHoliday(full_close, parts.date)) {
      // Construct a Date that represents this day's open time in that tz.
      // We cannot build a Date directly from local strings cross-browser, so
      // we binary-search minutes within the day until localParts matches. For
      // our use case (< 1 hour granularity) a linear sweep works fine.
      return resolveLocalOpenDate(parts.date, regular_hours.open, timezone);
    }
    probe = new Date(probe.getTime() + DAY_MS);
  }
  console.warn(`[market-clock] no open day found in 14 days for ${holidays.market}`);
  return null;
}

// Given a local `YYYY-MM-DD` and `HH:MM` in a timezone, return the
// corresponding Date. Approach: take a UTC Date for that date at 12:00,
// compute what localParts returns, and nudge.
function resolveLocalOpenDate(dateStr, timeStr, timeZone) {
  const [h, m] = timeStr.split(':').map(Number);
  // Start at a UTC instant that we know maps to the target date in most
  // timezones (midday). Then correct the minute offset using localParts.
  let probe = new Date(`${dateStr}T12:00:00Z`);
  for (let pass = 0; pass < 3; pass++) {
    const local = localParts(probe, timeZone);
    const [lh, lm] = local.time.split(':').map(Number);
    const deltaMin = (h - lh) * 60 + (m - lm);
    if (deltaMin === 0 && local.date === dateStr) return probe;
    probe = new Date(probe.getTime() + deltaMin * 60 * 1000);
  }
  return probe;
}

// Returns a human-readable countdown like "3h 24m" or "34m" or "less than 1 minute".
export function formatCountdown(ms, lang = 'en') {
  if (!Number.isFinite(ms) || ms <= 0) {
    return lang === 'ko' ? '곧' : 'now';
  }
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) {
    return lang === 'ko' ? '1분 미만' : 'less than 1 minute';
  }
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  if (lang === 'ko') {
    if (days > 0) return `${days}일 ${hours}시간`;
    if (hours > 0) return `${hours}시간 ${mins}분`;
    return `${mins}분`;
  }
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Checks the holidays JSON for staleness. Call once on load.
// Returns: 'ok' | 'warn' | 'expired'.
export function checkHolidaysFreshness(holidays, now = new Date()) {
  if (!holidays || !holidays.valid_through) return 'warn';
  const validThrough = new Date(`${holidays.valid_through}T23:59:59Z`);
  if (now > validThrough) {
    console.warn(
      `[market-clock] ${holidays.market} holidays expired (${holidays.valid_through}). Update data/${holidays.market.toLowerCase()}-market-holidays.json.`
    );
    return 'expired';
  }
  const soonMs = 30 * DAY_MS;
  if (validThrough - now < soonMs) {
    console.warn(
      `[market-clock] ${holidays.market} holidays expire within 30 days (${holidays.valid_through}). Plan an update.`
    );
    return 'warn';
  }
  return 'ok';
}
