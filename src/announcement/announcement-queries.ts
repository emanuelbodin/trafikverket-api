const trainAnnouncementProperties = [
  'ActivityId',
  'ActivityType',
  'AdvertisedTimeAtLocation',
  'AdvertisedTrainIdent',
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
  'LocationSignature',
  'ActivityType',
  'Canceled',
  'ProductInformation',
  'ModifiedTime',
  'Deviation',
];

export const getDeparturesFromStationQuery = (
  stationId: string,
  canceled: boolean
) => {
  return {
    '@objecttype': 'TrainAnnouncement',
    '@schemaversion': '1.9',
    '@orderby': 'AdvertisedTimeAtLocation',
    FILTER: {
      AND: {
        EQ: [
          { '@name': 'ActivityType', '@value': 'Avgang' },
          { '@name': 'LocationSignature', '@value': stationId },
          { '@name': 'Canceled', '@value': canceled },
        ],
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
      },
    },
    INCLUDE: trainAnnouncementProperties,
  };
};

export const getAnnouncementsForTrainQuery = (trainId: string) => {
  return {
    '@objecttype': 'TrainAnnouncement',
    '@schemaversion': '1.8',
    '@orderby': 'AdvertisedTimeAtLocation',
    FILTER: {
      AND: {
        EQ: [{ '@name': 'AdvertisedTrainIdent', '@value': trainId }],
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
      },
    },
    INCLUDE: trainAnnouncementProperties,
  };
};
