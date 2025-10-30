import { Router } from 'express';
import {
  fetchAnnouncementsForTrain,
  fetchDeparturesFromStation,
} from './announcement-service.js';

const router = Router();

/**
 * @openapi
 * /api/announcements/departures/{from}:
 *   get:
 *     tags:
 *       - Announcements
 *     summary: Get departures from a station
 *     description: Retrieves departure information for trains from a specific station
 *     parameters:
 *       - in: path
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: Station code or name
 *       - in: query
 *         name: delayed
 *         schema:
 *           type: boolean
 *         description: Filter for delayed trains
 *       - in: query
 *         name: canceled
 *         schema:
 *           type: boolean
 *         description: Filter for canceled trains
 *       - in: query
 *         name: json
 *         schema:
 *           type: boolean
 *         description: Return JSON response instead of HTML
 *     responses:
 *       200:
 *         description: Successfully retrieved departures
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   activityId:
 *                     type: string
 *                   locationSignature:
 *                     type: string
 *                     description: Station code/signature
 *                   advertisedTimeAtLocation:
 *                     type: string
 *                     description: Scheduled time at location
 *                   estimatedTimeAtLocation:
 *                     type: string
 *                     description: Estimated time at location
 *                   advertisedTrainIdent:
 *                     type: string
 *                     description: Train identifier
 *                   toLocation:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         locationName:
 *                           type: string
 *                         priority:
 *                           type: number
 *                         order:
 *                           type: number
 *                     description: Destination locations
 *                   viaToLocation:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         locationName:
 *                           type: string
 *                         priority:
 *                           type: number
 *                         order:
 *                           type: number
 *                     description: Via locations
 *                   trackAtLocation:
 *                     type: string
 *                     description: Track/platform number
 *                   canceled:
 *                     type: boolean
 *                     description: Whether the train is canceled
 *                   operator:
 *                     type: string
 *                     description: Train operator
 *                   otherInformation:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                         description:
 *                           type: string
 *                     description: Additional information
 *                   productInformation:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                         description:
 *                           type: string
 *                     description: Product information
 *                   modifiedTime:
 *                     type: string
 *                     description: Last modified timestamp
 *                   deviation:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                       description:
 *                         type: string
 *                     description: Deviation information
 *           text/html:
 *             schema:
 *               type: string
 *       500:
 *         description: Failed to fetch departures
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/departures/:from', async (req, res) => {
  const from = req.params.from;
  const { delayed, canceled } = req.query as {
    delayed?: string;
    canceled?: string;
  };
  const departures = await fetchDeparturesFromStation(
    from,
    canceled?.toString() === 'true',
    delayed?.toString() === 'true'
  );
  return res.json(departures);
});

/**
 * @openapi
 * /api/announcements/train/{trainId}:
 *   get:
 *     tags:
 *       - Announcements
 *     summary: Get announcements for a specific train
 *     description: Retrieves all announcements and information for a specific train
 *     parameters:
 *       - in: path
 *         name: trainId
 *         required: true
 *         schema:
 *           type: string
 *         description: Train identifier/number
 *     responses:
 *       200:
 *         description: Successfully retrieved train announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   locationSignature:
 *                     type: string
 *                     description: Station code/signature
 *                   advertisedTimeAtLocation:
 *                     type: string
 *                     description: Scheduled time at location
 *                   estimatedTimeAtLocation:
 *                     type: string
 *                     description: Estimated time at location
 *                   advertisedTrainIdent:
 *                     type: string
 *                     description: Train identifier
 *                   toLocation:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         locationName:
 *                           type: string
 *                         priority:
 *                           type: number
 *                         order:
 *                           type: number
 *                     description: Destination locations
 *                   viaToLocation:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         locationName:
 *                           type: string
 *                         priority:
 *                           type: number
 *                         order:
 *                           type: number
 *                     description: Via locations
 *                   trackAtLocation:
 *                     type: string
 *                     description: Track/platform number
 *                   canceled:
 *                     type: boolean
 *                     description: Whether the train is canceled
 *                   operator:
 *                     type: string
 *                     description: Train operator
 *                   otherInformation:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                         description:
 *                           type: string
 *                     description: Additional information
 *                   productInformation:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         code:
 *                           type: string
 *                         description:
 *                           type: string
 *                     description: Product information
 *                   modifiedTime:
 *                     type: string
 *                     description: Last modified timestamp
 *                   deviation:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                       description:
 *                         type: string
 *                     description: Deviation information
 *                   fromName:
 *                     type: string
 *                     description: Departure station name
 *                   toName:
 *                     type: string
 *                     description: Destination station name
 *       500:
 *         description: Failed to fetch announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/train/:trainId', async (req, res) => {
  const { trainId } = req.params;
  const departures = await fetchAnnouncementsForTrain(trainId);
  return res.json(departures);
});

export default router;
