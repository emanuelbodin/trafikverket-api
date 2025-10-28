import express from 'express';
import stationsRouter from './stations/stations-handler.js';
import trainRouter from './train/train-handler.js';
import announcementRouter from './announcement/announcement-handler.js';
const app = express();

app.get('/health', (req, res) => res.send('OK'));

const apiRouter = express.Router();
apiRouter.use('/stations', stationsRouter);
apiRouter.use('/train', trainRouter);
apiRouter.use('/announcements', announcementRouter);
app.use('/api', apiRouter);

app.listen(3000, () => {
  console.info('listening on port 3000');
});
