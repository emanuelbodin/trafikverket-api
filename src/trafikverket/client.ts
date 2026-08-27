import { stringify } from '@libs/xml';
import type { stringifyable } from '@libs/xml/stringify';
import config from '../config.js';
const API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';

type TrafikverketError = {
  SOURCE?: string;
  MESSAGE?: string;
};

type TrafikverketResult = {
  ERROR?: TrafikverketError;
} & Record<string, unknown>;

type TrafikverketResponse = {
  RESPONSE?: {
    RESULT?: TrafikverketResult[];
  };
};

const post = async <T>(
  query: stringifyable,
  entityName: string
): Promise<T> => {
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

  // 206 is "response too large" (page with changeid), not an empty set.
  if (response.status === 206) {
    throw new Error(
      'Trafikverket response too large (HTTP 206); use changeid to page'
    );
  }

  if (!response.ok) {
    throw new Error(`Trafikverket HTTP ${response.status}`);
  }

  const json = (await response.json()) as TrafikverketResponse;
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
  if (dataToReturn == null) {
    return [] as T;
  }
  return dataToReturn as T;
};

export default { post };
