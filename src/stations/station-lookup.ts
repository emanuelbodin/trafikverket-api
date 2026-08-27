type StationMatchFields = {
  locationName: string;
  locationSignature: string;
  shortLocationName?: string | null;
};

export type StationCandidate = {
  id: string;
  name: string;
};

export type StationLookupResult<T extends StationMatchFields = StationMatchFields> =
  | { ok: true; station: T }
  | { ok: false; status: 404; body: { error: string } }
  | {
      ok: false;
      status: 400;
      body: { error: string; candidates: StationCandidate[] };
    };

const normalize = (value: string | undefined | null): string =>
  (value ?? '').normalize('NFC').trim().toLocaleLowerCase('sv');

const toCandidate = (station: StationMatchFields): StationCandidate => ({
  id: station.locationSignature,
  name: station.locationName,
});

const ambiguous = <T extends StationMatchFields>(
  stations: T[]
): StationLookupResult<T> => ({
  ok: false,
  status: 400,
  body: {
    error: 'Ambiguous station',
    candidates: stations
      .map(toCandidate)
      .sort((a, b) => a.name.localeCompare(b.name, 'sv')),
  },
});

const notFound = <T extends StationMatchFields>(): StationLookupResult<T> => ({
  ok: false,
  status: 404,
  body: { error: 'Station not found' },
});

/** Case-insensitive substring match on advertised name, short name, and signature. */
export const filterStations = <T extends StationMatchFields>(
  stations: T[],
  q: string | undefined
): T[] => {
  const needle = normalize(q);
  if (!needle) return stations;

  return stations.filter((station) => {
    return (
      normalize(station.locationName).includes(needle) ||
      normalize(station.shortLocationName).includes(needle) ||
      normalize(station.locationSignature).includes(needle)
    );
  });
};

/**
 * Resolve a path param that may be a signature (`U`, `Cst`) or a name
 * (`Uppsala`, `Stockholm C`). Prefer exact signature, then exact name, then a
 * unique prefix. If several stations still match, do not guess.
 */
export const resolveStationFromList = <T extends StationMatchFields>(
  stations: T[],
  raw: string
): StationLookupResult<T> => {
  const query = normalize(raw);
  if (!query) return notFound();

  const exactSignature = stations.filter(
    (station) => normalize(station.locationSignature) === query
  );
  if (exactSignature.length === 1) {
    return { ok: true, station: exactSignature[0] as T };
  }
  if (exactSignature.length > 1) return ambiguous(exactSignature);

  const exactName = stations.filter(
    (station) =>
      normalize(station.locationName) === query ||
      normalize(station.shortLocationName) === query
  );
  if (exactName.length === 1) {
    return { ok: true, station: exactName[0] as T };
  }
  if (exactName.length > 1) return ambiguous(exactName);

  const prefix = stations.filter((station) => {
    return (
      normalize(station.locationName).startsWith(query) ||
      normalize(station.shortLocationName).startsWith(query) ||
      normalize(station.locationSignature).startsWith(query)
    );
  });
  if (prefix.length === 1) {
    return { ok: true, station: prefix[0] as T };
  }
  if (prefix.length > 1) return ambiguous(prefix);

  return notFound();
};
