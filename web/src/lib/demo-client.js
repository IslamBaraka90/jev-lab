// How a demo gets its answers. In demo mode they come from the fixture file recorded with
// `npm run record`; in live mode the local server calls the API. Both return the same shape, so the
// runtime, the report and the page never know which one they are looking at.

import { isLive } from './mode.js';

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
  if (isLive) return { live: true, model: null, recordedAt: null, source: 'Live requests to the TypeSafe API' };
  const file = await loadFixtures(demo);
  return { live: false, model: file.model ?? null, recordedAt: file.recordedAt ?? null, source: file.source ?? 'Recorded answers' };
}

/** Replays one recorded answer. `pause` keeps the reading step visible when a run is playing. */
export async function replayItem(demo, item, { pause = 0 } = {}) {
  const file = await loadFixtures(demo);
  const answers = file.answers?.[item.id];
  if (!answers) {
    throw new Error(`No recorded answer for ${demo.id} item ${item.id}. Record it with: npm run record ${demo.id}`);
  }
  if (pause) await sleep(pause);
  return { answers, model: file.model ?? null, recordedAt: file.recordedAt ?? null, recorded: true };
}

/** Runs one item against the real API through the local server. */
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

/** One call for the runtime: recorded or live, whichever this page is. */
export function runItem(demo, item, options) {
  return isLive ? runItemLive(demo, item) : replayItem(demo, item, options);
}
