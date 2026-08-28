import {
  fetchJourneyMetaByTrainIdents,
  type JourneyMeta,
} from '../announcement/announcement-service.js';
import client from '../trafikverket/client.js';
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
  operator?: string;
  fromName?: string;
  toName?: string;
};

export type TrainPositionRecord = {
  advertisedTrainNumber?: string;
  wgs84?: string;
  speed?: number;
  active?: boolean;
  modifiedTime?: string;
};

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
  if (meta?.operator) dto.operator = meta.operator;
  if (meta?.fromName) dto.fromName = meta.fromName;
  if (meta?.toName) dto.toName = meta.toName;
  return dto;
};

const toTrainPositionRecord = (
  position: TrainPosition
): TrainPositionRecord => {
  const speed =
    typeof position.Speed === 'number' && Number.isFinite(position.Speed)
      ? position.Speed
      : undefined;
  return {
    advertisedTrainNumber: position.Train?.AdvertisedTrainNumber,
    wgs84: position.Position?.WGS84,
    speed,
    active: position.Status?.Active,
    modifiedTime: position.ModifiedTime,
  };
};

const byModifiedTimeDesc = (
  a: TrainPosition,
  b: TrainPosition
): number => {
  const aTime = a.ModifiedTime ?? '';
  const bTime = b.ModifiedTime ?? '';
  return bTime.localeCompare(aTime);
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
  tv: Pick<typeof client, 'postAllPages'> = client
) => {
  const query = getTrainPositionQuery();
  const positions = await tv.postAllPages<TrainPosition>(
    query,
    'TrainPosition'
  );
  if (!Array.isArray(positions)) {
    throw new Error('Expected TrainPosition array from Trafikverket');
  }

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
