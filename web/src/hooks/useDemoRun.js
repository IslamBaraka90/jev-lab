import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { loadDemoData, runItem } from '../lib/demo-client.js';

// Loads a demo's dataset once, then keeps one result per item as they are answered. The answers come
// from the recorded fixtures or from a live call; this hook does not care which.

const initial = { status: 'loading', dataset: null, labels: [], results: {}, error: null, running: false };

function reducer(state, action) {
  switch (action.type) {
    case 'loaded':
      return { ...state, status: 'ready', dataset: action.dataset, labels: action.labels };
    case 'failed':
      return { ...state, status: 'error', error: action.error };
    case 'running':
      return { ...state, running: action.running };
    case 'result':
      return { ...state, results: { ...state.results, [action.result.item.id]: action.result } };
    case 'clear':
      return { ...state, results: {} };
    default:
      return state;
  }
}

export function useDemoRun(demo, { live = false } = {}) {
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadDemoData(demo), demo.labels ? demo.labels().then((module) => module.default ?? module) : []])
      .then(([dataset, labels]) => !cancelled && dispatch({ type: 'loaded', dataset, labels }))
      .catch((error) => !cancelled && dispatch({ type: 'failed', error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [demo.id]);

  const context = useMemo(
    () => (state.dataset ? { ...(state.dataset.context ?? {}), items: state.dataset.items } : null),
    [state.dataset],
  );

  /** Answers one item and stores the result. Returns it, so a replay can step through phases. */
  const run = useCallback(
    async (item, { pause = 0 } = {}) => {
      if (!context) return null;
      const demoState = demo.buildState(item, context);
      const response = await runItem(demo, item, { pause, live });
      const result = {
        item,
        state: demoState,
        answers: response.answers,
        model: response.model ?? null,
        usage: response.usage ?? null,
        latencyMs: response.latencyMs ?? null,
        recorded: response.recorded !== false,
        evaluation: demo.evaluate(response.answers, item, context),
      };
      dispatch({ type: 'result', result });
      return result;
    },
    [demo.id, context, live],
  );

  /** Answers every item that has no result yet. */
  const runAll = useCallback(
    async ({ pause = 0, signal } = {}) => {
      if (!state.dataset) return;
      dispatch({ type: 'running', running: true });
      try {
        for (const item of state.dataset.items) {
          if (signal?.aborted) break;
          if (!state.results[item.id]) await run(item, { pause });
        }
      } finally {
        dispatch({ type: 'running', running: false });
      }
    },
    [state.dataset, state.results, run],
  );

  const results = useMemo(
    () => (state.dataset ? state.dataset.items.map((item) => state.results[item.id]).filter(Boolean) : []),
    [state.dataset, state.results],
  );

  const report = useMemo(() => {
    if (!context || results.length === 0) return null;
    return demo.report(results, { ...context, labels: state.labels });
  }, [demo.id, context, results, state.labels]);

  return {
    status: state.status,
    error: state.error,
    dataset: state.dataset,
    context,
    labels: state.labels,
    resultsById: state.results,
    results,
    report,
    running: state.running,
    run,
    runAll,
    clear: () => dispatch({ type: 'clear' }),
  };
}
