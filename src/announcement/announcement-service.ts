import {
  fetchAllStations,
  type StationDto,
} from '../stations/stations-service.js';
import {
  getAnnouncementsAtStationQuery,
  getAnnouncementsForTrainQuery,
  getAnnouncementsForTrainReferenceQuery,
  type StationActivityType,
} from './announcement-queries.js';
import type {
  Announcement,
  AnnouncementDto,
  FormattedAnnouncementDto,
} from './announcement.types.ts';
import client from '../trafikverket/client.js';

const deviationItems = (deviation: Announcement['Deviation']) => {
  if (!deviation) return [];
  return Array.isArray(deviation) ? deviation : [deviation];
};

const buildDeviationDto = (deviation: Announcement['Deviation']) => {
  const items = deviationItems(deviation).filter(
    (item) => item.Code || item.Description
  );
  const descriptions = items
    .map((item) => item.Description)
    .filter((description): description is string => Boolean(description));
  return {
    code: items[0]?.Code,
    description: descriptions.length ? descriptions.join('. ') : undefined,
  };
};

const buildAnnouncementDto = (announcement: Announcement): AnnouncementDto => {
  return {
    activityId: announcement.ActivityId,
    activityType: announcement.ActivityType,
    locationSignature: announcement.LocationSignature,
    advertisedTimeAtLocation: announcement.AdvertisedTimeAtLocation,
    estimatedTimeAtLocation: announcement.EstimatedTimeAtLocation,
    estimatedTimeIsPreliminary: announcement.EstimatedTimeIsPreliminary,
    advertisedTrainIdent: announcement.AdvertisedTrainIdent,
    advertisedTrainReference: announcement.AdvertisedTrainReference,
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
    deviation: buildDeviationDto(announcement.Deviation),
    operationalTransportIdentifiers:
      announcement.OperationalTransportIdentifiers?.map((id) => ({
        objectType: id.ObjectType,
        company: id.Company,
        core: id.Core,
        variant: id.Variant,
        timetableYear: id.TimetableYear,
        startDate: id.StartDate,
      })),
    plannedEstimatedTimeAtLocation: announcement.PlannedEstimatedTimeAtLocation,
    plannedEstimatedTimeAtLocationIsValid:
      announcement.PlannedEstimatedTimeAtLocationIsValid,
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

const fetchFormattedAnnouncements = async (
  query: ReturnType<typeof getAnnouncementsForTrainQuery>
) => {
  const announcements = await client.post<Announcement[]>(
    query,
    'TrainAnnouncement'
  );
  if (announcements.length === 0) return [];
  const announcementDtos = announcements.map((a) => buildAnnouncementDto(a));
  const stations = await fetchAllStations();
  return getFormattedAnnouncementDtos(announcementDtos, stations);
};

export const fetchAnnouncementsForTrain = async (trainId: string) =>
  fetchFormattedAnnouncements(getAnnouncementsForTrainQuery(trainId));

export const fetchAnnouncementsForTrainReference = async (trainId: string) =>
  fetchFormattedAnnouncements(getAnnouncementsForTrainReferenceQuery(trainId));

/** AdvertisedTrainIdent, or AdvertisedTrainReference when that is a unique match. */
export const resolveAnnouncementsForTrainId = async (trainId: string) => {
  const id = trainId.trim();
  if (!id) return [];

  const byIdent = await fetchAnnouncementsForTrain(id);
  if (byIdent.length > 0) return byIdent;

  const byReference = await fetchAnnouncementsForTrainReference(id);
  const idents = new Set(
    byReference
      .map((announcement) => announcement.advertisedTrainIdent)
      .filter((ident): ident is string => Boolean(ident))
  );
  if (idents.size === 1) return byReference;
  return [];
};

export const fetchAnnouncementsAtStation = async (
  stationId: string,
  activityType: StationActivityType,
  canceled?: boolean,
  delayed: boolean = false
) => {
  const query = getAnnouncementsAtStationQuery(
    stationId,
    activityType,
    canceled
  );
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

export const fetchDeparturesFromStation = (
  stationId: string,
  canceled?: boolean,
  delayed: boolean = false
) => fetchAnnouncementsAtStation(stationId, 'Avgang', canceled, delayed);

export const fetchArrivalsAtStation = (
  stationId: string,
  canceled?: boolean,
  delayed: boolean = false
) => fetchAnnouncementsAtStation(stationId, 'Ankomst', canceled, delayed);

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
