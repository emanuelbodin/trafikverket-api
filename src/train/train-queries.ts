export const getTrainPositionQuery = () => {
  return {
    '@objecttype': 'TrainPosition',
    '@schemaversion': '1.1',
    '@namespace': 'järnväg.trafikinfo',
    FILTER: {
      EQ: [{ '@name': 'Status.Active', '@value': 'true' }],
    },
    INCLUDE: ['ModifiedTime', 'Speed', 'Position.WGS84', 'Status', 'Train'],
  };
};

export const getTrainPositionForTrainQuery = (trainId: string) => {
  return {
    '@objecttype': 'TrainPosition',
    '@schemaversion': '1.1',
    '@namespace': 'järnväg.trafikinfo',
    FILTER: {
      AND: {
        EQ: [{ '@name': 'Train.AdvertisedTrainNumber', '@value': trainId }],
        GT: {
          '@name': 'ModifiedTime',
          '@value': '$dateadd(-00:00:59)',
        },
      },
    },
    INCLUDE: ['ModifiedTime', 'Speed', 'Position.WGS84', 'Status', 'Train'],
  };
};
