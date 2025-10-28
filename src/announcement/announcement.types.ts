export type Announcement = {
  LocationSignature: string;
  AdvertisedTimeAtLocation: string;
  EstimatedTimeAtLocation: string;
  AdvertisedTrainIdent: string;
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
};

export interface FormattedAnnouncement extends Announcement {
  fromName: string;
  toName: string;
}

export type AnnouncementDto = {
  locationSignature: string;
  advertisedTimeAtLocation: string;
  estimatedTimeAtLocation: string;
  advertisedTrainIdent: string;
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
};

export interface FormattedAnnouncementDto extends AnnouncementDto {
  fromName: string;
  toName: string;
}
