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
  'Deleted',
  // Nested paths keep the payload small vs including the whole TrafficImpact
  // object (FromLocation/ToLocation repeats). Top-level AffectedLocation /
  // AffectedTrain exist on older shapes and are mapped if present.
  'TrafficImpact.AffectedLocation',
  'AffectedLocation',
  'AffectedTrain',
];

/**
 * TrainMessage snapshot. Schema 1.7 has no Rail.TrafficInfo successor
 * (unlike TrainAnnouncement 2.0) and no namespace.
 * No FILTER: EXISTS/GT $now on EndDateTime is a likely upstream error, and
 * ended rows are already dropped in JS (hasEnded).
 */
export const getCurrentTrainMessagesQuery = () => {
  return {
    '@objecttype': 'TrainMessage',
    '@schemaversion': '1.7',
    INCLUDE: trainMessageProperties,
  };
};
