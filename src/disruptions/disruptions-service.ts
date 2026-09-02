import { fetchAllStations } from '../stations/stations-service.js';
import client from '../trafikverket/client.js';
import { getCurrentTrainMessagesQuery, TRAIN_MESSAGE_LOOKBACK_MS } from './disruptions-queries.js';

export const DISRUPTIONS_CACHE_TTL_MS = 45_000;

export type ReasonCode = {
  Code?: string;
  Description?: string;
};

export type AffectedLocation = {
  LocationSignature?: string;
  LocationName?: string;
  ShouldBeTrafficInformed?: boolean;
};

export type TrafficImpact = {
  IsConfirmed?: boolean;
  FromLocation?: string[] | string;
  ToLocation?: string[] | string;
  AffectedLocation?: AffectedLocation[] | AffectedLocation | string[] | string;
  AffectedTrain?: string[] | string;
  AdvertisedTrainIdent?: string[] | string;
};

export type TrainMessage = {
  EventId?: string;
  Header?: string;
  ExternalDescription?: string;
  ReasonCode?: ReasonCode[] | ReasonCode | string;
  ReasonCodeText?: string;
  StartDateTime?: string;
  EndDateTime?: string;
  PrognosticatedEndDateTimeTrafficImpact?: string;
  LastUpdateDateTime?: string;
  ModifiedTime?: string;
  Deleted?: boolean;
  TrafficImpact?: TrafficImpact[] | TrafficImpact;
  AffectedLocation?: AffectedLocation[] | AffectedLocation | string[] | string;
  AffectedTrain?: string[] | string;
  AdvertisedTrainIdent?: string[] | string;
};

export type DisruptionStation = {
  signature: string;
  name: string;
};

export type DisruptionDto = {
  id: string;
  header?: string;
  description?: string;
  reason?: string;
  startTime?: string;
  endTime?: string;
  stations?: DisruptionStation[];
  trains?: string[];
  modifiedTime?: string;
};

type DisruptionsCache = {
  messages: TrainMessage[];
  expiresAt: number;
};

let disruptionsCache: DisruptionsCache | null = null;

export const clearDisruptionsCache = () => {
  disruptionsCache = null;
};

const asList = <T>(value: T[] | T | undefined | null): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const nonEmpty = (value: string | undefined | null): value is string =>
  Boolean(value && value.trim());

const uniquePreserve = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
};

const collectStrings = (value: unknown): string[] => {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text ? [text] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (typeof value === 'object') {
    const record = value as {
      AdvertisedTrainIdent?: unknown;
      AffectedTrain?: unknown;
    };
    return [
      ...collectStrings(record.AdvertisedTrainIdent),
      ...collectStrings(record.AffectedTrain),
    ];
  }
  return [];
};

const shouldInform = (location: AffectedLocation | string): boolean => {
  if (typeof location === 'string') return true;
  return location.ShouldBeTrafficInformed !== false;
};

const signatureOf = (
  location: AffectedLocation | string
): string | undefined => {
  if (typeof location === 'string') {
    const signature = location.trim();
    return signature || undefined;
  }
  const signature =
    location.LocationSignature?.trim() || location.LocationName?.trim();
  return signature || undefined;
};

const affectedLocations = (
  message: TrainMessage
): Array<AffectedLocation | string> => {
  const fromImpacts = asList(message.TrafficImpact).flatMap((impact) =>
    asList(impact.AffectedLocation)
  );
  const topLevel = asList(message.AffectedLocation);
  return [...fromImpacts, ...topLevel];
};

export const buildDisruptionDto = (
  message: TrainMessage,
  stationNameBySignature: Map<string, string> = new Map()
): DisruptionDto | undefined => {
  const id = message.EventId?.trim();
  if (!id) return undefined;
  if (message.Deleted === true) return undefined;

  const dto: DisruptionDto = { id };

  const header = message.Header?.trim();
  if (header) dto.header = header;

  const description = message.ExternalDescription?.trim();
  if (description) dto.description = description;

  const reasonDescriptions = asList(message.ReasonCode)
    .map((item) =>
      typeof item === 'string' ? item.trim() : item.Description?.trim()
    )
    .filter(nonEmpty);
  const reasonText =
    uniquePreserve(reasonDescriptions).join('. ') ||
    message.ReasonCodeText?.trim();
  if (reasonText) dto.reason = reasonText;

  const startTime = message.StartDateTime?.trim();
  if (startTime) dto.startTime = startTime;

  const endTime =
    message.EndDateTime?.trim() ||
    message.PrognosticatedEndDateTimeTrafficImpact?.trim();
  if (endTime) dto.endTime = endTime;

  const stations = uniquePreserve(
    affectedLocations(message)
      .filter(shouldInform)
      .map(signatureOf)
      .filter(nonEmpty)
  ).map((signature) => ({
    signature,
    name: stationNameBySignature.get(signature) ?? signature,
  }));
  if (stations.length > 0) dto.stations = stations;

  const trains = uniquePreserve([
    ...collectStrings(message.AdvertisedTrainIdent),
    ...collectStrings(message.AffectedTrain),
    ...asList(message.TrafficImpact).flatMap((impact) => [
      ...collectStrings(impact.AdvertisedTrainIdent),
      ...collectStrings(impact.AffectedTrain),
    ]),
  ]);
  if (trains.length > 0) dto.trains = trains;

  const modifiedTime =
    message.ModifiedTime?.trim() || message.LastUpdateDateTime?.trim();
  if (modifiedTime) dto.modifiedTime = modifiedTime;

  return dto;
};

const hasEnded = (endTime: string | undefined, nowMs: number): boolean => {
  if (!endTime) return false;
  const ms = Date.parse(endTime);
  if (!Number.isFinite(ms)) return false;
  return ms <= nowMs;
};

const isTooOld = (startTime: string | undefined, nowMs: number): boolean => {
  if (!startTime) return false;
  const ms = Date.parse(startTime);
  if (!Number.isFinite(ms)) return false;
  return ms < nowMs - TRAIN_MESSAGE_LOOKBACK_MS;
};

export const filterDisruptionsByStation = (
  disruptions: DisruptionDto[],
  stationSignature: string
): DisruptionDto[] => {
  const signature = stationSignature.trim();
  if (!signature) return [];
  return disruptions.filter((disruption) =>
    disruption.stations?.some((station) => station.signature === signature)
  );
};

const loadStationNames = async (
  tv: Pick<typeof client, 'postAllPages'>
): Promise<Map<string, string>> => {
  if (tv !== client) return new Map();
  try {
    const stations = await fetchAllStations();
    return new Map(
      stations.map((station) => [
        station.locationSignature,
        station.locationName,
      ])
    );
  } catch {
    return new Map();
  }
};

const loadMessages = async (
  tv: Pick<typeof client, 'postAllPages'>,
  nowMs: number
): Promise<TrainMessage[]> => {
  if (disruptionsCache && nowMs < disruptionsCache.expiresAt) {
    return disruptionsCache.messages;
  }

  const rows = await tv.postAllPages<TrainMessage>(
    getCurrentTrainMessagesQuery(),
    'TrainMessage',
    { onMissingChangeId: 'return', onPageError: 'return', useChangeId: false }
  );
  const messages = Array.isArray(rows) ? rows : [];
  disruptionsCache = {
    messages,
    expiresAt: nowMs + DISRUPTIONS_CACHE_TTL_MS,
  };
  return messages;
};

export type FetchDisruptionsOptions = {
  tv?: Pick<typeof client, 'postAllPages'>;
  now?: () => number;
  stationSignature?: string;
  stationNameBySignature?: Map<string, string>;
};

export const fetchCurrentDisruptions = async (
  options: FetchDisruptionsOptions = {}
): Promise<DisruptionDto[]> => {
  const tv = options.tv ?? client;
  const now = options.now ?? Date.now;
  const nowMs = now();

  const messages = await loadMessages(tv, nowMs);
  const names =
    options.stationNameBySignature ?? (await loadStationNames(tv));

  const disruptions = messages
    .filter(
      (message) =>
        !hasEnded(message.EndDateTime, nowMs) &&
        !isTooOld(message.StartDateTime, nowMs)
    )
    .map((message) => buildDisruptionDto(message, names))
    .filter((dto): dto is DisruptionDto => Boolean(dto));

  if (options.stationSignature) {
    return filterDisruptionsByStation(disruptions, options.stationSignature);
  }
  return disruptions;
};
