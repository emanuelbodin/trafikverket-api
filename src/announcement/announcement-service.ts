import {
  fetchAllStations,
  type StationDto,
} from '../stations/stations-service.js';
import {
  getAnnouncementsForTrainQuery,
  getDeparturesFromStationQuery,
} from './announcement-queries.js';
import type {
  Announcement,
  AnnouncementDto,
  FormattedAnnouncementDto,
} from './announcement.types.ts';
import client from '../trafikverket/client.js';

const buildAnnouncementDto = (announcement: Announcement): AnnouncementDto => {
  return {
    locationSignature: announcement.LocationSignature,
    advertisedTimeAtLocation: announcement.AdvertisedTimeAtLocation,
    estimatedTimeAtLocation: announcement.EstimatedTimeAtLocation,
    advertisedTrainIdent: announcement.AdvertisedTrainIdent,
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
    deviation: {
      code: announcement.Deviation?.Code,
      description: announcement.Deviation?.Description,
    },
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

export const fetchAnnouncementsForTrain = async (trainId: string) => {
  const query = getAnnouncementsForTrainQuery(trainId);
  const announcements = await client.post<Announcement[]>(
    query,
    'TrainAnnouncement'
  );
  const announcementDtos = announcements.map((a) => buildAnnouncementDto(a));
  const stations = await fetchAllStations();
  return getFormattedAnnouncementDtos(announcementDtos, stations);
};

export const fetchDeparturesFromStation = async (
  stationId: string,
  canceled: boolean = false,
  delayed: boolean = false
) => {
  const query = getDeparturesFromStationQuery(stationId, canceled);
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
