import {
  fetchJourneyMetaByTrainIdents,
  type JourneyMeta,
} from '../announcement/announcement-service.js';
import client from '../trafikverket/client.js';
import { DEFAULT_POSITION_MAX_AGE_SECONDS } from './position-max-age.js';
import {
  getTrainPositionForTrainQuery,
  getTrainPositionQuery,
} from './train-queries.js';

type TrainPosition = {
  Train?: {
    OperationalTrainNumber?: string;
    OperationalTrainDepartureDate?: string;
    JourneyPlanNumber?: string;
    JourneyPlanDepartureDate?: string;
    AdvertisedTrainNumber?: string;
  };
  Position?: {
    WGS84?: string;
  };
  Status?: {
    Active?: boolean;
  };
  Speed?: number;
  /** Absolute direction in degrees (TrainPosition 1.1). */
  Bearing?: number;
  ModifiedTime?: string;
};

export type TrainPositionDto = {
  train: {
    operationalTrainNumber: string;
    operationalTrainDepartureDate: string;
    journeyPlanNumber: string;
    journeyPlanDepartureDate: string;
    advertisedTrainNumber: string;
  };
  position: {
    wgs84: string;
  };
  status: {
    active: boolean;
  };
  modifiedTime: string;
  speed?: number;
  bearing?: number;
  operator?: string;
  fromName?: string;
  toName?: string;
};

export type TrainPositionRecord = {
  advertisedTrainNumber?: string;
  wgs84?: string;
  speed?: number;
  bearing?: number;
  active?: boolean;
  modifiedTime?: string;
};

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const buildTrainPositionDto = (
  position: TrainPosition,
  meta?: JourneyMeta
): TrainPositionDto => {
  const dto: TrainPositionDto = {
    train: {
      operationalTrainNumber: position.Train?.OperationalTrainNumber ?? '',
      operationalTrainDepartureDate:
        position.Train?.OperationalTrainDepartureDate ?? '',
      journeyPlanNumber: position.Train?.JourneyPlanNumber ?? '',
      journeyPlanDepartureDate: position.Train?.JourneyPlanDepartureDate ?? '',
      advertisedTrainNumber: position.Train?.AdvertisedTrainNumber ?? '',
    },
    position: {
      wgs84: position.Position?.WGS84 ?? '',
    },
    status: {
      active: position.Status?.Active ?? false,
    },
    modifiedTime: position.ModifiedTime ?? '',
  };
  const speed = finiteNumber(position.Speed);
  const bearing = finiteNumber(position.Bearing);
  if (speed !== undefined) dto.speed = speed;
  if (bearing !== undefined) dto.bearing = bearing;
  if (meta?.operator) dto.operator = meta.operator;
  if (meta?.fromName) dto.fromName = meta.fromName;
  if (meta?.toName) dto.toName = meta.toName;
  return dto;
};

const toTrainPositionRecord = (
  position: TrainPosition
): TrainPositionRecord => {
  const speed = finiteNumber(position.Speed);
  const bearing = finiteNumber(position.Bearing);
  return {
    advertisedTrainNumber: position.Train?.AdvertisedTrainNumber,
    wgs84: position.Position?.WGS84,
    speed,
    bearing,
    active: position.Status?.Active,
    modifiedTime: position.ModifiedTime,
  };
};

const modifiedTimeMs = (value?: string): number | undefined => {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
};

const byModifiedTimeDesc = (
  a: TrainPosition,
  b: TrainPosition
): number => {
  const aMs = modifiedTimeMs(a.ModifiedTime);
  const bMs = modifiedTimeMs(b.ModifiedTime);
  if (aMs != null && bMs != null) return bMs - aMs;
  const aTime = a.ModifiedTime ?? '';
  const bTime = b.ModifiedTime ?? '';
  return bTime.localeCompare(aTime);
};

const trainIdentityKey = (position: TrainPosition): string | undefined => {
  const number = position.Train?.OperationalTrainNumber?.trim() ?? '';
  const date = position.Train?.OperationalTrainDepartureDate?.trim() ?? '';
  if (!number && !date) return undefined;
  return `${number}\0${date}`;
};

/** Keep the latest ModifiedTime row per operational train identity. */
const dedupeLatestPositions = (
  positions: TrainPosition[]
): TrainPosition[] => {
  const latest = new Map<string, TrainPosition>();
  const anonymous: TrainPosition[] = [];

  for (const position of positions) {
    const key = trainIdentityKey(position);
    if (key === undefined) {
      anonymous.push(position);
      continue;
    }
    const existing = latest.get(key);
    if (!existing || byModifiedTimeDesc(position, existing) < 0) {
      latest.set(key, position);
    }
  }

  return [...latest.values(), ...anonymous];
};

/** WKT `POINT (lng lat)` → numeric lat/lng. Trafikverket WGS84 uses lon then lat. */
export const parseWgs84Point = (
  wgs84: string | undefined
): { lat: number; lng: number } | undefined => {
  if (!wgs84) return undefined;
  const match = wgs84.match(
    /POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)/i
  );
  if (!match) return undefined;
  const lng = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
};

export const fetchTrainPositions = async (
  tv: Pick<typeof client, 'postAllPages'> = client,
  maxAgeSeconds: number = DEFAULT_POSITION_MAX_AGE_SECONDS
) => {
  const query = getTrainPositionQuery(maxAgeSeconds);
  const rawPositions = await tv.postAllPages<TrainPosition>(
    query,
    'TrainPosition'
  );
  if (!Array.isArray(rawPositions)) {
    throw new Error('Expected TrainPosition array from Trafikverket');
  }

  const positions = dedupeLatestPositions(rawPositions);

  const idents = [
    ...new Set(
      positions
        .map((position) => position.Train?.AdvertisedTrainNumber?.trim())
        .filter((ident): ident is string => Boolean(ident))
    ),
  ];

  let metaByIdent = new Map<string, JourneyMeta>();
  try {
    metaByIdent = await fetchJourneyMetaByTrainIdents(idents, tv);
  } catch {
    metaByIdent = new Map();
  }

  return positions.map((position) =>
    buildTrainPositionDto(
      position,
      metaByIdent.get(position.Train?.AdvertisedTrainNumber?.trim() ?? '')
    )
  );
};

export const fetchLatestTrainPosition = async (
  trainId: string
): Promise<TrainPositionRecord | undefined> => {
  const query = getTrainPositionForTrainQuery(trainId);
  const positions = await client.post<TrainPosition[]>(query, 'TrainPosition');
  if (positions.length === 0) return undefined;
  const latest = [...positions].sort(byModifiedTimeDesc)[0];
  return toTrainPositionRecord(latest);
};
