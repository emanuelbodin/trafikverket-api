import { fetchAllStations } from '../stations/stations-service.js';
import client from '../trafikverket/client.js';
import {
  getCurrentOperativeEventsQuery,
  OPERATIVE_EVENT_LOOKBACK_MS,
} from './disruptions-queries.js';

export const DISRUPTIONS_CACHE_TTL_MS = 45_000;
export const TRAIN_MESSAGE_LOOKBACK_MS = OPERATIVE_EVENT_LOOKBACK_MS;

export type EventType = {
  Description?: string;
  EventTypeCode?: string;
};

export type LocationRef = {
  Signature?: string;
  LocationSignature?: string;
  LocationName?: string;
  ShouldBeTrafficInformed?: boolean;
};

export type EventSection = {
  FromLocation?: LocationRef;
  ViaLocation?: LocationRef;
  ToLocation?: LocationRef;
};

export type PublicMessage = {
  Header?: string;
  Description?: string;
};

export type SelectedSection = {
  FromLocation?: LocationRef;
  ViaLocation?: LocationRef;
  ToLocation?: LocationRef;
  IntermediateLocation?: LocationRef[] | LocationRef;
};

export type OperativeTrafficImpact = {
  PublicMessage?: PublicMessage;
  EndDateTime?: string;
  SelectedSection?: SelectedSection[] | SelectedSection;
  AffectedLocation?: LocationRef[] | LocationRef | string[] | string;
  AffectedTrain?: string[] | string;
  AdvertisedTrainIdent?: string[] | string;
};

/** Upstream OperativeEvent row (TrainMessage successor). */
export type OperativeEvent = {
  OperativeEventId?: string;
  EventType?: EventType;
  StartDateTime?: string;
  EndDateTime?: string;
  EventState?: number | string;
  EventTrafficType?: number | string;
  ModifiedDateTime?: string;
  ModifiedTime?: string;
  Deleted?: boolean;
  RailRoadTimeForServiceResumption?: string;
  EventSection?: EventSection[] | EventSection;
  TrafficImpact?: OperativeTrafficImpact[] | OperativeTrafficImpact;
};

/** Legacy TrainMessage test/fixture shape still mapped by buildDisruptionDto. */
export type TrainMessage = OperativeEvent & {
  EventId?: string;
  Header?: string;
  ExternalDescription?: string;
  ReasonCode?: { Code?: string; Description?: string }[] | { Code?: string; Description?: string } | string;
  ReasonCodeText?: string;
  PrognosticatedEndDateTimeTrafficImpact?: string;
  LastUpdateDateTime?: string;
  AffectedLocation?: LocationRef[] | LocationRef | string[] | string;
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
  events: OperativeEvent[];
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
      Signature?: unknown;
      AdvertisedTrainIdent?: unknown;
      AffectedTrain?: unknown;
    };
    return [
      ...collectStrings(record.Signature),
      ...collectStrings(record.AdvertisedTrainIdent),
      ...collectStrings(record.AffectedTrain),
    ];
  }
  return [];
};

const signatureOf = (location: LocationRef | string): string | undefined => {
  if (typeof location === 'string') {
    const signature = location.trim();
    return signature || undefined;
  }
  const signature =
    location.Signature?.trim() ||
    location.LocationSignature?.trim() ||
    location.LocationName?.trim();
  return signature || undefined;
};

const sectionSignatures = (section: EventSection | SelectedSection): string[] => {
  const locations = [
    section.FromLocation,
    section.ViaLocation,
    section.ToLocation,
  ];
  if ('IntermediateLocation' in section) {
    locations.push(...asList(section.IntermediateLocation));
  }
  return locations.flatMap((location) => collectStrings(location)).filter(nonEmpty);
};

const shouldInform = (location: LocationRef | string): boolean => {
  if (typeof location === 'string') return true;
  return location.ShouldBeTrafficInformed !== false;
};

const affectedSignatures = (event: TrainMessage): string[] => {
  const fromSections = asList(event.EventSection).flatMap(sectionSignatures);
  const fromImpacts = asList(event.TrafficImpact).flatMap((impact) => [
    ...asList(impact.SelectedSection).flatMap(sectionSignatures),
    ...asList(impact.AffectedLocation)
      .filter(shouldInform)
      .map(signatureOf)
      .filter(nonEmpty),
  ]);
  const legacy = asList(event.AffectedLocation)
    .filter(shouldInform)
    .map(signatureOf)
    .filter(nonEmpty);
  return [...fromSections, ...fromImpacts, ...legacy];
};

const publicMessages = (
  event: TrainMessage
): PublicMessage[] =>
  asList(event.TrafficImpact)
    .map((impact) => impact.PublicMessage)
    .filter((message): message is PublicMessage => Boolean(message));

export const buildDisruptionDto = (
  event: TrainMessage,
  stationNameBySignature: Map<string, string> = new Map()
): DisruptionDto | undefined => {
  const id = event.OperativeEventId?.trim() || event.EventId?.trim();
  if (!id) return undefined;
  if (event.Deleted === true) return undefined;

  const dto: DisruptionDto = { id };
  const messages = publicMessages(event);

  const header =
    messages.map((message) => message.Header?.trim()).find(nonEmpty) ||
    event.Header?.trim() ||
    event.EventType?.Description?.trim();
  if (header) dto.header = header;

  const description =
    messages.map((message) => message.Description?.trim()).find(nonEmpty) ||
    event.ExternalDescription?.trim();
  if (description) dto.description = description;

  const reasonDescriptions = asList(event.ReasonCode)
    .map((item) =>
      typeof item === 'string' ? item.trim() : item.Description?.trim()
    )
    .filter(nonEmpty);
  const reasonText =
    uniquePreserve(reasonDescriptions).join('. ') ||
    event.ReasonCodeText?.trim() ||
    event.EventType?.Description?.trim();
  if (reasonText) dto.reason = reasonText;

  const startTime = event.StartDateTime?.trim();
  if (startTime) dto.startTime = startTime;

  const endTime =
    event.EndDateTime?.trim() ||
    event.RailRoadTimeForServiceResumption?.trim() ||
    event.PrognosticatedEndDateTimeTrafficImpact?.trim() ||
    asList(event.TrafficImpact)
      .map((impact) => impact.EndDateTime?.trim())
      .find(nonEmpty);
  if (endTime) dto.endTime = endTime;

  const stations = uniquePreserve(affectedSignatures(event).filter(nonEmpty)).map(
    (signature) => ({
      signature,
      name: stationNameBySignature.get(signature) ?? signature,
    })
  );
  if (stations.length > 0) dto.stations = stations;

  const trains = uniquePreserve([
    ...collectStrings(event.AdvertisedTrainIdent),
    ...collectStrings(event.AffectedTrain),
    ...asList(event.TrafficImpact).flatMap((impact) => [
      ...collectStrings(impact.AdvertisedTrainIdent),
      ...collectStrings(impact.AffectedTrain),
    ]),
  ]);
  if (trains.length > 0) dto.trains = trains;

  const modifiedTime =
    event.ModifiedDateTime?.trim() ||
    event.ModifiedTime?.trim() ||
    event.LastUpdateDateTime?.trim();
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
  return ms < nowMs - OPERATIVE_EVENT_LOOKBACK_MS;
};

const isRailRelated = (event: OperativeEvent): boolean => {
  const trafficType = Number(event.EventTrafficType);
  return trafficType === 0 || trafficType === 2 || Number.isNaN(trafficType);
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

const loadEvents = async (
  tv: Pick<typeof client, 'postAllPages'>,
  nowMs: number
): Promise<OperativeEvent[]> => {
  if (disruptionsCache && nowMs < disruptionsCache.expiresAt) {
    return disruptionsCache.events;
  }

  const rows = await tv.postAllPages<OperativeEvent>(
    getCurrentOperativeEventsQuery(),
    'OperativeEvent',
    { onMissingChangeId: 'return', onPageError: 'return' }
  );
  const events = Array.isArray(rows) ? rows : [];
  disruptionsCache = {
    events,
    expiresAt: nowMs + DISRUPTIONS_CACHE_TTL_MS,
  };
  return events;
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

  const events = await loadEvents(tv, nowMs);
  const names =
    options.stationNameBySignature ?? (await loadStationNames(tv));

  const disruptions = events
    .filter((event) => isRailRelated(event))
    .filter(
      (event) =>
        !hasEnded(event.EndDateTime, nowMs) &&
        !isTooOld(event.StartDateTime, nowMs)
    )
    .map((event) => buildDisruptionDto(event, names))
    .filter((dto): dto is DisruptionDto => Boolean(dto));

  if (options.stationSignature) {
    return filterDisruptionsByStation(disruptions, options.stationSignature);
  }
  return disruptions;
};
