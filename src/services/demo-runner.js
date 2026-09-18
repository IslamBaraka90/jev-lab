// One run loop for every demo, shared by the recorder and the live route. Give it a demo definition,
// a dataset and a way to ask the model; it builds each state, collects the answers and hands back a
// record in the same shape the recorded fixtures use.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expandAnswers } from '../../demos/lib/answers.js';
import { loadDataset, repoRoot } from './dataset.js';

export const fixturesFile = (slug) => path.join(repoRoot, 'demos', slug, 'fixtures.json');

/** The context a demo's `buildState` and `report` receive: the dataset's own context plus its items. */
export function demoContext(dataset) {
  return { ...(dataset.context ?? {}), items: dataset.items };
}

/** Recorded answers with their rubrics restored, for the runtime and the tests. */
export function fixtureAnswers(fixtures, questions, itemId) {
  const answers = fixtures.answers?.[itemId];
  return answers ? expandAnswers(answers, questions) : null;
}

/** Recorded answers for a demo, or an empty set when it has none yet. */
export async function loadFixtures(slug) {
  try {
    return JSON.parse(await readFile(fixturesFile(slug), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { demo: slug, answers: {} };
    throw error;
  }
}

/** Asks the model one item's questions. Returns the answers plus what the call cost. */
export async function askModel(typesafe, { state, questions, signal, timeout = 60_000 }) {
  const started = performance.now();
  const { data, requestId } = await typesafe.systemOne({ state, questions }, { timeout, signal }).withResponse();
  return {
    answers: data.answers,
    model: data.model,
    usage: data.usage,
    requestId,
    latencyMs: Math.round(performance.now() - started),
  };
}

/**
 * Runs `items` of a demo through the model. `ask` is injected so tests can stub it and the recorder
 * and the live route can share this loop unchanged.
 */
export async function runDemo(demo, { dataset, items, ask, onItem, signal } = {}) {
  const data = dataset ?? (await loadDataset(demo.id));
  const context = demoContext(data);
  const chosen = items?.length ? data.items.filter((item) => items.includes(item.id)) : data.items;
  const results = [];

  for (const item of chosen) {
    if (signal?.aborted) break;
    const state = demo.buildState(item, context);
    const response = await ask({ state, questions: demo.questions, item });
    const result = { item, state, ...response, evaluation: demo.evaluate(response.answers, item, context) };
    results.push(result);
    onItem?.(result);
  }

  return { dataset: data, context, results };
}
