import { Router } from 'express';
import { fetchTrainPositions } from './train-service.js';

const router = Router();

/**
 * @openapi
 * /api/train/position:
 *   get:
 *     tags:
 *       - Train
 *     summary: Get train positions
 *     description: Retrieves current positions of all active trains
 *     responses:
 *       200:
 *         description: Successfully retrieved train positions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   train:
 *                     type: object
 *                     properties:
 *                       operationalTrainNumber:
 *                         type: string
 *                         description: Operational train number
 *                       operationalTrainDepartureDate:
 *                         type: string
 *                         description: Operational departure date
 *                       journeyPlanNumber:
 *                         type: string
 *                         description: Journey plan number
 *                       journeyPlanDepartureDate:
 *                         type: string
 *                         description: Journey plan departure date
 *                       advertisedTrainNumber:
 *                         type: string
 *                         description: Advertised train number
 *                   position:
 *                     type: object
 *                     properties:
 *                       wgs84:
 *                         type: string
 *                         description: Geographic coordinates in WGS84 format
 *                   status:
 *                     type: object
 *                     properties:
 *                       active:
 *                         type: boolean
 *                         description: Whether the train is currently active
 *                   modifiedTime:
 *                     type: string
 *                     description: Last modified timestamp
 */
router.get('/position', async (req, res) => {
  const positions = await fetchTrainPositions();
  return res.json(positions);
});

export default router;
