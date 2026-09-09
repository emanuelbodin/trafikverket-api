import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import stationsRouter from './stations/stations-handler.js';
import trainsRouter from './trains/trains-handler.js';
import trainRouter, { getTrainPositions } from './train/train-handler.js';
import announcementRouter from './announcement/announcement-handler.js';
import disruptionsRouter from './disruptions/disruptions-handler.js';
import { swaggerSpec } from './swagger.js';
import config from './config.js';
import { httpMetricsMiddleware, register } from './metrics.js';

export const app = express();

app.use(cors({ origin: '*' }));
app.use(httpMetricsMiddleware);

app.get('/', (_req, res) =>
  res.send('Welcome to Trafikverket api! For docs visit /api-docs')
);
app.get('/health', (_req, res) => res.send('OK'));

/**
 * @openapi
 * /metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: Process, HTTP, and Trafikverket client metrics in Prometheus text format.
 *     tags: [Ops]
 *     responses:
 *       200:
 *         description: Prometheus text exposition format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});
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
apiRouter.use('/disruptions', disruptionsRouter);
app.use('/api', apiRouter);

export const start = () => {
  app.listen(Number(config.port), '::', () => {
    console.info(`listening on port ${config.port}`);
  });
};

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  start();
}
