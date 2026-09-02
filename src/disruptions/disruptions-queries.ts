const operativeEventProperties = [
  'OperativeEventId',
  'EventType',
  'StartDateTime',
  'EndDateTime',
  'EventState',
  'EventTrafficType',
  'ModifiedDateTime',
  'ModifiedTime',
  'Deleted',
  'RailRoadTimeForServiceResumption',
  'EventSection.FromLocation.Signature',
  'EventSection.ViaLocation.Signature',
  'EventSection.ToLocation.Signature',
  'TrafficImpact.PublicMessage.Header',
  'TrafficImpact.PublicMessage.Description',
  'TrafficImpact.EndDateTime',
  'TrafficImpact.SelectedSection.FromLocation.Signature',
  'TrafficImpact.SelectedSection.ViaLocation.Signature',
  'TrafficImpact.SelectedSection.ToLocation.Signature',
];

/** Default lookback when filtering messages in JS (StartDateTime). */
export const OPERATIVE_EVENT_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * OperativeEvent snapshot (TrainMessage successor in ols.open v1.0).
 * Upstream filter keeps ongoing rail-related events; ended/old rows are
 * also dropped in JS.
 */
export const getCurrentOperativeEventsQuery = () => {
  return {
    '@objecttype': 'OperativeEvent',
    '@schemaversion': '1.0',
    '@namespace': 'ols.open',
    FILTER: {
      EQ: [{ '@name': 'EventState', '@value': '1' }],
    },
    INCLUDE: operativeEventProperties,
  };
};

/** @deprecated TrainMessage was removed upstream; use getCurrentOperativeEventsQuery. */
export const getCurrentTrainMessagesQuery = getCurrentOperativeEventsQuery;
