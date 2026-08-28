export type AdvertisedTimeWindow = {
  from?: string;
  to?: string;
};

export type AdvertisedTimeWindowParse =
  | { ok: true; window: AdvertisedTimeWindow }
  | { ok: false; error: string };

/** ISO-8601 date or date-time, e.g. `2026-08-28T00:00:00+02:00`. */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const parseBound = (
  value: unknown,
  name: 'from' | 'to'
): { ok: true; value?: string; ms?: number } | { ok: false; error: string } => {
  if (value === undefined) return { ok: true };
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, error: `Invalid ${name} timestamp` };
  }

  const trimmed = value.trim();
  if (!ISO_DATE_TIME.test(trimmed)) {
    return { ok: false, error: `Invalid ${name} timestamp` };
  }

  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    return { ok: false, error: `Invalid ${name} timestamp` };
  }

  return { ok: true, value: trimmed, ms };
};

export const parseAdvertisedTimeWindow = (query: {
  from?: unknown;
  to?: unknown;
}): AdvertisedTimeWindowParse => {
  const from = parseBound(query.from, 'from');
  if (!from.ok) return from;
  const to = parseBound(query.to, 'to');
  if (!to.ok) return to;

  if (from.ms != null && to.ms != null && from.ms > to.ms) {
    return { ok: false, error: 'from must not be after to' };
  }

  const window: AdvertisedTimeWindow = {};
  if (from.value) window.from = from.value;
  if (to.value) window.to = to.value;
  return { ok: true, window };
};
