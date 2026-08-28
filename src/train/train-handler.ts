import { Router, type Request, type Response } from 'express';
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
 *     summary: Get all active train positions
 *     description: >
 *       Complete snapshot of currently active trains (`Status.Active=true`).
 *       Pages Trafikverket with `changeid` until the response is done
 *       (HTTP 206 = too large, continue from `INFO.LASTCHANGEID`; omitted
 *       entity key = empty/done). There is no 59-second `ModifiedTime` window
 *       and no `@limit` cap — this is every active train, not recent updates.
 *       `operator` (and `fromName`/`toName` when known) are joined in bulk from
 *       TrainAnnouncement by advertised train number — not one request per train.
 *     responses:
 *       200:
 *         description: Complete list of active train positions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TrainPositionSnapshot'
 */
/**
 * @openapi
 * /api/positions:
 *   get:
 *     tags:
 *       - Train
 *     summary: Get all active train positions
 *     description: >
 *       Alias of `/api/train/position`. Complete snapshot of currently active
 *       trains (`Status.Active=true`), paged with `changeid` until Trafikverket
 *       is done. Includes bulk-joined `operator` when known.
 *     responses:
 *       200:
 *         description: Complete list of active train positions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TrainPositionSnapshot'
 */
export const getTrainPositions = async (_req: Request, res: Response) => {
  const positions = await fetchTrainPositions();
  return res.json(positions);
};

router.get('/position', getTrainPositions);

export default router;
