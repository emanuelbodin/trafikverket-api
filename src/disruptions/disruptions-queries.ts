/** Default lookback when filtering messages in JS (StartDateTime). */
export const TRAIN_MESSAGE_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

export type TrainMessageQueryOptions = Record<string, never>;

/**
 * TrainMessage snapshot. Schema 1.7 has no Rail.TrafficInfo successor
 * (unlike TrainAnnouncement 2.0) and no namespace.
 * TrainMessage rejects INCLUDE on 1.7 (Invalid query attribute …), so the
 * snapshot is unfiltered upstream; ended/old rows are dropped in JS.
 */
export const getCurrentTrainMessagesQuery = (
  _options: TrainMessageQueryOptions = {}
) => {
  return {
    '@objecttype': 'TrainMessage',
    '@schemaversion': '1.7',
  };
};
