import type { AdvertisedTimeWindow } from './advertised-time-window.js';

const trainAnnouncementProperties = [
  'ActivityId',
  'ActivityType',
  'AdvertisedTimeAtLocation',
  'AdvertisedTrainIdent',
  'AdvertisedTrainReference',
  'Operator',
  'OtherInformation',
  'TimeAtLocationWithSeconds',
  'ToLocation',
  'TrackAtLocation',
  'TrainOwner',
  'ViaToLocation',
  'ViaFromLocation',
  'FromLocation',
  'EstimatedTimeAtLocation',
  'EstimatedTimeIsPreliminary',
  'LocationSignature',
  'Canceled',
  'ProductInformation',
  'ModifiedTime',
  'Deviation',
  'OperationalTransportIdentifiers',
  'PlannedEstimatedTimeAtLocation',
  'PlannedEstimatedTimeAtLocationIsValid',
];

const trainAnnouncementQueryBase = {
  '@objecttype': 'TrainAnnouncement',
  '@schemaversion': '2.0',
  '@namespace': 'Rail.TrafficInfo',
  '@orderby': 'AdvertisedTimeAtLocation',
};

const advertisedTimeBounds = (window?: AdvertisedTimeWindow) => {
  const bounds: {
    GT?: { '@name': string; '@value': string };
    LT?: { '@name': string; '@value': string };
  } = {};
  if (window?.from) {
    bounds.GT = {
      '@name': 'AdvertisedTimeAtLocation',
      '@value': window.from,
    };
  }
  if (window?.to) {
    bounds.LT = {
      '@name': 'AdvertisedTimeAtLocation',
      '@value': window.to,
    };
  }
  return bounds;
};

/**
 * Internal snapshot join only — not a client-specified window.
 * Keeps the operator map from requesting all historical announcements.
 */
const internalAdvertisedTimeWindow = advertisedTimeBounds({
  from: '$dateadd(-23:59:59)',
  to: '$dateadd(12:00:00)',
});

export type StationActivityType = 'Avgang' | 'Ankomst';

export const getAnnouncementsAtStationQuery = (
  stationId: string,
  activityType: StationActivityType,
  canceled?: boolean,
  window?: AdvertisedTimeWindow
) => {
  const eq: { '@name': string; '@value': string }[] = [
    { '@name': 'ActivityType', '@value': activityType },
    { '@name': 'LocationSignature', '@value': stationId },
  ];
  if (canceled !== undefined) {
    eq.push({ '@name': 'Canceled', '@value': canceled ? 'true' : 'false' });
  }

  return {
    ...trainAnnouncementQueryBase,
    FILTER: {
      AND: {
        EQ: eq,
        ...advertisedTimeBounds(window),
      },
    },
    INCLUDE: trainAnnouncementProperties,
  };
};

export const getDeparturesFromStationQuery = (
  stationId: string,
  canceled?: boolean,
  window?: AdvertisedTimeWindow
) => getAnnouncementsAtStationQuery(stationId, 'Avgang', canceled, window);

export const getArrivalsAtStationQuery = (
  stationId: string,
  canceled?: boolean,
  window?: AdvertisedTimeWindow
) => getAnnouncementsAtStationQuery(stationId, 'Ankomst', canceled, window);

const getAnnouncementsForTrainFieldQuery = (
  fieldName: 'AdvertisedTrainIdent' | 'AdvertisedTrainReference',
  trainId: string,
  window?: AdvertisedTimeWindow
) => {
  return {
    ...trainAnnouncementQueryBase,
    FILTER: {
      AND: {
        EQ: [{ '@name': fieldName, '@value': trainId }],
        ...advertisedTimeBounds(window),
      },
    },
    INCLUDE: trainAnnouncementProperties,
  };
};

export const getAnnouncementsForTrainQuery = (
  trainId: string,
  window?: AdvertisedTimeWindow
) => getAnnouncementsForTrainFieldQuery('AdvertisedTrainIdent', trainId, window);

export const getAnnouncementsForTrainReferenceQuery = (
  trainId: string,
  window?: AdvertisedTimeWindow
) =>
  getAnnouncementsForTrainFieldQuery(
    'AdvertisedTrainReference',
    trainId,
    window
  );

/** Max AdvertisedTrainIdent values per Trafikverket IN filter (XML length). */
export const TRAIN_IDENT_IN_BATCH_SIZE = 100;

const journeyMetaInclude = [
  'AdvertisedTrainIdent',
  'Operator',
  'ActivityType',
  'LocationSignature',
  'FromLocation',
  'ToLocation',
  'AdvertisedTimeAtLocation',
];

/** Bulk TrainAnnouncement lookup for a snapshot of advertised train numbers. */
export const getAnnouncementsForTrainIdentsQuery = (trainIds: string[]) => {
  return {
    ...trainAnnouncementQueryBase,
    FILTER: {
      AND: {
        IN: {
          '@name': 'AdvertisedTrainIdent',
          '@value': trainIds.join(','),
        },
        ...internalAdvertisedTimeWindow,
      },
    },
    INCLUDE: journeyMetaInclude,
  };
};
