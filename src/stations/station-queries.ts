export const getStationsQuery = () => {
  return {
    '@objecttype': 'TrainStation',
    '@schemaversion': '1.4',
    FILTER: {
      EQ: [{ '@name': 'Advertised', '@value': true }],
    },
    INCLUDE: [
      'AdvertisedLocationName',
      'LocationSignature',
      'Geometry.WGS84',
      'PlatformLine',
      'LocationInformationText',
      'AdvertisedShortLocationName',
    ],
  };
};
