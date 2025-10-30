import express from 'express';
import swaggerUi from 'swagger-ui-express';
import stationsRouter from './stations/stations-handler.js';
import trainRouter from './train/train-handler.js';
import announcementRouter from './announcement/announcement-handler.js';
import { swaggerSpec } from './swagger.js';

const app = express();

app.get('/', (_req, res) =>
  res.send('Welcome to Trafikverket api! For docs visit /api-docs')
);
app.get('/health', (_req, res) => res.send('OK'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const apiRouter = express.Router();
apiRouter.use('/stations', stationsRouter);
apiRouter.use('/train', trainRouter);
apiRouter.use('/announcements', announcementRouter);
app.use('/api', apiRouter);

app.listen(3000, () => {
  console.info('listening on port 3000');
});
