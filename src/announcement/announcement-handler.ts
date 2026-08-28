import { Router } from 'express';
import { parseAdvertisedTimeWindow } from './advertised-time-window.js';
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
 *     description: >
 *       Retrieves departure announcements (`ActivityType=Avgang`) for a station.
 *       Optional `from` and `to` query params filter `AdvertisedTimeAtLocation`
 *       (`GT` / `LT`). When both are omitted, no advertised-time filter is applied.
 *       Station names (`fromName`, `toName`) are resolved from the stations list.
 *       Always returns JSON.
 *     parameters:
 *       - in: path
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: Station LocationSignature (e.g. Cst), not the station display name
 *       - $ref: '#/components/parameters/AdvertisedTimeFrom'
 *       - $ref: '#/components/parameters/AdvertisedTimeTo'
 *       - in: query
 *         name: delayed
 *         schema:
 *           type: boolean
 *         description: >
 *           If `true`, keep only announcements where estimated time differs from
 *           advertised time, or that are canceled. Compared after the Trafikverket
 *           query. Any other value (including omit) does not apply this filter.
 *       - in: query
 *         name: canceled
 *         schema:
 *           type: boolean
 *         description: >
 *           When omitted, the Trafikverket `Canceled` filter is not sent, so both
 *           canceled and not-canceled departures are returned. `true` returns only
 *           canceled departures; `false` returns only not-canceled.
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
 *         description: Invalid `from` or `to` timestamp, or `from` after `to`
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       502:
 *         description: Trafikverket query or paging failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/departures/:from', async (req, res) => {
  const windowResult = parseAdvertisedTimeWindow(req.query);
  if (!windowResult.ok) {
    return res.status(400).json({ error: windowResult.error });
  }

  const from = req.params.from;
  const { delayed, canceled } = req.query as {
    delayed?: string;
    canceled?: string;
  };
  const canceledFilter =
    canceled === 'true' ? true : canceled === 'false' ? false : undefined;
  try {
    const departures = await fetchDeparturesFromStation(
      from,
      canceledFilter,
      delayed?.toString() === 'true',
      windowResult.window
    );
    return res.json(departures);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch departures';
    console.error(`GET /api/announcements/departures/:from failed: ${message}`);
    return res.status(502).json({ error: message });
  }
});

/**
 * @openapi
 * /api/announcements/train/{trainId}:
 *   get:
 *     tags:
 *       - Announcements
 *     summary: Get announcements for a specific train
 *     description: >
 *       Retrieves TrainAnnouncement records for `AdvertisedTrainIdent`.
 *       Optional `from` and `to` query params filter `AdvertisedTimeAtLocation`
 *       (`GT` / `LT`). When both are omitted, no advertised-time filter is applied.
 *       Station names (`fromName`, `toName`) are resolved from the stations list.
 *     parameters:
 *       - in: path
 *         name: trainId
 *         required: true
 *         schema:
 *           type: string
 *         description: Advertised train identifier (`AdvertisedTrainIdent`)
 *       - $ref: '#/components/parameters/AdvertisedTimeFrom'
 *       - $ref: '#/components/parameters/AdvertisedTimeTo'
 *     responses:
 *       200:
 *         description: Successfully retrieved train announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Announcement'
 *       400:
 *         description: Invalid `from` or `to` timestamp, or `from` after `to`
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       502:
 *         description: Trafikverket query or paging failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get('/train/:trainId', async (req, res) => {
  const windowResult = parseAdvertisedTimeWindow(req.query);
  if (!windowResult.ok) {
    return res.status(400).json({ error: windowResult.error });
  }

  const { trainId } = req.params;
  try {
    const departures = await fetchAnnouncementsForTrain(
      trainId,
      windowResult.window
    );
    return res.json(departures);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch announcements';
    console.error(`GET /api/announcements/train/:trainId failed: ${message}`);
    return res.status(502).json({ error: message });
  }
});

export default router;
