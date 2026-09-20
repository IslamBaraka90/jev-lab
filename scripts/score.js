#!/usr/bin/env node
// Scores every recorded run and writes the suite scoreboard. Free and offline: it reads the committed
// fixtures and runs the same evaluate, grade and report code the site runs.
//
//   npm run score               score all fifty, write the scoreboard, append new runs to the history
//   npm run score -- --check    also fail if any demo misses one of its gates, or regresses
//   npm run score -- <slug>     print one demo's row
//
// A run is identified by model, date, dataset hash and questions hash. Re-scoring the same run updates
// its row in the history; recording a new run adds one, so the history is the model's record over time.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEMOS, findDemo } from '../demos/index.js';
import { repoRoot } from '../src/services/dataset.js';
import { runKey, scoreDemo } from '../src/services/scoreboard.js';

const args = process.argv.slice(2);
const check = args.includes('--check');
const slug = args.find((arg) => !arg.startsWith('--'));

const scoreboardFile = path.join(repoRoot, 'web', 'src', 'generated', 'scoreboard.json');
const historyFile = path.join(repoRoot, 'benchmarks', 'history.json');
// How far a headline may fall between two runs of the same test before it is called a regression.
const REGRESSION = 0.03;

const percent = (value) => (Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '–');

if (slug) {
  const demo = findDemo(slug);
  if (!demo) {
    console.error(`No demo called "${slug}".`);
    process.exit(1);
  }
  console.log(JSON.stringify(await scoreDemo(demo), null, 2));
  process.exit(0);
}

const rows = [];
for (const demo of DEMOS) rows.push(await scoreDemo(demo));

const history = await readFile(historyFile, 'utf8').then(JSON.parse).catch(() => ({ runs: [] }));
const regressions = [];

for (const row of rows) {
  const key = runKey(row);
  const entry = { demo: row.id, key, ...row.run, items: row.items, graded: row.graded, right: row.right, headline: row.headline?.value ?? null, metrics: row.metrics };
  const earlier = history.runs.filter((run) => run.demo === row.id && run.key !== key);
  const previous = earlier[earlier.length - 1] ?? null;
  const comparable = previous && previous.dataset === row.run.dataset && previous.questions === row.run.questions;

  row.previous = previous ? { model: previous.model, recordedAt: previous.recordedAt, headline: previous.headline, comparable: Boolean(comparable) } : null;
  row.delta = comparable && Number.isFinite(previous.headline) && Number.isFinite(entry.headline) ? Number((entry.headline - previous.headline).toFixed(4)) : null;
  row.runs = earlier.length + 1;
  if (row.delta !== null && row.delta < -REGRESSION) regressions.push(`${row.id}: ${percent(previous.headline)} → ${percent(entry.headline)}`);

  const index = history.runs.findIndex((run) => run.demo === row.id && run.key === key);
  if (index >= 0) history.runs[index] = entry;
  else history.runs.push(entry);
}

const graded = rows.filter((row) => row.graded > 0);
const summary = {
  demos: rows.length,
  items: rows.reduce((sum, row) => sum + row.items, 0),
  answers: DEMOS.reduce((sum, demo, index) => sum + Object.keys(demo.questions).length * rows[index].answered, 0),
  gradedDemos: graded.length,
  gradedItems: graded.reduce((sum, row) => sum + row.graded, 0),
  rightItems: graded.reduce((sum, row) => sum + row.right, 0),
  models: [...new Set(rows.map((row) => row.run.model).filter(Boolean))],
  latest: rows.map((row) => row.run.recordedAt).filter(Boolean).sort().at(-1) ?? null,
  gates: { total: rows.reduce((sum, row) => sum + row.gates.length, 0), failed: rows.reduce((sum, row) => sum + row.gates.filter((gate) => !gate.passed).length, 0) },
};

await mkdir(path.dirname(scoreboardFile), { recursive: true });
await mkdir(path.dirname(historyFile), { recursive: true });
await writeFile(scoreboardFile, `${JSON.stringify({ summary, rows }, null, 1)}\n`);
await writeFile(historyFile, `${JSON.stringify(history, null, 1)}\n`);

for (const row of rows) {
  const mark = row.gates.length ? (row.passed ? 'pass' : 'FAIL') : '    ';
  const agree = row.graded ? `${row.right}/${row.graded} ${percent(row.metrics.agreement)}` : 'ungraded';
  console.log(`${mark}  ${row.id.padEnd(24)} ${String(row.headline?.display ?? '').padEnd(14)} ${agree.padEnd(18)} ${row.delta === null ? '' : `${row.delta >= 0 ? '+' : ''}${(row.delta * 100).toFixed(1)} pts`}`);
}
console.log(`\n${summary.items.toLocaleString('en-US')} items, ${summary.gradedItems.toLocaleString('en-US')} graded, ${summary.rightItems.toLocaleString('en-US')} matching ground truth (${percent(summary.rightItems / Math.max(summary.gradedItems, 1))}).`);
console.log(`${path.relative(repoRoot, scoreboardFile)} and ${path.relative(repoRoot, historyFile)} written.`);

if (check) {
  const failed = rows.flatMap((row) => row.gates.filter((gate) => !gate.passed).map((gate) => `${row.id}: ${gate.metric} is ${gate.value}, gate is ${gate.min !== undefined ? `at least ${gate.min}` : `at most ${gate.max}`}`));
  for (const line of [...failed, ...regressions.map((line) => `regression, ${line}`)]) console.error(`FAIL  ${line}`);
  if (failed.length || regressions.length) process.exit(1);
}
