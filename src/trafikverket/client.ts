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
  LASTCHANGEID?: string;
};

type TrafikverketResult = {
  ERROR?: TrafikverketError;
  INFO?: TrafikverketInfo;
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
    throw new Error(`Trafikverket error (${source}): ${message}`);
  }

  // Empty result sets omit the entity key entirely rather than sending [].
  const dataToReturn = result[entityName];
  return {
    items: (dataToReturn == null ? [] : dataToReturn) as T,
    lastChangeId: result.INFO?.LASTCHANGEID,
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

  if (!response.ok) {
    throw new Error(`Trafikverket HTTP ${response.status}`);
  }

  const json = (await response.json()) as TrafikverketResponse;
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
  entityName: string
): Promise<T[]> => {
  let changeId = '0';
  const items: T[] = [];

  for (let page = 0; page < MAX_CHANGEID_PAGES; page++) {
    const pageQuery = {
      ...(query as object),
      '@changeid': changeId,
    };
    const result = await postPage<T[]>(pageQuery, entityName);
    const pageItems = Array.isArray(result.items)
      ? result.items
      : result.items
        ? [result.items]
        : [];
    items.push(...pageItems);

    if (!result.truncated) {
      return items;
    }

    const nextId = result.lastChangeId;
    if (!nextId || nextId === changeId) {
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
