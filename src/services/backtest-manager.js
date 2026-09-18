import { HttpError } from '../lib/http.js';
import { DEFAULT_SETTINGS, PRESETS, runBacktest, runName } from './backtest-runner.js';
import { listRuns, loadDecision, loadRun } from './backtest-store.js';
import { applyRunEvent, toRunListing } from './run-model.js';

const SYMBOL = /^[A-Z0-9^=.-]{1,20}$/;
const MAX_SYMBOLS = 20;
const MAX_CUTOFFS = 200;

/**
 * Starts backtests for the dashboard, one at a time, and lets pages follow the running one. Finished
 * runs are read back from the results directory.
 */
export function createBacktestManager({ typesafe, fetchCandles, resultsDir }) {
  let active = null; // { id, run, controller, listeners, done }

  return {
    get activeRunId() {
      return active?.run.status === 'running' ? active.id : null;
    },

    start(options) {
      if (active?.run.status === 'running') throw new HttpError(409, 'A backtest is already running. Cancel it or wait for it to finish.');
      const { preset, symbols, settings } = parseOptions(options);
      const startedAt = new Date().toISOString();
      const id = runName({ preset, settings, startedAt });
      const current = { id, run: null, controller: new AbortController(), listeners: new Set() };
      const publish = (event) => {
        current.run = applyRunEvent(current.run, event);
        for (const listener of current.listeners) listener(event);
      };
      active = current;

      // runBacktest emits run-started before it first awaits, so current.run is set once this returns.
      current.done = runBacktest({
        id,
        preset,
        symbols,
        settings,
        startedAt,
        typesafe,
        fetchCandles,
        resultsDir,
        signal: current.controller.signal,
        onEvent: publish,
      }).catch((err) => {
        publish({ type: 'run-finished', status: 'failed', finishedAt: new Date().toISOString(), overall: current.run.overall, error: err.message });
      });
      return { id };
    },

    cancel(id) {
      if (active?.id !== id || active.run.status !== 'running') return false;
      active.controller.abort();
      return true;
    },

    /** Sends the running run's snapshot and then its events to `listener`. Null when `id` isn't running. */
    subscribe(id, listener) {
      if (active?.id !== id || active.run.status !== 'running') return null;
      const current = active;
      listener({ type: 'snapshot', run: current.run });
      current.listeners.add(listener);
      return () => current.listeners.delete(listener);
    },

    // A running run is served from memory; once it finishes, its saved files are the source of truth.
    async get(id) {
      return active?.id === id && active.run.status === 'running' ? active.run : loadRun(resultsDir, id);
    },

    async list() {
      const runs = await listRuns(resultsDir);
      if (active?.run.status !== 'running') return runs;
      return [toRunListing(active.run), ...runs.filter((run) => run.id !== active.id)];
    },

    decision(id, symbol, cutoff) {
      return loadDecision(resultsDir, id, symbol, cutoff);
    },

    /** Resolves when the current run has finished; for tests and shutdown. */
    idle() {
      return active?.done ?? Promise.resolve();
    },
  };
}

function parseOptions({ preset = 'pilot', symbols, cutoffs, indicators = false, blind = false } = {}) {
  if (!PRESETS[preset]) throw new HttpError(400, `Unknown preset "${preset}". Use ${Object.keys(PRESETS).join(' or ')}.`);
  const chosen = (symbols ?? PRESETS[preset].symbols).map((symbol) => String(symbol).trim().toUpperCase());
  if (chosen.length === 0 || chosen.length > MAX_SYMBOLS || !chosen.every((symbol) => SYMBOL.test(symbol))) {
    throw new HttpError(400, `Symbols must be 1 to ${MAX_SYMBOLS} Yahoo Finance symbols such as AAPL, BTC-USD or ^GSPC.`);
  }
  const count = cutoffs ?? PRESETS[preset].cutoffs;
  if (!Number.isInteger(count) || count < 1 || count > MAX_CUTOFFS) {
    throw new HttpError(400, `Cutoffs must be a whole number from 1 to ${MAX_CUTOFFS}.`);
  }
  return {
    preset,
    symbols: [...new Set(chosen)],
    settings: { ...DEFAULT_SETTINGS, cutoffs: count, indicators: indicators === true, blind: blind === true },
  };
}
