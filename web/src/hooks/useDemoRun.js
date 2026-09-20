import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { expandAnswers } from '../../../demos/lib/answers.js';
import { loadDemoData, loadFixtures, runItemLive } from '../lib/demo-client.js';

// Loads a demo's dataset, its labels and its recorded run together, and grades the whole run at once:
// every item has its answers, its evaluation and its grade from the first paint, and the report is
// computed once. Replaying an item is animation over results that already exist. A live run starts
// from nothing and fills in item by item, because each of those answers costs a request.

const initial = { status: 'loading', dataset: null, labels: [], fixtures: null, live: {}, error: null };

function reducer(state, action) {
  switch (action.type) {
    case 'loaded':
      return { ...state, status: 'ready', dataset: action.dataset, labels: action.labels, fixtures: action.fixtures };
    case 'failed':
      return { ...state, status: 'error', error: action.error };
    case 'live-result':
      return { ...state, live: { ...state.live, [action.result.item.id]: action.result } };
    case 'clear-live':
      return { ...state, live: {} };
    default:
      return state;
  }
}

/** Labels arrive as a list or as a map by item id; either way the runtime wants them by item id. */
function indexLabels(labels, labelId) {
  if (!labels) return new Map();
  if (!Array.isArray(labels)) return new Map(Object.entries(labels));
  const idOf = labelId ?? ((label) => label.id ?? label.itemId);
  return new Map(labels.map((label) => [idOf(label), label]).filter(([id]) => id !== undefined));
}

export function useDemoRun(demo, { live = false } = {}) {
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    let cancelled = false;
    const labels = demo.labels ? demo.labels().then((module) => module.default ?? module).catch(() => []) : Promise.resolve([]);
    Promise.all([loadDemoData(demo), labels, loadFixtures(demo)])
      .then(([dataset, labelList, fixtures]) => !cancelled && dispatch({ type: 'loaded', dataset, labels: labelList, fixtures }))
      .catch((error) => !cancelled && dispatch({ type: 'failed', error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [demo.id]);

  const context = useMemo(
    () => (state.dataset ? { ...(state.dataset.context ?? {}), items: state.dataset.items } : null),
    [state.dataset],
  );

  // The recorded run, evaluated in one pass. Around ten thousand items across the catalog take
  // milliseconds each way, so there is nothing to wait for and nothing to stream.
  const recorded = useMemo(() => {
    if (!context || !state.fixtures) return {};
    const results = {};
    for (const item of context.items) {
      const raw = state.fixtures.answers?.[item.id];
      if (!raw) continue;
      const answers = expandAnswers(raw, demo.questions);
      results[item.id] = { item, answers, recorded: true, model: state.fixtures.model ?? null, evaluation: demo.evaluate(answers, item, context) };
    }
    return results;
  }, [demo.id, context, state.fixtures]);

  const resultsById = live ? state.live : recorded;

  const results = useMemo(
    () => (context ? context.items.map((item) => resultsById[item.id]).filter(Boolean) : []),
    [context, resultsById],
  );

  // A grade per item, where the demo knows how to judge one. Kept apart from `evaluate`, which never
  // sees a label: what the demo made of the answers and whether the answers were right are two things.
  const gradesById = useMemo(() => {
    const judge = demo.grade?.judge;
    if (!judge || !context) return {};
    const labels = indexLabels(state.labels, demo.grade.labelId);
    const grades = {};
    for (const result of results) {
      const grade = judge(result, labels.get(result.item.id) ?? null, { ...context, labels: state.labels });
      if (grade) grades[result.item.id] = grade;
    }
    return grades;
  }, [demo.id, context, results, state.labels]);

  const report = useMemo(() => {
    if (!context || results.length === 0) return null;
    return demo.report(results, { ...context, labels: state.labels });
  }, [demo.id, context, results, state.labels]);

  /** Exactly what the model is sent for an item. Built on demand: most states are never opened. */
  const stateFor = useCallback((item) => (item && context ? demo.buildState(item, context) : null), [demo.id, context]);

  /** One live call. Recorded items already have their answer, so this is only ever used in live mode. */
  const runLive = useCallback(
    async (item) => {
      if (!context) return null;
      const response = await runItemLive(demo, item);
      const result = {
        item,
        answers: response.answers,
        model: response.model ?? null,
        usage: response.usage ?? null,
        latencyMs: response.latencyMs ?? null,
        recorded: false,
        evaluation: demo.evaluate(response.answers, item, context),
      };
      dispatch({ type: 'live-result', result });
      return result;
    },
    [demo.id, context],
  );

  return {
    status: state.status,
    error: state.error,
    dataset: state.dataset,
    context,
    labels: state.labels,
    run: state.fixtures ? { model: state.fixtures.model ?? null, recordedAt: state.fixtures.recordedAt ?? null, items: Object.keys(state.fixtures.answers ?? {}).length } : null,
    resultsById,
    results,
    gradesById,
    report,
    stateFor,
    runLive,
    clearLive: () => dispatch({ type: 'clear-live' }),
  };
}
