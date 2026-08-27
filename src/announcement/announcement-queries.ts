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

const advertisedTimeWindow = {
  OR: {
    AND: {
      GT: {
        '@name': 'AdvertisedTimeAtLocation',
        '@value': '$dateadd(-23:59:59)',
      },
      LT: {
        '@name': 'AdvertisedTimeAtLocation',
        '@value': '$dateadd(12:00:00)',
      },
    },
  },
};

export type StationActivityType = 'Avgang' | 'Ankomst';

export const getAnnouncementsAtStationQuery = (
  stationId: string,
  activityType: StationActivityType,
  canceled?: boolean
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
        ...advertisedTimeWindow,
      },
    },
    INCLUDE: trainAnnouncementProperties,
  };
};

export const getDeparturesFromStationQuery = (
  stationId: string,
  canceled?: boolean
) => getAnnouncementsAtStationQuery(stationId, 'Avgang', canceled);

export const getArrivalsAtStationQuery = (
  stationId: string,
  canceled?: boolean
) => getAnnouncementsAtStationQuery(stationId, 'Ankomst', canceled);

const getAnnouncementsForTrainFieldQuery = (
  fieldName: 'AdvertisedTrainIdent' | 'AdvertisedTrainReference',
  trainId: string
) => {
  return {
    ...trainAnnouncementQueryBase,
    FILTER: {
      AND: {
        EQ: [{ '@name': fieldName, '@value': trainId }],
        ...advertisedTimeWindow,
      },
    },
    INCLUDE: trainAnnouncementProperties,
  };
};

export const getAnnouncementsForTrainQuery = (trainId: string) =>
  getAnnouncementsForTrainFieldQuery('AdvertisedTrainIdent', trainId);

export const getAnnouncementsForTrainReferenceQuery = (trainId: string) =>
  getAnnouncementsForTrainFieldQuery('AdvertisedTrainReference', trainId);
