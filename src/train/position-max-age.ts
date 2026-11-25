export const DEFAULT_POSITION_MAX_AGE_SECONDS = 300;
export const MIN_POSITION_MAX_AGE_SECONDS = 30;
export const MAX_POSITION_MAX_AGE_SECONDS = 3600;

export type MaxAgeParse =
  | { ok: true; seconds: number }
  | { ok: false; error: string };

const INVALID_MAX_AGE =
  'Invalid maxAge: must be an integer between 30 and 3600 seconds';

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Build a Trafikverket `$dateadd(-HH:MM:SS)` offset from a validated
 * integer number of seconds. Components are computed arithmetically so
 * caller input is never interpolated into the XML value.
 */
export const toDateAddOffset = (seconds: number): string => {
  if (
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > MAX_POSITION_MAX_AGE_SECONDS
  ) {
    throw new RangeError(
      'seconds must be an integer between 0 and 3600'
    );
  }

  const hours = Math.trunc(seconds / 3600);
  const minutes = Math.trunc((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `$dateadd(-${pad2(hours)}:${pad2(minutes)}:${pad2(rest)})`;
};

export const parseMaxAge = (value: unknown): MaxAgeParse => {
  if (value === undefined) {
    return { ok: true, seconds: DEFAULT_POSITION_MAX_AGE_SECONDS };
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return { ok: false, error: INVALID_MAX_AGE };
  }

  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: INVALID_MAX_AGE };
  }

  const seconds = Number(raw);
  if (
    !Number.isInteger(seconds) ||
    seconds < MIN_POSITION_MAX_AGE_SECONDS ||
    seconds > MAX_POSITION_MAX_AGE_SECONDS
  ) {
    return { ok: false, error: INVALID_MAX_AGE };
  }

  return { ok: true, seconds };
};
