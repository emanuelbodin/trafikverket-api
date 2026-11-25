import {
  DEFAULT_POSITION_MAX_AGE_SECONDS,
  toDateAddOffset,
} from './position-max-age.js';

export const getTrainPositionQuery = (
  maxAgeSeconds: number = DEFAULT_POSITION_MAX_AGE_SECONDS
) => {
  return {
    '@objecttype': 'TrainPosition',
    '@schemaversion': '1.1',
    '@namespace': 'järnväg.trafikinfo',
    FILTER: {
      AND: {
        EQ: [{ '@name': 'Status.Active', '@value': 'true' }],
        GT: {
          '@name': 'ModifiedTime',
          '@value': toDateAddOffset(maxAgeSeconds),
        },
      },
    },
    INCLUDE: [
      'ModifiedTime',
      'Speed',
      'Bearing',
      'Position.WGS84',
      'Status',
      'Train',
    ],
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
    INCLUDE: [
      'ModifiedTime',
      'Speed',
      'Bearing',
      'Position.WGS84',
      'Status',
      'Train',
    ],
  };
};
