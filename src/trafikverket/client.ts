import { stringify } from '@libs/xml';
import type { stringifyable } from '@libs/xml/stringify';
import config from '../config.js';
const API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';

const MAX_CHANGEID_PAGES = 100;

type TrafikverketError = {
  SOURCE?: string;
  MESSAGE?: string;
};

type TrafikverketInfo = {
  LASTCHANGEID?: string | number;
  LastChangeId?: string | number;
};

type TrafikverketResult = {
  ERROR?: TrafikverketError;
  INFO?: TrafikverketInfo | TrafikverketInfo[];
} & Record<string, unknown>;

type TrafikverketResponse = {
  RESPONSE?: {
    RESULT?: TrafikverketResult[];
  };
};

export type QueryPage<T> = {
  items: T;
  lastChangeId?: string;
  truncated: boolean;
};

export type PostAllPagesOptions = {
  /** HTTP 206 with no new LASTCHANGEID: throw (default) or return pages so far. */
  onMissingChangeId?: 'throw' | 'return';
  /** After at least one page of items, return them instead of failing the request. */
  onPageError?: 'throw' | 'return';
  /** Omit changeid (TrainMessage snapshots reject INCLUDE with changeid). Default true. */
  useChangeId?: boolean;
};

const lastChangeIdOf = (result: TrafikverketResult): string | undefined => {
  const info = result.INFO;
  const rec = Array.isArray(info) ? info[0] : info;
  if (!rec || typeof rec !== 'object') return undefined;
  const raw = rec.LASTCHANGEID ?? rec.LastChangeId;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null || value === '') return undefined;
  return String(value);
};

const errorMessageOf = (json: TrafikverketResponse): string | undefined => {
  const message = json.RESPONSE?.RESULT?.[0]?.ERROR?.MESSAGE;
  return typeof message === 'string' && message.trim() ? message.trim() : undefined;
};

const parseResult = <T>(
  json: TrafikverketResponse,
  entityName: string,
  truncated: boolean
): QueryPage<T> => {
  const result = json.RESPONSE?.RESULT?.[0];
  if (!result) {
    throw new Error('Unexpected Trafikverket response shape');
  }

  if (result.ERROR) {
    const source = result.ERROR.SOURCE ?? 'unknown';
    const message = result.ERROR.MESSAGE ?? 'unknown error';
    // 206 is a page, not a hard error — Trafikverket may still send ERROR
    // ("response too large") alongside INFO.LASTCHANGEID and a partial list.
    if (!truncated) {
      throw new Error(`Trafikverket error (${source}): ${message}`);
    }
    console.error(`Trafikverket HTTP 206 ERROR (${source}): ${message}`);
  }

  // Empty result sets omit the entity key entirely rather than sending [].
  const dataToReturn = result[entityName];
  return {
    items: (dataToReturn == null ? [] : dataToReturn) as T,
    lastChangeId: lastChangeIdOf(result),
    truncated,
  };
};

const postPage = async <T>(
  query: stringifyable,
  entityName: string
): Promise<QueryPage<T>> => {
  const apiKey = config.trafikverketApiKey;
  const body = stringify({
    REQUEST: {
      LOGIN: {
        '@authenticationkey': apiKey,
      },
      QUERY: query,
    },
  });
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body,
    cache: 'no-cache',
  });

  // 206 is "response too large" — a page, not an error. Parse INFO.LASTCHANGEID.
  if (response.status === 206) {
    const json = (await response.json()) as TrafikverketResponse;
    return parseResult<T>(json, entityName, true);
  }

  const json = (await response.json()) as TrafikverketResponse;
  if (!response.ok) {
    const detail = errorMessageOf(json);
    throw new Error(
      detail
        ? `Trafikverket HTTP ${response.status}: ${detail}`
        : `Trafikverket HTTP ${response.status}`
    );
  }

  return parseResult<T>(json, entityName, false);
};

const post = async <T>(
  query: stringifyable,
  entityName: string
): Promise<T> => {
  const page = await postPage<T>(query, entityName);
  if (page.truncated) {
    throw new Error(
      'Trafikverket response too large (HTTP 206); use changeid to page'
    );
  }
  return page.items;
};

/** Collect every page of a snapshot. HTTP 206 continues with INFO.LASTCHANGEID. */
const postAllPages = async <T>(
  query: stringifyable,
  entityName: string,
  options: PostAllPagesOptions = {}
): Promise<T[]> => {
  const useChangeId = options.useChangeId ?? true;
  let changeId = '0';
  const items: T[] = [];

  for (let page = 0; page < MAX_CHANGEID_PAGES; page++) {
    const pageQuery = useChangeId
      ? {
          ...(query as object),
          '@changeid': changeId,
        }
      : (query as object);
    let result: QueryPage<T[]>;
    try {
      result = await postPage<T[]>(pageQuery, entityName);
    } catch (err) {
      if (options.onPageError === 'return' && items.length > 0) {
        console.error(
          `Trafikverket changeid page ${page + 1} failed; returning ${items.length} item(s) collected so far`
        );
        return items;
      }
      throw err;
    }
    const pageItems = Array.isArray(result.items)
      ? result.items
      : result.items
        ? [result.items]
        : [];
    items.push(...pageItems);

    if (!result.truncated) {
      return items;
    }

    if (!useChangeId) {
      if (options.onMissingChangeId === 'return') {
        return items;
      }
      throw new Error(
        'Trafikverket response too large (HTTP 206); snapshot paging unavailable'
      );
    }

    const nextId = result.lastChangeId;
    if (!nextId || nextId === changeId) {
      if (options.onMissingChangeId === 'return') {
        return items;
      }
      throw new Error(
        'Trafikverket HTTP 206 without a new INFO.LASTCHANGEID'
      );
    }
    changeId = nextId;
  }

  throw new Error(
    `Trafikverket changeid paging exceeded ${MAX_CHANGEID_PAGES} pages`
  );
};

export default { post, postPage, postAllPages };
