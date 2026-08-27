export type Announcement = {
  ActivityId: string;
  LocationSignature: string;
  AdvertisedTimeAtLocation: string;
  EstimatedTimeAtLocation: string;
  EstimatedTimeIsPreliminary: boolean;
  AdvertisedTrainIdent: string;
  AdvertisedTrainReference: string;
  ToLocation: {
    LocationName: string;
    Priority: number;
    Order: number;
  }[];
  ViaToLocation: { LocationName: string; Priority: number; Order: number }[];
  TrackAtLocation: string;
  Canceled: boolean;
  Operator: string;
  OtherInformation: { Code: string; Description: string }[];
  ProductInformation: { Code: string; Description: string }[];
  ModifiedTime: string;
  Deviation: { Code: string; Description: string };
  OperationalTransportIdentifiers: {
    ObjectType: string;
    Company: string;
    Core: string;
    Variant: string;
    TimetableYear: number;
    StartDate: string;
  }[];
  PlannedEstimatedTimeAtLocation: string;
  PlannedEstimatedTimeAtLocationIsValid: boolean;
};

export interface FormattedAnnouncement extends Announcement {
  fromName: string;
  toName: string;
}

export type AnnouncementDto = {
  activityId: string;
  locationSignature: string;
  advertisedTimeAtLocation: string;
  estimatedTimeAtLocation: string;
  estimatedTimeIsPreliminary: boolean;
  advertisedTrainIdent: string;
  advertisedTrainReference: string;
  toLocation: {
    locationName: string;
    priority: number;
    order: number;
  }[];
  viaToLocation: { locationName: string; priority: number; order: number }[];
  trackAtLocation: string;
  canceled: boolean;
  operator: string;
  otherInformation: { code: string; description: string }[];
  productInformation: { code: string; description: string }[];
  modifiedTime: string;
  deviation: { code: string; description: string };
  operationalTransportIdentifiers: {
    objectType: string;
    company: string;
    core: string;
    variant: string;
    timetableYear: number;
    startDate: string;
  }[];
  plannedEstimatedTimeAtLocation: string;
  plannedEstimatedTimeAtLocationIsValid: boolean;
};

export interface FormattedAnnouncementDto extends AnnouncementDto {
  fromName: string;
  toName: string;
}
