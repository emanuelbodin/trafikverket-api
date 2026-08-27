import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import stationsRouter from './stations/stations-handler.js';
import trainsRouter from './trains/trains-handler.js';
import trainRouter, { getTrainPositions } from './train/train-handler.js';
import announcementRouter from './announcement/announcement-handler.js';
import { swaggerSpec } from './swagger.js';
import config from './config.js';

export const app = express();

app.use(cors({ origin: '*' }));

app.get('/', (_req, res) =>
  res.send('Welcome to Trafikverket api! For docs visit /api-docs')
);
app.get('/health', (_req, res) => res.send('OK'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
const apiRouter = express.Router();
apiRouter.use('/stations', stationsRouter);
apiRouter.use('/trains', trainsRouter);
apiRouter.use('/train', trainRouter);
apiRouter.get('/positions', getTrainPositions);
apiRouter.use('/announcements', announcementRouter);
app.use('/api', apiRouter);

export const start = () => {
  app.listen(Number(config.port), '0.0.0.0', () => {
    console.info(`listening on port ${config.port}`);
  });
};

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  start();
}
