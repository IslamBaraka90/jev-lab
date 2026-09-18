// The run model shared by the server and the dashboard. A backtest emits events; applying them in order
// builds the same model on both sides, so a page can follow a run live or load it when it has finished.

export function createRun({ id, preset, symbols, settings, questions, startedAt, model }) {
  return {
    id,
    preset,
    status: 'running',
    startedAt,
    finishedAt: null,
    settings,
    model,
    questions,
    error: null,
    symbols: symbols.map((symbol) => ({
      symbol,
      status: 'pending',
      instrument: null,
      evaluationStart: null,
      candles: [],
      cutoffs: [],
      decisions: [],
      summary: null,
      error: null,
    })),
    overall: null,
  };
}

export function applyRunEvent(run, event) {
  switch (event.type) {
    case 'snapshot':
    case 'run-started':
      return event.run;
    case 'symbol-started': {
      const { instrument, evaluationStart, candles, cutoffs } = event;
      return updateSymbol(run, event.symbol, () => ({ status: 'running', instrument, evaluationStart, candles, cutoffs }));
    }
    case 'decision':
      return updateSymbol(run, event.symbol, (symbol) => ({ decisions: [...symbol.decisions, event.decision] }));
    case 'symbol-finished':
      return updateSymbol(run, event.symbol, () => ({ status: event.status, summary: event.summary, error: event.error ?? null }));
    case 'run-finished':
      return { ...run, status: event.status, finishedAt: event.finishedAt, overall: event.overall, error: event.error ?? null };
    default:
      return run;
  }
}

export function isRunFinished(run) {
  return run !== null && run.status !== 'running';
}

// A saved decision as the dashboard sees it: the state's bars are left out (they are the symbol's
// candles), and the indicators it was shown are kept.
export function toDecisionView({ state, response, ...decision }) {
  return {
    ...decision,
    confidence: response?.answers.trade_decision?.confidence ?? null,
    model: response?.model ?? null,
    usage: response?.usage ?? null,
    answers: response?.answers ?? null,
    indicators: state?.technical_indicators ?? null,
  };
}

// The part of a run listed on the runs page: no candles, decisions or questions.
export function toRunListing({ symbols, questions, ...run }) {
  return {
    ...run,
    symbols: symbols.map(({ symbol, status, instrument, cutoffs, decisions, summary, error, currency }) => ({
      symbol,
      status,
      currency: instrument?.currency ?? currency ?? null,
      decided: decisions?.length ?? summary?.decisions ?? 0,
      planned: cutoffs?.length || run.settings?.cutoffs || 0,
      summary,
      error,
    })),
  };
}

function updateSymbol(run, name, update) {
  return {
    ...run,
    symbols: run.symbols.map((symbol) => (symbol.symbol === name ? { ...symbol, ...update(symbol) } : symbol)),
  };
}
