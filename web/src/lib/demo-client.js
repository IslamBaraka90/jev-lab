// How a demo gets its answers. By default they come from the fixture file recorded with
// `npm run record`; a demo switched to live asks the local server to call the API instead. Both
// return the same shape, so the runtime, the report and the page never know which one they have.

import { expandAnswers } from '../../../demos/lib/answers.js';

const datasets = new Map();
const fixtures = new Map();

const unwrap = (module) => module.default ?? module;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The demo's dataset, fetched once per session. */
export function loadDemoData(demo) {
  if (!datasets.has(demo.id)) datasets.set(demo.id, demo.data().then(unwrap));
  return datasets.get(demo.id);
}

/** The demo's recorded answers, fetched once per session. */
export function loadFixtures(demo) {
  if (!fixtures.has(demo.id)) fixtures.set(demo.id, demo.fixtures().then(unwrap).catch(() => ({ answers: {} })));
  return fixtures.get(demo.id);
}

/** What the page says about where the answers came from. */
export async function answerSource(demo) {
  const file = await loadFixtures(demo);
  return {
    model: file.model ?? null,
    recordedAt: file.recordedAt ?? null,
    source: file.source ?? 'Recorded answers',
    items: Object.keys(file.answers ?? {}).length,
  };
}

/** Replays one recorded answer. `pause` keeps the reading step visible while a run plays. */
export async function replayItem(demo, item, { pause = 0 } = {}) {
  const file = await loadFixtures(demo);
  const answers = file.answers?.[item.id];
  if (!answers) {
    throw new Error(`No recorded answer for ${demo.id} item ${item.id}. Record it with: npm run record ${demo.id}`);
  }
  if (pause) await sleep(pause);
  return { answers: expandAnswers(answers, demo.questions), model: file.model ?? null, recordedAt: file.recordedAt ?? null, recorded: true };
}

/** Runs one item against the real API through the local server. Only ever called after a confirmation. */
export async function runItemLive(demo, item) {
  const response = await fetch(`/api/demos/${encodeURIComponent(demo.id)}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: item.id }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message ?? `The request failed (${response.status}).`);
  return { ...body, recorded: false };
}

/** One call for the runtime. `live` is false unless the page has been switched over and confirmed. */
export function runItem(demo, item, { live = false, pause = 0 } = {}) {
  return live ? runItemLive(demo, item) : replayItem(demo, item, { pause });
}
