export const getTrainPositionQuery = () => {
  return {
    '@objecttype': 'TrainPosition',
    '@schemaversion': '1.1',
    '@namespace': 'järnväg.trafikinfo',
    '@limit': '100',
    FILTER: {
      GT: {
        '@name': 'ModifiedTime',
        '@value': '$dateadd(-00:00:59)',
      },
    },
    INCLUDE: ['ModifiedTime', 'Speed', 'Position.WGS84', 'Status', 'Train'],
  };
};
