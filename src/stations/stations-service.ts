import client from '../trafikverket/client.js';
import { getStationsQuery } from './station-queries.js';

export type Station = {
  AdvertisedLocationName: string;
  LocationSignature: string;
  Geometry: { WGS84: string };
  PlatformLine: string[];
  LocationInformationText: string;
  AdvertisedShortLocationName: string;
};

export type StationDto = {
  locationName: string;
  locationSignature: string;
  geometry: { WGS84: string };
  platformLine: string[];
  informationText: string;
  shortLocationName: string;
};

const buildStationDto = (station: Station): StationDto => {
  return {
    locationName: station.AdvertisedLocationName,
    locationSignature: station.LocationSignature,
    geometry: station.Geometry,
    platformLine: station.PlatformLine,
    informationText: station.LocationInformationText,
    shortLocationName: station.AdvertisedShortLocationName,
  };
};

export const fetchAllStations = async () => {
  const query = getStationsQuery();
  const stations = await client.post<Station[]>(query, 'TrainStation');
  return stations.map((s) => buildStationDto(s));
};
