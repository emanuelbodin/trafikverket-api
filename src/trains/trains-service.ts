import type { AdvertisedTimeWindow } from '../announcement/advertised-time-window.js';
import { resolveAnnouncementsForTrainId } from '../announcement/announcement-service.js';
import type { FormattedAnnouncementDto } from '../announcement/announcement.types.js';
import {
  fetchLatestTrainPosition,
  parseWgs84Point,
} from '../train/train-service.js';

export type TrainStopActivity = 'departure' | 'arrival';

export type TrainStop = {
  fromName: string;
  toName: string;
  activity?: TrainStopActivity;
  advertisedTime?: string;
  estimatedTime?: string;
  canceled: boolean;
  delayed: boolean;
  track?: string;
  reason?: string;
};

export type TrainJourney = {
  id: string;
  operator?: string;
  fromName: string;
  toName: string;
  canceled: boolean;
  stops: TrainStop[];
};

export type TrainLivePosition = {
  id: string;
  lat?: number;
  lng?: number;
  speed?: number;
  bearing?: number;
  active?: boolean;
  modifiedTime?: string;
};

const activityFromType = (
  activityType: string | undefined
): TrainStopActivity | undefined => {
  if (activityType === 'Avgang') return 'departure';
  if (activityType === 'Ankomst') return 'arrival';
  return undefined;
};

const firstNonEmpty = (
  values: (string | undefined)[]
): string | undefined => values.find((value) => Boolean(value));

export const buildTrainJourney = (
  announcements: FormattedAnnouncementDto[]
): TrainJourney | undefined => {
  if (announcements.length === 0) return undefined;

  const stops: TrainStop[] = announcements.map((announcement) => {
    const advertisedTime = announcement.advertisedTimeAtLocation;
    const estimatedTime = announcement.estimatedTimeAtLocation;
    const delayed = Boolean(
      estimatedTime && advertisedTime && estimatedTime !== advertisedTime
    );
    const stop: TrainStop = {
      fromName: announcement.fromName,
      toName: announcement.toName,
      canceled: Boolean(announcement.canceled),
      delayed,
    };
    const activity = activityFromType(announcement.activityType);
    if (activity) stop.activity = activity;
    if (advertisedTime) stop.advertisedTime = advertisedTime;
    if (estimatedTime) stop.estimatedTime = estimatedTime;
    if (announcement.trackAtLocation) stop.track = announcement.trackAtLocation;
    if (announcement.deviation?.description) {
      stop.reason = announcement.deviation.description;
    }
    return stop;
  });

  return {
    id: announcements[0].advertisedTrainIdent,
    operator: firstNonEmpty(
      announcements.map((announcement) => announcement.operator)
    ),
    fromName: firstNonEmpty(stops.map((stop) => stop.fromName)) ?? '',
    toName: firstNonEmpty(stops.map((stop) => stop.toName)) ?? '',
    canceled: stops.every((stop) => stop.canceled),
    stops,
  };
};

export const fetchTrainJourney = async (
  trainId: string,
  window?: AdvertisedTimeWindow
) => {
  const announcements = await resolveAnnouncementsForTrainId(trainId, window);
  return buildTrainJourney(announcements);
};

export const fetchTrainLivePosition = async (trainId: string) => {
  const id = trainId.trim();
  if (!id) return undefined;

  const announcements = await resolveAnnouncementsForTrainId(id);
  const ident = announcements[0]?.advertisedTrainIdent ?? id;
  const record = await fetchLatestTrainPosition(ident);
  if (!record) return undefined;

  const parsed = parseWgs84Point(record.wgs84);
  const position: TrainLivePosition = {
    id: record.advertisedTrainNumber ?? ident,
  };
  if (parsed) {
    position.lat = parsed.lat;
    position.lng = parsed.lng;
  }
  if (record.speed !== undefined) position.speed = record.speed;
  if (record.bearing !== undefined) position.bearing = record.bearing;
  if (record.active !== undefined) position.active = record.active;
  if (record.modifiedTime) position.modifiedTime = record.modifiedTime;
  return position;
};
