const trainMessageProperties = [
  // EventId is returned by default and rejects INCLUDE on schema 1.7.
  'Header',
  'ExternalDescription',
  'ReasonCode',
  'ReasonCodeText',
  'StartDateTime',
  'EndDateTime',
  'PrognosticatedEndDateTimeTrafficImpact',
  'LastUpdateDateTime',
  'ModifiedTime',
  'Deleted',
  'TrafficImpact.AffectedLocation',
  'TrafficImpact.AffectedTrain',
  'TrafficImpact.AdvertisedTrainIdent',
];

/** Default lookback when building the upstream StartDateTime filter. */
export const TRAIN_MESSAGE_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

export type TrainMessageQueryOptions = {
  /** ISO-8601 lower bound for StartDateTime; omit to fetch the full snapshot. */
  startTimeFrom?: string;
};

/**
 * TrainMessage snapshot. Schema 1.7 has no Rail.TrafficInfo successor
 * (unlike TrainAnnouncement 2.0) and no namespace.
 * EndDateTime/$now filters are avoided (upstream errors); ended rows are
 * dropped in JS (hasEnded). An optional StartDateTime GT bound keeps the
 * snapshot smaller during major incidents.
 */
export const getCurrentTrainMessagesQuery = (
  options: TrainMessageQueryOptions = {}
) => {
  const query: {
    '@objecttype': string;
    '@schemaversion': string;
    INCLUDE: string[];
    FILTER?: {
      GT: { '@name': string; '@value': string };
    };
  } = {
    '@objecttype': 'TrainMessage',
    '@schemaversion': '1.7',
    INCLUDE: trainMessageProperties,
  };

  const startTimeFrom = options.startTimeFrom?.trim();
  if (startTimeFrom) {
    query.FILTER = {
      GT: {
        '@name': 'StartDateTime',
        '@value': startTimeFrom,
      },
    };
  }

  return query;
};
