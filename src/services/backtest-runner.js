import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildTradeDecisionState, tradeDecisionQuestions, tradePlanFromAnswers } from '../questions/trade-decision.js';
import { forwardReturnsPct, selectCutoffs, simulateTrade, summarizeDecisions } from './backtest.js';
import { applyRunEvent, createRun, toDecisionView } from './run-model.js';

export const PRESETS = {
  pilot: { label: 'Pilot', symbols: ['AAPL'], cutoffs: 12 },
  suite: { label: 'Full suite', symbols: ['NVDA', 'JPM', 'XOM', 'BTC-USD', 'GLD'], cutoffs: 60 },
};

export const DEFAULT_SETTINGS = {
  evaluationYears: 2, // cutoffs fall within this period
  priorYears: 1, // candles fetched before it, so SMA(200) is ready at the first cutoff
  warmupMonths: 3, // no cutoffs in the first months of the period
  lookbackBars: 90, // most candles shown with each decision
  horizonBars: 8, // longest holding period; these candles are never sent to Jev
  costBpsPerSide: 5, // charged on entry and on exit
  notional: 10_000, // position size used for P&L
};

// e.g. "suite-indicators-2026-09-17T10-50-18-187Z"
export function runName({ preset, settings, startedAt }) {
  return [preset, settings.indicators && 'indicators', settings.blind && 'blind', startedAt.replace(/[:.]/g, '-')]
    .filter(Boolean)
    .join('-');
}

export function symbolFileName(symbol) {
  return `${symbol.replace(/[^\w.-]/g, '_')}.json`;
}

/**
 * Runs a backtest and saves it to `resultsDir/<id>/`: one file per symbol with every state, answer and
 * trade, plus summary.json. For each symbol, Jev decides at every cutoff from the candles up to it, and
 * each decision is scored on the candles after its cutoff as soon as it is made.
 *
 * Progress goes to `onEvent` as run-started, symbol-started, decision, symbol-finished and run-finished
 * events (see run-model.js); run-started is emitted before the first await. Aborting `signal` stops
 * the run and keeps everything already saved. Resolves to the finished run model.
 */
export async function runBacktest({
  id,
  preset,
  symbols,
  settings,
  typesafe,
  fetchCandles,
  resultsDir,
  signal,
  startedAt = new Date().toISOString(),
  onEvent = () => {},
}) {
  let run = createRun({ id, preset, symbols, settings, questions: tradeDecisionQuestions, startedAt, model: typesafe.defaultModel });
  const emit = (event) => {
    run = applyRunEvent(run, event);
    onEvent(event);
  };
  emit({ type: 'run-started', run });

  const dir = path.join(resultsDir, id);
  const decided = [];
  const saveSummary = () => writeJson(path.join(dir, 'summary.json'), summaryFile(run));
  const alwaysLong = { side: 'LONG', stopLossPct: null, takeProfitPct: null, maxBars: settings.horizonBars };

  async function decide({ instrument, cutoff, index, history, future }) {
    const state = buildTradeDecisionState({ instrument, history, ...settings });
    const decision = { cutoff, date: history.at(-1).date, candleIndex: index };
    const started = performance.now();
    try {
      const { data, requestId } = await typesafe
        .systemOne({ state, questions: tradeDecisionQuestions }, { timeout: 60_000, signal })
        .withResponse();
      const plan = tradePlanFromAnswers(data.answers, settings);
      Object.assign(decision, {
        action: data.answers.trade_decision.choice,
        requestId,
        latencyMs: Math.round(performance.now() - started),
        plan,
        trade: plan ? simulateTrade(plan, future, settings) : null,
        baseline: simulateTrade(alwaysLong, future, settings),
        forwardReturnsPct: forwardReturnsPct(history.at(-1).close, future),
        response: data,
      });
    } catch (err) {
      if (signal?.aborted) return null;
      decision.error = { message: err.message, status: err.status, requestId: err.requestId };
      Object.assign(decision, { plan: null, trade: null, baseline: null, forwardReturnsPct: forwardReturnsPct(history.at(-1).close, future) });
    }
    return { ...decision, state };
  }

  async function backtestSymbol(symbol) {
    let record = null;
    try {
      const evaluationStart = yearsBefore(startedAt, settings.evaluationYears);
      const from = yearsBefore(startedAt, settings.evaluationYears + settings.priorYears);
      const { candles, ...instrument } = await fetchCandles(symbol, { from });
      const cutoffs = selectCutoffs(candles, { ...settings, start: evaluationStart });
      record = { symbol, instrument, evaluationStart, settings, questions: tradeDecisionQuestions, candles, decisions: [] };
      emit({
        type: 'symbol-started',
        symbol,
        instrument,
        evaluationStart,
        candles,
        cutoffs: cutoffs.map(({ index, history }, i) => ({ cutoff: i + 1, date: history.at(-1).date, candleIndex: index })),
      });

      const file = path.join(dir, symbolFileName(symbol));
      for (const [i, { index, history, future }] of cutoffs.entries()) {
        const decision = signal?.aborted ? null : await decide({ instrument, cutoff: i + 1, index, history, future });
        if (!decision) break;
        record.decisions.push(decision);
        decided.push(decision);
        await writeJson(file, record);
        emit({ type: 'decision', symbol, decision: toDecisionView(decision) });
      }
      record.summary = summarizeDecisions(record.decisions);
      await writeJson(file, record);
      emit({ type: 'symbol-finished', symbol, status: signal?.aborted ? 'cancelled' : 'completed', summary: record.summary });
    } catch (err) {
      const summary = record ? summarizeDecisions(record.decisions) : null;
      emit({ type: 'symbol-finished', symbol, status: 'failed', summary, error: err.message });
    }
  }

  try {
    await mkdir(dir, { recursive: true });
    await saveSummary();
    for (const symbol of symbols) {
      if (signal?.aborted) break;
      await backtestSymbol(symbol);
      await saveSummary();
    }
    const status = signal?.aborted ? 'cancelled' : 'completed';
    emit({ type: 'run-finished', status, finishedAt: new Date().toISOString(), overall: summarizeDecisions(decided) });
  } catch (err) {
    emit({ type: 'run-finished', status: 'failed', finishedAt: new Date().toISOString(), overall: summarizeDecisions(decided), error: err.message });
  }
  await saveSummary().catch(() => {});
  return run;
}

function summaryFile({ symbols, questions, ...run }) {
  return {
    ...run,
    symbols: symbols.map(({ symbol, status, instrument, summary, error }) => ({
      symbol,
      status,
      currency: instrument?.currency ?? null,
      summary,
      error,
    })),
  };
}

function yearsBefore(isoDate, years) {
  const date = new Date(isoDate);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function writeJson(file, value) {
  return writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
