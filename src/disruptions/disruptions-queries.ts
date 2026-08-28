const trainMessageProperties = [
  'EventId',
  'Header',
  'ExternalDescription',
  'ReasonCode',
  'StartDateTime',
  'EndDateTime',
  'PrognosticatedEndDateTimeTrafficImpact',
  'LastUpdateDateTime',
  'ModifiedTime',
  'TrafficImpact',
  'Deleted',
];

/**
 * Current TrainMessage snapshot. Schema 1.7 has no Rail.TrafficInfo
 * successor (unlike TrainAnnouncement 2.0); omit namespace.
 * Drop historical-only rows: EndDateTime missing or still in the future.
 */
export const getCurrentTrainMessagesQuery = () => {
  return {
    '@objecttype': 'TrainMessage',
    '@schemaversion': '1.7',
    FILTER: {
      OR: {
        EXISTS: {
          '@name': 'EndDateTime',
          '@value': 'false',
        },
        GT: {
          '@name': 'EndDateTime',
          '@value': '$now',
        },
      },
    },
    INCLUDE: trainMessageProperties,
  };
};
