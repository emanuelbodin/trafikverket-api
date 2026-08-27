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
 *     description: >
 *       Retrieves departure announcements (`ActivityType=Avgang`) for a station.
 *       Only announcements whose advertised time is between about 24 hours ago
 *       and 12 hours ahead are included. Station names (`fromName`, `toName`)
 *       are resolved from the stations list. Always returns JSON.
 *     parameters:
 *       - in: path
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: Station LocationSignature (e.g. Cst), not the station display name
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
 *           Sent to Trafikverket as `Canceled`. `true` means only canceled
 *           departures; any other value (including omit) is sent as not canceled.
 *     responses:
 *       200:
 *         description: Successfully retrieved departures
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Announcement'
 *       500:
 *         description: Failed to fetch departures
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
 *     description: >
 *       Retrieves TrainAnnouncement records for `AdvertisedTrainIdent`, with
 *       advertised time between about 24 hours ago and 12 hours ahead.
 *       Station names (`fromName`, `toName`) are resolved from the stations list.
 *     parameters:
 *       - in: path
 *         name: trainId
 *         required: true
 *         schema:
 *           type: string
 *         description: Advertised train identifier (`AdvertisedTrainIdent`)
 *     responses:
 *       200:
 *         description: Successfully retrieved train announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Announcement'
 *       500:
 *         description: Failed to fetch announcements
 */
router.get('/train/:trainId', async (req, res) => {
  const { trainId } = req.params;
  const departures = await fetchAnnouncementsForTrain(trainId);
  return res.json(departures);
});

export default router;
