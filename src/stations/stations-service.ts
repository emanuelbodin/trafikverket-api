import client from '../trafikverket/client.js';
import { getStationsQuery } from './station-queries.js';
import {
  filterStations,
  resolveStationFromList,
  type StationLookupResult,
} from './station-lookup.js';

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

const STATIONS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let stationsCache: { stations: StationDto[]; expiresAt: number } | null = null;

export const clearStationsCache = () => {
  stationsCache = null;
};

export const fetchAllStations = async () => {
  const now = Date.now();
  if (stationsCache && now < stationsCache.expiresAt) {
    return stationsCache.stations;
  }

  const query = getStationsQuery();
  const stations = await client.post<Station[]>(query, 'TrainStation');
  const stationDtos = stations.map((s) => buildStationDto(s));
  stationsCache = {
    stations: stationDtos,
    expiresAt: now + STATIONS_CACHE_TTL_MS,
  };
  return stationDtos;
};

export const searchStations = async (q?: string) => {
  const stations = await fetchAllStations();
  return filterStations(stations, q);
};

export const resolveStation = async (
  station: string
): Promise<StationLookupResult<StationDto>> => {
  const stations = await fetchAllStations();
  return resolveStationFromList(stations, station);
};
