import { Router } from 'express';
import { fetchAllStations } from './stations-service.js';

const router = Router();

/**
 * @openapi
 * /api/stations:
 *   get:
 *     tags:
 *       - Stations
 *     summary: Get advertised train stations
 *     description: >
 *       Retrieves TrainStation records where `Advertised` is true.
 *       This is not an unfiltered dump of every station in the Trafikverket dataset.
 *     responses:
 *       200:
 *         description: Successfully retrieved advertised stations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   locationName:
 *                     type: string
 *                     description: Full station name
 *                   locationSignature:
 *                     type: string
 *                     description: Station code/signature
 *                   geometry:
 *                     type: object
 *                     properties:
 *                       WGS84:
 *                         type: string
 *                         description: Geographic coordinates in WGS84 format
 *                   platformLine:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: List of platform lines at this station
 *                   informationText:
 *                     type: string
 *                     description: Additional information about the station
 *                   shortLocationName:
 *                     type: string
 *                     description: Short version of the station name
 */
router.get('', async (_req, res) => {
  const stations = await fetchAllStations();
  return res.json(stations);
});

export default router;
