#!/usr/bin/env node
// Records a demo's answers from the live API and writes them to demos/<slug>/fixtures.json, which is
// what the deployed site replays. This is the only paid step in the project.
//
// Usage: node scripts/record-demo.js <slug> [--items L-0001,L-0002] [--force] [--dry-run]

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../src/config.js';
import { findDemo } from '../demos/index.js';
import { loadDataset, repoRoot } from '../src/services/dataset.js';
import { askModel, fixturesFile, loadFixtures, runDemo } from '../src/services/demo-runner.js';

const [slug, ...flags] = process.argv.slice(2);
const has = (flag) => flags.includes(flag);
const value = (flag) => {
  const found = flags.find((entry) => entry.startsWith(`${flag}=`)) ?? (flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : null);
  return found?.startsWith(`${flag}=`) ? found.slice(flag.length + 1) : found;
};

if (!slug) {
  console.error('Usage: node scripts/record-demo.js <slug> [--items a,b] [--force] [--dry-run]');
  process.exit(1);
}

const demo = findDemo(slug);
if (!demo) {
  console.error(`No demo called "${slug}".`);
  process.exit(1);
}
if (!config.typesafe.apiKey) {
  console.error('TYPESAFE_API_KEY is not set. Recording needs the live API; the site itself never calls it.');
  process.exit(1);
}

const dataset = await loadDataset(slug);
const existing = await loadFixtures(slug);
const wanted = value('--items')?.split(',').map((id) => id.trim()).filter(Boolean) ?? null;
const force = has('--force');

const todo = dataset.items
  .filter((item) => !wanted || wanted.includes(item.id))
  .filter((item) => force || !existing.answers?.[item.id])
  .map((item) => item.id);

if (todo.length === 0) {
  console.log(`Nothing to record: ${slug} already has answers for every item. Use --force to re-record.`);
  process.exit(0);
}

console.log(`${slug}: recording ${todo.length} of ${dataset.items.length} items with ${Object.keys(demo.questions).length} questions each.`);
if (has('--dry-run')) {
  console.log('Dry run, no requests sent. Items:', todo.join(', '));
  process.exit(0);
}

const { typesafe } = await import('../src/lib/typesafe.js');
const answers = { ...(existing.answers ?? {}) };
let inputTokens = 0;
let outputTokens = 0;
let model = existing.model ?? null;

await runDemo(demo, {
  dataset,
  items: todo,
  ask: (request) => askModel(typesafe, request),
  onItem: (result) => {
    answers[result.item.id] = result.answers;
    inputTokens += result.usage?.input_tokens ?? 0;
    outputTokens += result.usage?.output_tokens ?? 0;
    model = result.model ?? model;
    process.stdout.write(`\r  ${Object.keys(answers).length}/${dataset.items.length} recorded`);
  },
});

const ordered = Object.fromEntries(dataset.items.filter((item) => answers[item.id]).map((item) => [item.id, answers[item.id]]));
const file = fixturesFile(slug);
await mkdir(path.dirname(file), { recursive: true });
await writeFile(
  file,
  `${JSON.stringify({ demo: slug, model, recordedAt: new Date().toISOString().slice(0, 10), source: 'scripts/record-demo.js', answers: ordered }, null, 2)}\n`,
);

console.log(`\n${path.relative(repoRoot, file)}: ${Object.keys(ordered).length} items, model ${model}`);
console.log(`tokens: ${inputTokens.toLocaleString('en-US')} in, ${outputTokens.toLocaleString('en-US')} out`);
