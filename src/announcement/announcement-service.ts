import {
  fetchAllStations,
  type StationDto,
} from '../stations/stations-service.js';
import {
  getAnnouncementsAtStationQuery,
  getAnnouncementsForTrainIdentsQuery,
  getAnnouncementsForTrainQuery,
  getAnnouncementsForTrainReferenceQuery,
  TRAIN_IDENT_IN_BATCH_SIZE,
  type StationActivityType,
} from './announcement-queries.js';
import type {
  Announcement,
  AnnouncementDto,
  FormattedAnnouncementDto,
} from './announcement.types.ts';
import client from '../trafikverket/client.js';

const deviationItems = (deviation: Announcement['Deviation']) => {
  if (!deviation) return [];
  return Array.isArray(deviation) ? deviation : [deviation];
};

const buildDeviationDto = (deviation: Announcement['Deviation']) => {
  const items = deviationItems(deviation).filter(
    (item) => item.Code || item.Description
  );
  const descriptions = items
    .map((item) => item.Description)
    .filter((description): description is string => Boolean(description));
  return {
    code: items[0]?.Code,
    description: descriptions.length ? descriptions.join('. ') : undefined,
  };
};

const buildAnnouncementDto = (announcement: Announcement): AnnouncementDto => {
  return {
    activityId: announcement.ActivityId,
    activityType: announcement.ActivityType,
    locationSignature: announcement.LocationSignature,
    advertisedTimeAtLocation: announcement.AdvertisedTimeAtLocation,
    estimatedTimeAtLocation: announcement.EstimatedTimeAtLocation,
    estimatedTimeIsPreliminary: announcement.EstimatedTimeIsPreliminary,
    advertisedTrainIdent: announcement.AdvertisedTrainIdent,
    advertisedTrainReference: announcement.AdvertisedTrainReference,
    toLocation: announcement.ToLocation?.map((loc) => ({
      locationName: loc.LocationName,
      priority: loc.Priority,
      order: loc.Order,
    })),
    viaToLocation: announcement.ViaToLocation?.map((loc) => ({
      locationName: loc.LocationName,
      priority: loc.Priority,
      order: loc.Order,
    })),
    trackAtLocation: announcement.TrackAtLocation,
    canceled: announcement.Canceled,
    operator: announcement.Operator,
    otherInformation: announcement.OtherInformation?.map((info) => ({
      code: info.Code,
      description: info.Description,
    })),
    productInformation: announcement.ProductInformation?.map((info) => ({
      code: info.Code,
      description: info.Description,
    })),
    modifiedTime: announcement.ModifiedTime,
    deviation: buildDeviationDto(announcement.Deviation),
    operationalTransportIdentifiers:
      announcement.OperationalTransportIdentifiers?.map((id) => ({
        objectType: id.ObjectType,
        company: id.Company,
        core: id.Core,
        variant: id.Variant,
        timetableYear: id.TimetableYear,
        startDate: id.StartDate,
      })),
    plannedEstimatedTimeAtLocation: announcement.PlannedEstimatedTimeAtLocation,
    plannedEstimatedTimeAtLocationIsValid:
      announcement.PlannedEstimatedTimeAtLocationIsValid,
  };
};

const getFormattedAnnouncementDtos = (
  announcements: AnnouncementDto[],
  stations: StationDto[]
): FormattedAnnouncementDto[] => {
  return announcements.map((announcement) => {
    const fromName =
      stations.find(
        (station) =>
          station.locationSignature === announcement.locationSignature
      )?.locationName ?? '';
    const toName =
      stations.find((station) => {
        return announcement.toLocation?.length > 0
          ? station.locationSignature ===
              announcement.toLocation[0].locationName
          : undefined;
      })?.locationName ?? '';
    return { ...announcement, fromName, toName };
  });
};

const fetchFormattedAnnouncements = async (
  query: ReturnType<typeof getAnnouncementsForTrainQuery>
) => {
  const announcements = await client.post<Announcement[]>(
    query,
    'TrainAnnouncement'
  );
  if (announcements.length === 0) return [];
  const announcementDtos = announcements.map((a) => buildAnnouncementDto(a));
  const stations = await fetchAllStations();
  return getFormattedAnnouncementDtos(announcementDtos, stations);
};

export const fetchAnnouncementsForTrain = async (trainId: string) =>
  fetchFormattedAnnouncements(getAnnouncementsForTrainQuery(trainId));

export const fetchAnnouncementsForTrainReference = async (trainId: string) =>
  fetchFormattedAnnouncements(getAnnouncementsForTrainReferenceQuery(trainId));

/** AdvertisedTrainIdent, or AdvertisedTrainReference when that is a unique match. */
export const resolveAnnouncementsForTrainId = async (trainId: string) => {
  const id = trainId.trim();
  if (!id) return [];

  const byIdent = await fetchAnnouncementsForTrain(id);
  if (byIdent.length > 0) return byIdent;

  const byReference = await fetchAnnouncementsForTrainReference(id);
  const idents = new Set(
    byReference
      .map((announcement) => announcement.advertisedTrainIdent)
      .filter((ident): ident is string => Boolean(ident))
  );
  if (idents.size === 1) return byReference;
  return [];
};

export const fetchAnnouncementsAtStation = async (
  stationId: string,
  activityType: StationActivityType,
  canceled?: boolean,
  delayed: boolean = false
) => {
  const query = getAnnouncementsAtStationQuery(
    stationId,
    activityType,
    canceled
  );
  const res = await client.post<Announcement[]>(query, 'TrainAnnouncement');
  const announcementDtos = res.map((a) => buildAnnouncementDto(a));
  const stations = await fetchAllStations();
  const formattedAnnouncements = getFormattedAnnouncementDtos(
    announcementDtos,
    stations
  );
  if (delayed) return getDelayedAnnouncementDtos(formattedAnnouncements);

  return formattedAnnouncements;
};

export const fetchDeparturesFromStation = (
  stationId: string,
  canceled?: boolean,
  delayed: boolean = false
) => fetchAnnouncementsAtStation(stationId, 'Avgang', canceled, delayed);

export const fetchArrivalsAtStation = (
  stationId: string,
  canceled?: boolean,
  delayed: boolean = false
) => fetchAnnouncementsAtStation(stationId, 'Ankomst', canceled, delayed);

const getDelayedAnnouncementDtos = (
  announcements: FormattedAnnouncementDto[]
) => {
  return announcements.filter((announcement) => {
    return (
      (announcement.estimatedTimeAtLocation &&
        announcement.advertisedTimeAtLocation !==
          announcement.estimatedTimeAtLocation) ||
      announcement.canceled
    );
  });
};

const JOURNEY_META_CACHE_TTL_MS = 45 * 60 * 1000;

export type JourneyMeta = {
  operator?: string;
  fromName?: string;
  toName?: string;
};

type LocationRef = { LocationName?: string };

export type JourneyAnnouncement = {
  AdvertisedTrainIdent?: string;
  Operator?: string;
  ActivityType?: string;
  LocationSignature?: string;
  AdvertisedTimeAtLocation?: string;
  FromLocation?: LocationRef[] | LocationRef;
  ToLocation?: LocationRef[] | LocationRef;
};

type JourneyMetaCache = {
  byIdent: Map<string, JourneyMeta>;
  expiresAt: number;
};

let journeyMetaCache: JourneyMetaCache | null = null;

export const clearJourneyMetaCache = () => {
  journeyMetaCache = null;
};

const asLocationList = (
  value: LocationRef[] | LocationRef | undefined
): LocationRef[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const firstLocationName = (
  value: LocationRef[] | LocationRef | undefined
): string | undefined => {
  const name = asLocationList(value)[0]?.LocationName?.trim();
  return name || undefined;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const resolveStationName = (
  signature: string | undefined,
  stationNameBySignature: Map<string, string>
): string | undefined => {
  if (!signature) return undefined;
  return stationNameBySignature.get(signature);
};

/** First non-empty Operator per advertised train; optional origin/destination names. */
export const buildJourneyMetaMap = (
  announcements: JourneyAnnouncement[],
  stationNameBySignature: Map<string, string> = new Map()
): Map<string, JourneyMeta> => {
  type Acc = {
    operator?: string;
    fromSignature?: string;
    avgangFromSignature?: string;
    toSignature?: string;
  };

  const accByIdent = new Map<string, Acc>();
  const ordered = [...announcements].sort((a, b) =>
    (a.AdvertisedTimeAtLocation ?? '').localeCompare(
      b.AdvertisedTimeAtLocation ?? ''
    )
  );

  for (const announcement of ordered) {
    const ident = announcement.AdvertisedTrainIdent?.trim();
    if (!ident) continue;

    const acc = accByIdent.get(ident) ?? {};
    const operator = announcement.Operator?.trim();
    if (!acc.operator && operator) acc.operator = operator;

    const locationSignature = announcement.LocationSignature?.trim();
    if (locationSignature) {
      if (!acc.fromSignature) acc.fromSignature = locationSignature;
      if (
        !acc.avgangFromSignature &&
        announcement.ActivityType === 'Avgang'
      ) {
        acc.avgangFromSignature = locationSignature;
      }
    }

    const fromLocation = firstLocationName(announcement.FromLocation);
    if (!acc.fromSignature && fromLocation) acc.fromSignature = fromLocation;

    const toLocation = firstLocationName(announcement.ToLocation);
    if (!acc.toSignature && toLocation) acc.toSignature = toLocation;

    accByIdent.set(ident, acc);
  }

  const result = new Map<string, JourneyMeta>();
  for (const [ident, acc] of accByIdent) {
    const meta: JourneyMeta = {};
    if (acc.operator) meta.operator = acc.operator;
    const fromSignature = acc.avgangFromSignature ?? acc.fromSignature;
    const fromName = resolveStationName(fromSignature, stationNameBySignature);
    if (fromName) meta.fromName = fromName;
    const toName = resolveStationName(acc.toSignature, stationNameBySignature);
    if (toName) meta.toName = toName;
    result.set(ident, meta);
  }
  return result;
};

const resolveStationNames = async (
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

/**
 * Bulk-join helpers for the position snapshot. One (batched) TrainAnnouncement
 * query — never per-train HTTP. Cache is 45 min; unknown idents are omitted.
 */
export const fetchJourneyMetaByTrainIdents = async (
  idents: string[],
  tv: Pick<typeof client, 'postAllPages'> = client
): Promise<Map<string, JourneyMeta>> => {
  const unique = [
    ...new Set(idents.map((ident) => ident.trim()).filter(Boolean)),
  ];
  const result = new Map<string, JourneyMeta>();
  if (unique.length === 0) return result;

  const cacheEnabled = tv === client;
  const now = Date.now();
  if (cacheEnabled) {
    if (!journeyMetaCache || now >= journeyMetaCache.expiresAt) {
      journeyMetaCache = {
        byIdent: new Map(),
        expiresAt: now + JOURNEY_META_CACHE_TTL_MS,
      };
    }
  }

  const store = cacheEnabled
    ? journeyMetaCache!.byIdent
    : new Map<string, JourneyMeta>();
  const missing = unique.filter((ident) => !store.has(ident));

  if (missing.length > 0) {
    const stationNames = await resolveStationNames(tv);
    for (const batch of chunk(missing, TRAIN_IDENT_IN_BATCH_SIZE)) {
      try {
        const rows = await tv.postAllPages<JourneyAnnouncement>(
          getAnnouncementsForTrainIdentsQuery(batch),
          'TrainAnnouncement'
        );
        const list = Array.isArray(rows) ? rows : [];
        const mapped = buildJourneyMetaMap(list, stationNames);
        for (const ident of batch) {
          store.set(ident, mapped.get(ident) ?? {});
        }
      } catch {
        // Keep the position snapshot; omit operator for this batch.
      }
    }
  }

  for (const ident of unique) {
    const meta = store.get(ident);
    if (meta) result.set(ident, meta);
  }
  return result;
};
