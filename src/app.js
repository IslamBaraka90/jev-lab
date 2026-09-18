import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { backtestsRouter } from './routes/backtests.js';
import { demosRouter } from './routes/demos.js';
import { modelsRouter } from './routes/models.js';
import { quickstartRouter } from './routes/quickstart.js';
import { systemOneRouter } from './routes/systemone.js';

// Dependencies are passed in so tests can supply stubs. `backtests` adds the backtest API, and
// `webRoot` serves the built site with client-side routes falling back to its index.html. When a
// TypeSafe client is present the page is marked as live, so demos can run against the real API
// instead of replaying their recorded answers.
export function createApp({ typesafe, backtests, webRoot }) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/models', modelsRouter({ typesafe }));
  app.use('/api/quickstart', quickstartRouter({ typesafe }));
  app.use('/api/systemone', systemOneRouter({ typesafe }));
  app.use('/api/demos', demosRouter({ typesafe }));
  if (backtests) app.use('/api/backtests', backtestsRouter({ backtests }));

  if (webRoot) {
    const indexHtml = liveIndexHtml(webRoot, Boolean(typesafe));
    app.use(express.static(webRoot, { index: false }));
    app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
      if (indexHtml) return res.type('html').set('Cache-Control', 'no-cache').send(indexHtml);
      res.sendFile(path.join(webRoot, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// The built index.html with a one-line marker when this server can run demos live. Read once at
// startup; without a build, or without a key, the file is served as it is.
function liveIndexHtml(webRoot, live) {
  if (!live) return null;
  try {
    const html = readFileSync(path.join(webRoot, 'index.html'), 'utf8');
    return html.replace('</head>', '  <script>window.__JEV_LIVE__ = true;</script>\n  </head>');
  } catch {
    return null;
  }
}
