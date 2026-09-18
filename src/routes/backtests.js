import { Router } from 'express';
import { HttpError } from '../lib/http.js';
import { DEFAULT_SETTINGS, PRESETS } from '../services/backtest-runner.js';

const KEEP_ALIVE_MS = 15_000;

// Backtests for the dashboard: list and start runs, follow the running one, and read saved decisions.
export function backtestsRouter({ backtests }) {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json({ runs: await backtests.list(), activeRunId: backtests.activeRunId, presets: PRESETS, settings: DEFAULT_SETTINGS });
  });

  // { preset: "pilot" | "suite", symbols?, cutoffs?, indicators?, blind? }
  router.post('/', (req, res) => {
    res.status(201).json(backtests.start(req.body ?? {}));
  });

  router.get('/:id', async (req, res) => {
    res.json(await findRun(backtests, req.params.id));
  });

  // Server-sent events: a snapshot of the run, then its events until it finishes.
  router.get('/:id/events', async (req, res) => {
    const { id } = req.params;
    await findRun(backtests, id);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    const unsubscribe = backtests.subscribe(id, (event) => {
      send(event);
      if (event.type === 'run-finished') res.end();
    });
    if (!unsubscribe) {
      send({ type: 'snapshot', run: await backtests.get(id) });
      return res.end();
    }

    const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), KEEP_ALIVE_MS);
    res.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  router.post('/:id/cancel', (req, res) => {
    if (!backtests.cancel(req.params.id)) throw new HttpError(409, 'This backtest is not running.');
    res.status(202).json({ cancelling: true });
  });

  router.get('/:id/symbols/:symbol/decisions/:cutoff', async (req, res) => {
    const { id, symbol, cutoff } = req.params;
    const decision = await backtests.decision(id, symbol, cutoff);
    if (!decision) throw new HttpError(404, `No decision ${cutoff} for ${symbol} in this backtest.`);
    res.json(decision);
  });

  return router;
}

async function findRun(backtests, id) {
  const run = await backtests.get(id);
  if (!run) throw new HttpError(404, 'Backtest not found.');
  return run;
}
