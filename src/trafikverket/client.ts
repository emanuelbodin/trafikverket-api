import { stringify } from '@libs/xml';
import type { stringifyable } from '@libs/xml/stringify';
import config from '../config.js';
const API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';

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
  const json = await response.json();
  const data = json['RESPONSE']['RESULT'][0];
  const dataToReturn = data[entityName];
  if (!dataToReturn) {
    throw new Error(
      `Could not return the ${entityName} from response from trafikverket`
    );
  }
  return dataToReturn;
};

export default { post };
