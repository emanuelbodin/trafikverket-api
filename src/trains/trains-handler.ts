import { Router } from 'express';
import { fetchTrainJourney, fetchTrainLivePosition } from './trains-service.js';

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     TrainStop:
 *       type: object
 *       properties:
 *         fromName:
 *           type: string
 *           description: Station name at this stop
 *         toName:
 *           type: string
 *           description: Train destination name
 *         activity:
 *           type: string
 *           enum: [departure, arrival]
 *           description: Whether this row is a departure or an arrival
 *         advertisedTime:
 *           type: string
 *           description: Scheduled time at this stop
 *         estimatedTime:
 *           type: string
 *           description: Estimated time at this stop, when it differs or is known
 *         canceled:
 *           type: boolean
 *           description: Whether this stop is canceled
 *         delayed:
 *           type: boolean
 *           description: True when estimated time differs from advertised time
 *         track:
 *           type: string
 *           description: Track/platform at this stop
 *         reason:
 *           type: string
 *           description: Readable delay/cancel reason from Deviation.Description
 *     TrainJourney:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Advertised train id
 *         operator:
 *           type: string
 *           description: Train operator
 *         fromName:
 *           type: string
 *           description: Origin station name
 *         toName:
 *           type: string
 *           description: Destination station name
 *         canceled:
 *           type: boolean
 *           description: True when every stop on the journey is canceled
 *         stops:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TrainStop'
 *     TrainLivePosition:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Advertised train id
 *         lat:
 *           type: number
 *           description: Latitude parsed from WGS84 POINT (lng lat)
 *         lng:
 *           type: number
 *           description: Longitude parsed from WGS84 POINT (lng lat)
 *         speed:
 *           type: number
 *           description: Speed from TrainPosition, when present
 *         bearing:
 *           type: number
 *           description: Absolute direction in degrees from TrainPosition.Bearing, when present
 *         active:
 *           type: boolean
 *           description: Whether the train is currently active
 *         modifiedTime:
 *           type: string
 *           description: Last modified timestamp of the position
 */

/**
 * @openapi
 * /api/trains/{trainId}/position:
 *   get:
 *     tags:
 *       - Trains
 *     summary: Get the latest position for one train
 *     description: >
 *       Latest TrainPosition for this advertised train id, filtered at Trafikverket
 *       by advertised train number. ModifiedTime within the last 59 seconds.
 *       `trainId` is AdvertisedTrainIdent, or AdvertisedTrainReference when that
 *       is a unique match. Lat/lng are parsed from WGS84 when possible.
 *     parameters:
 *       - in: path
 *         name: trainId
 *         required: true
 *         schema:
 *           type: string
 *         description: Advertised train id, or a unique advertised train reference
 *     responses:
 *       200:
 *         description: Latest position for the train
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrainLivePosition'
 *       404:
 *         description: No recent position for this train
 */
router.get('/:trainId/position', async (req, res) => {
  const { trainId } = req.params;
  const position = await fetchTrainLivePosition(trainId);
  if (!position) {
    return res.status(404).json({ error: 'Train position not found' });
  }
  return res.json(position);
});

/**
 * @openapi
 * /api/trains/{trainId}:
 *   get:
 *     tags:
 *       - Trains
 *     summary: Get one train as a list of stops
 *     description: >
 *       Journey for this advertised train id, built from TrainAnnouncement 2.0
 *       (same time window as `/api/announcements/train/{trainId}`). `trainId` is
 *       AdvertisedTrainIdent, or AdvertisedTrainReference when that is a unique
 *       match. Each stop includes station names (`fromName`, `toName`), advertised
 *       vs estimated time, canceled/delayed flags, and a readable `reason` from
 *       Deviation.Description when present.
 *     parameters:
 *       - in: path
 *         name: trainId
 *         required: true
 *         schema:
 *           type: string
 *         description: Advertised train id, or a unique advertised train reference
 *     responses:
 *       200:
 *         description: The train journey
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrainJourney'
 *       404:
 *         description: No announcements for this train
 */
router.get('/:trainId', async (req, res) => {
  const { trainId } = req.params;
  const journey = await fetchTrainJourney(trainId);
  if (!journey) {
    return res.status(404).json({ error: 'Train not found' });
  }
  return res.json(journey);
});

export default router;
