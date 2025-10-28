import client from '../trafikverket/client.js';
import { getTrainPositionQuery } from './train-queries.js';

type TrainPositionResponse = {
  TrainPosition: TrainPosition[];
};

type TrainPosition = {
  Train: {
    OperationalTrainNumber: string;
    OperationalTrainDepartureDate: string;
    JourneyPlanNumber: string;
    JourneyPlanDepartureDate: string;
    AdvertisedTrainNumber: string;
  };
  Position: {
    WGS84: string;
  };
  Status: {
    Active: boolean;
  };
  ModifiedTime: string;
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
};

const buildTrainPositionDto = (position: TrainPosition): TrainPositionDto => {
  return {
    train: {
      operationalTrainNumber: position.Train.OperationalTrainNumber,
      operationalTrainDepartureDate:
        position.Train.OperationalTrainDepartureDate,
      journeyPlanNumber: position.Train.JourneyPlanNumber,
      journeyPlanDepartureDate: position.Train.JourneyPlanDepartureDate,
      advertisedTrainNumber: position.Train.AdvertisedTrainNumber,
    },
    position: {
      wgs84: position.Position.WGS84,
    },
    status: {
      active: position.Status.Active,
    },
    modifiedTime: position.ModifiedTime,
  };
};

export const fetchTrainPositions = async () => {
  const query = getTrainPositionQuery();
  const res = await client.post<TrainPositionResponse>(query, 'TrainPosition');
  return res.TrainPosition.map((p) => buildTrainPositionDto(p));
};
