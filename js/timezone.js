// Resolved user timezone, cached once per page load.
//
// `Intl.DateTimeFormat().resolvedOptions().timeZone` is supported in every
// evergreen browser. In the rare case the runtime returns `undefined` or the
// property throws, fall back to UTC. We cache because the value never changes
// within a session.

let _cached = null;

export function userTimezone() {
  if (_cached) return _cached;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    _cached = tz && typeof tz === 'string' ? tz : 'UTC';
  } catch {
    _cached = 'UTC';
  }
  return _cached;
}

// For tests only — reset cache between cases.
export function _resetTimezoneCache() {
  _cached = null;
}
