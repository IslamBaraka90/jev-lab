import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { config } from './config.js';
import { typesafe } from './lib/typesafe.js';
import { createBacktestManager } from './services/backtest-manager.js';
import { fetchEodCandles } from './services/eod-candles.js';

const root = path.join(import.meta.dirname, '..');
const webRoot = path.join(root, 'web', 'dist');
const backtests = createBacktestManager({ typesafe, fetchCandles: fetchEodCandles, resultsDir: path.join(root, 'results') });
const app = createApp({ typesafe, backtests, webRoot: existsSync(webRoot) ? webRoot : undefined });

app.listen(config.port, config.host, (error) => {
  if (error) throw error;
  console.log(`Listening on http://localhost:${config.port} (model: ${typesafe.defaultModel})`);
  if (!existsSync(webRoot)) console.log('The dashboard is not built yet: run "npm run build", or "npm run dev:web" for development.');
});
