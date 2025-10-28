import { Router } from 'express';
import { fetchTrainPositions } from './train-service.js';

const router = Router();

router.get('/position', async (req, res) => {
  const positions = await fetchTrainPositions();
  return res.json(positions);
});

export default router;
