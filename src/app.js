import path from 'node:path';
import express from 'express';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { backtestsRouter } from './routes/backtests.js';
import { modelsRouter } from './routes/models.js';
import { quickstartRouter } from './routes/quickstart.js';
import { systemOneRouter } from './routes/systemone.js';

// Dependencies are passed in so tests can supply stubs. `backtests` adds the backtest API, and
// `webRoot` serves the built dashboard with client-side routes falling back to its index.html.
export function createApp({ typesafe, backtests, webRoot }) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/models', modelsRouter({ typesafe }));
  app.use('/api/quickstart', quickstartRouter({ typesafe }));
  app.use('/api/systemone', systemOneRouter({ typesafe }));
  if (backtests) app.use('/api/backtests', backtestsRouter({ backtests }));

  if (webRoot) {
    app.use(express.static(webRoot));
    app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
      res.sendFile(path.join(webRoot, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
