import { Router, type Request, type Response } from 'express';
import client from '../trafikverket/client.js';
import { parseMaxAge } from './position-max-age.js';
import { fetchTrainPositions } from './train-service.js';

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     TrainPositionSnapshot:
 *       type: object
 *       properties:
 *         train:
 *           type: object
 *           properties:
 *             operationalTrainNumber:
 *               type: string
 *               description: Operational train number
 *             operationalTrainDepartureDate:
 *               type: string
 *               description: Operational departure date
 *             journeyPlanNumber:
 *               type: string
 *               description: Journey plan number
 *             journeyPlanDepartureDate:
 *               type: string
 *               description: Journey plan departure date
 *             advertisedTrainNumber:
 *               type: string
 *               description: Advertised train number
 *         position:
 *           type: object
 *           properties:
 *             wgs84:
 *               type: string
 *               description: Geographic coordinates in WGS84 format
 *         status:
 *           type: object
 *           properties:
 *             active:
 *               type: boolean
 *               description: Whether the train is currently active
 *         modifiedTime:
 *           type: string
 *           description: Last modified timestamp
 *         speed:
 *           type: number
 *           description: >
 *             Speed in km/h from TrainPosition.Speed, when a finite number
 *         bearing:
 *           type: number
 *           description: >
 *             Absolute direction in degrees from TrainPosition.Bearing, when
 *             a finite number. Not derived from WGS84.
 *         operator:
 *           type: string
 *           description: >
 *             Train operator from TrainAnnouncement.Operator (same string as
 *             GET /api/trains/{trainId}), when known
 *         fromName:
 *           type: string
 *           description: Origin station name, when known
 *         toName:
 *           type: string
 *           description: Destination station name, when known
 */

/**
 * @openapi
 * /api/train/position:
 *   get:
 *     tags:
 *       - Train
 *     summary: Get recent active train positions
 *     description: >
 *       Snapshot of currently active trains (`Status.Active=true`) whose
 *       `ModifiedTime` falls within a recency window (default 5 minutes).
 *       Optional `maxAge` (integer seconds, 30–3600) changes that window.
 *       Duplicate rows for the same operational train
 *       (`operationalTrainNumber` + `operationalTrainDepartureDate`) are
 *       reduced to the latest `modifiedTime`. Pages Trafikverket with
 *       `changeid` until the response is done (HTTP 206 = too large,
 *       continue from `INFO.LASTCHANGEID`; omitted entity key = empty/done).
 *       `operator` (and `fromName`/`toName` when known) are joined in bulk from
 *       TrainAnnouncement by advertised train number — not one request per train.
 *     parameters:
 *       - $ref: '#/components/parameters/TrainPositionMaxAge'
 *     responses:
 *       200:
 *         description: Recent active train positions, one per operational train
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TrainPositionSnapshot'
 *       400:
 *         description: Invalid `maxAge` (not an integer, or outside 30–3600)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
/**
 * @openapi
 * /api/positions:
 *   get:
 *     tags:
 *       - Train
 *     summary: Get recent active train positions
 *     description: >
 *       Alias of `/api/train/position`. Snapshot of currently active trains
 *       (`Status.Active=true`) whose `ModifiedTime` falls within a recency
 *       window (default 5 minutes; optional `maxAge` in seconds, 30–3600).
 *       Duplicate operational trains are reduced to the latest `modifiedTime`.
 *       Paged with `changeid` until Trafikverket is done. Includes bulk-joined
 *       `operator` when known.
 *     parameters:
 *       - $ref: '#/components/parameters/TrainPositionMaxAge'
 *     responses:
 *       200:
 *         description: Recent active train positions, one per operational train
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TrainPositionSnapshot'
 *       400:
 *         description: Invalid `maxAge` (not an integer, or outside 30–3600)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
export const getTrainPositions = async (req: Request, res: Response) => {
  const parsed = parseMaxAge(req.query.maxAge);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }
  const positions = await fetchTrainPositions(client, parsed.seconds);
  return res.json(positions);
};

router.get('/position', getTrainPositions);

export default router;
