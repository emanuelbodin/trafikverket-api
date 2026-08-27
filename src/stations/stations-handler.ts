import { Router, type Response } from 'express';
import {
  fetchArrivalsAtStation,
  fetchDeparturesFromStation,
} from '../announcement/announcement-service.js';
import { resolveStation, searchStations } from './stations-service.js';
import type { StationLookupResult } from './station-lookup.js';

const router = Router();

const parseCanceledFilter = (canceled: unknown): boolean | undefined =>
  canceled === 'true' ? true : canceled === 'false' ? false : undefined;

const sendLookupError = (
  res: Response,
  result: Extract<StationLookupResult, { ok: false }>
) => res.status(result.status).json(result.body);

/**
 * @openapi
 * components:
 *   schemas:
 *     Station:
 *       type: object
 *       properties:
 *         locationName:
 *           type: string
 *           description: Advertised station name
 *         locationSignature:
 *           type: string
 *           description: Station id/signature (e.g. U, Cst)
 *         geometry:
 *           type: object
 *           properties:
 *             WGS84:
 *               type: string
 *               description: Geographic coordinates in WGS84 format
 *         platformLine:
 *           type: array
 *           items:
 *             type: string
 *           description: List of platform lines at this station
 *         informationText:
 *           type: string
 *           description: Additional information about the station
 *         shortLocationName:
 *           type: string
 *           description: Short version of the station name
 *     StationCandidate:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Station id/signature
 *         name:
 *           type: string
 *           description: Advertised station name
 */

/**
 * @openapi
 * /api/stations:
 *   get:
 *     tags:
 *       - Stations
 *     summary: List or search advertised train stations
 *     description: >
 *       Returns advertised passenger stations. Use `q` to filter case-insensitively
 *       on advertised name, short name, and signature (e.g. `uppsala`, `U`, `cst`).
 *     parameters:
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *         description: >
 *           Optional search string. Matched case-insensitively against advertised
 *           name, short name, and signature.
 *     responses:
 *       200:
 *         description: Matching advertised stations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Station'
 */
router.get('', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const stations = await searchStations(q);
  return res.json(stations);
});

/**
 * @openapi
 * /api/stations/{station}/departures:
 *   get:
 *     tags:
 *       - Stations
 *     summary: Get departures from a station
 *     description: >
 *       Departures from the given station (name or signature). Same time window
 *       as the legacy announcements route: about 24 hours back and 12 hours ahead.
 *       `canceled` and `delayed` behave as they do on that route.
 *     parameters:
 *       - in: path
 *         name: station
 *         required: true
 *         schema:
 *           type: string
 *         description: >
 *           Station signature (`U`, `Cst`) or name (`Uppsala`, `Stockholm C`).
 *           URL-encoded names are accepted (e.g. Gävle).
 *       - in: query
 *         name: delayed
 *         schema:
 *           type: boolean
 *         description: >
 *           If `true`, keep only departures where estimated time differs from
 *           advertised time, or that are canceled. Any other value (including omit)
 *           does not apply this filter.
 *       - in: query
 *         name: canceled
 *         schema:
 *           type: boolean
 *         description: >
 *           When omitted, both canceled and not-canceled departures are returned.
 *           `true` returns only canceled departures; `false` returns only not-canceled.
 *     responses:
 *       200:
 *         description: Successfully retrieved departures
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Announcement'
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
router.get('/:station/departures', async (req, res) => {
  const result = await resolveStation(req.params.station);
  if (!result.ok) return sendLookupError(res, result);

  const { delayed, canceled } = req.query;
  const departures = await fetchDeparturesFromStation(
    result.station.locationSignature,
    parseCanceledFilter(canceled),
    delayed === 'true'
  );
  return res.json(departures);
});

/**
 * @openapi
 * /api/stations/{station}/arrivals:
 *   get:
 *     tags:
 *       - Stations
 *     summary: Get arrivals at a station
 *     description: >
 *       Arrivals at the given station (name or signature). Same time window,
 *       canceled, and delayed behavior as departures.
 *     parameters:
 *       - in: path
 *         name: station
 *         required: true
 *         schema:
 *           type: string
 *         description: >
 *           Station signature (`U`, `Cst`) or name (`Uppsala`, `Stockholm C`).
 *           URL-encoded names are accepted (e.g. Gävle).
 *       - in: query
 *         name: delayed
 *         schema:
 *           type: boolean
 *         description: >
 *           If `true`, keep only arrivals where estimated time differs from
 *           advertised time, or that are canceled. Any other value (including omit)
 *           does not apply this filter.
 *       - in: query
 *         name: canceled
 *         schema:
 *           type: boolean
 *         description: >
 *           When omitted, both canceled and not-canceled arrivals are returned.
 *           `true` returns only canceled arrivals; `false` returns only not-canceled.
 *     responses:
 *       200:
 *         description: Successfully retrieved arrivals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Announcement'
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
router.get('/:station/arrivals', async (req, res) => {
  const result = await resolveStation(req.params.station);
  if (!result.ok) return sendLookupError(res, result);

  const { delayed, canceled } = req.query;
  const arrivals = await fetchArrivalsAtStation(
    result.station.locationSignature,
    parseCanceledFilter(canceled),
    delayed === 'true'
  );
  return res.json(arrivals);
});

/**
 * @openapi
 * /api/stations/{station}:
 *   get:
 *     tags:
 *       - Stations
 *     summary: Get one station by signature or name
 *     description: >
 *       Resolves a station from the cached station list. Signatures are tried
 *       first (`U`, `Cst`), then an exact name match, then a unique name/signature
 *       prefix. If several names still match, the response is 400 with candidates
 *       rather than guessing. Matching is case-insensitive (including å/Å).
 *     parameters:
 *       - in: path
 *         name: station
 *         required: true
 *         schema:
 *           type: string
 *         description: >
 *           Station signature (`U`, `Cst`) or name (`Uppsala`, `Stockholm C`).
 *           URL-encoded names are accepted (e.g. Gävle).
 *     responses:
 *       200:
 *         description: The matching station
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Station'
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
router.get('/:station', async (req, res) => {
  const result = await resolveStation(req.params.station);
  if (!result.ok) return sendLookupError(res, result);
  return res.json(result.station);
});

export default router;
