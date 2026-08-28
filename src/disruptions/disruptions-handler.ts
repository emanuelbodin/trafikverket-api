import { Router, type Request, type Response } from 'express';
import type { StationLookupResult } from '../stations/station-lookup.js';
import { resolveStation } from '../stations/stations-service.js';
import { fetchCurrentDisruptions } from './disruptions-service.js';

const router = Router();

const sendLookupError = (
  res: Response,
  result: Extract<StationLookupResult, { ok: false }>
) => res.status(result.status).json(result.body);

/**
 * @openapi
 * components:
 *   schemas:
 *     DisruptionStation:
 *       type: object
 *       properties:
 *         signature:
 *           type: string
 *           description: Station location signature (e.g. Cst, U)
 *         name:
 *           type: string
 *           description: Advertised station name from the stations cache
 *     Disruption:
 *       type: object
 *       required:
 *         - id
 *       properties:
 *         id:
 *           type: string
 *           description: Stable Trafikverket event id (TrainMessage.EventId)
 *         header:
 *           type: string
 *           description: Short title when Trafikverket provides one
 *         description:
 *           type: string
 *           description: Readable information text (ExternalDescription)
 *         reason:
 *           type: string
 *           description: >
 *             Readable reason text from ReasonCode.Description, not the
 *             reason code alone
 *         startTime:
 *           type: string
 *           description: Event start time when present
 *         endTime:
 *           type: string
 *           description: Event end time when present
 *         stations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DisruptionStation'
 *           description: Affected stations with names from the stations cache
 *         trains:
 *           type: array
 *           items:
 *             type: string
 *           description: Advertised train numbers when the source includes them
 *         modifiedTime:
 *           type: string
 *           description: Last modified timestamp when present
 */

/**
 * @openapi
 * /api/disruptions:
 *   get:
 *     tags:
 *       - Disruptions
 *     summary: List current railway disruptions
 *     description: >
 *       JSON array of currently relevant railway disruptions (not a 1:1
 *       TrainMessage dump). Historical-only messages are omitted. Empty
 *       upstream is `[]`. Optional `station` uses the same lookup as other
 *       routes (signature, then name, then unique prefix).
 *     parameters:
 *       - in: query
 *         name: station
 *         required: false
 *         schema:
 *           type: string
 *         description: >
 *           Station signature (`U`, `Cst`) or name (`Uppsala`, `Stockholm C`).
 *           URL-encoded names are accepted (e.g. Gävle). When set, only
 *           disruptions that list this station as affected are returned.
 *     responses:
 *       200:
 *         description: Current disruptions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Disruption'
 *       400:
 *         description: Station name is ambiguous
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 candidates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StationCandidate'
 *       404:
 *         description: Station not found
 */
router.get('', async (req: Request, res: Response) => {
  const stationParam =
    typeof req.query.station === 'string' ? req.query.station : undefined;

  let stationSignature: string | undefined;
  if (stationParam !== undefined) {
    const result = await resolveStation(stationParam);
    if (!result.ok) return sendLookupError(res, result);
    stationSignature = result.station.locationSignature;
  }

  const disruptions = await fetchCurrentDisruptions({ stationSignature });
  return res.json(disruptions);
});

export default router;
