import { Router } from 'express';
import {
  fetchAnnouncementsForTrain,
  fetchDeparturesFromStation,
} from './announcement-service.js';
import { getView } from '../common/view.js';

const router = Router();

router.get('/:from', async (req, res) => {
  try {
    const from = req.params.from;
    const { delayed, canceled, json } = req.query as {
      delayed?: string;
      canceled?: string;
      json?: string;
    };
    const departures = await fetchDeparturesFromStation(
      from,
      canceled?.toString() === 'true',
      delayed?.toString() === 'true'
    );
    if (json?.toString() === 'true') {
      return res.status(200).json(departures);
    }
    const html = getView(from, departures);
    return res.status(200).send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch departures' });
  }
});

router.get('/train/:trainId', async (req, res) => {
  try {
    const { trainId } = req.params;
    const departures = await fetchAnnouncementsForTrain(trainId);
    return res.status(200).json(departures);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

export default router;
