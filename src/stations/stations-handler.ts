import { Router } from 'express';
import { fetchAllStations } from './stations-service.js';

const router = Router();
router.get('', async (req, res) => {
  const stations = await fetchAllStations();
  return res.json(stations);
});

export default router;
