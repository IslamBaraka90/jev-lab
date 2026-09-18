#!/usr/bin/env node
// Builds stand-in answers for the example demo so the foundation can be tested without spending a
// request. These are NOT model output: they are deterministic stubs, and the file says so. Catalog
// demos get their fixtures from `scripts/record-demo.js`, which calls the real API.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRandom } from './generate/lib/random.js';
import { loadDataset, loadLabels, repoRoot } from '../src/services/dataset.js';

const SEVERITY = ['No problem', 'Cosmetic', 'Minor', 'Notable', 'Material', 'Serious', 'Critical'];
const ISSUES = ['DUPLICATE_POSTING', 'REVERSED_SIGN', 'MISSING_COUNTER_ENTRY', 'NONE'];

const spread = (labels, chosen, weight) => {
  const rest = (1 - weight) / (labels.length - 1);
  return Object.fromEntries(labels.map((label) => [label, Number((label === chosen ? weight : rest).toFixed(3))]));
};

const dataset = await loadDataset('__example__');
const labels = await loadLabels('__example__');
const planted = new Map(labels.map((label) => [label.lineId, label.issue]));
const random = createRandom(9000);

const answers = {};
for (const item of dataset.items) {
  const issue = planted.get(item.id) ?? 'NONE';
  const flagged = issue !== 'NONE';
  const weight = flagged ? random.float(0.52, 0.74, 3) : random.float(0.66, 0.88, 3);
  const severity = flagged ? random.float(3.4, 5.2, 2) : random.float(0.1, 0.9, 2);

  answers[item.id] = {
    issue_type: { type: 'choice', choice: issue, confidence: Number((weight - 0.15).toFixed(3)), probabilities: spread(ISSUES, issue, weight) },
    document_balances: { type: 'noul', noul: issue === 'REVERSED_SIGN' ? random.float(0.08, 0.2, 3) : random.float(0.8, 0.97, 3) },
    severity: {
      type: 'score',
      score: severity,
      confidence: random.float(0.3, 0.6, 3),
      legend: Object.fromEntries(SEVERITY.map((label, index) => [index, label])),
      probabilities: Object.fromEntries(SEVERITY.map((_, index) => [index, Number((index === Math.round(severity) ? 0.5 : 0.5 / (SEVERITY.length - 1)).toFixed(3))])),
    },
  };
}

const file = path.join(repoRoot, 'demos', '__example__', 'fixtures.json');
await mkdir(path.dirname(file), { recursive: true });
await writeFile(
  file,
  `${JSON.stringify(
    {
      demo: '__example__',
      model: 'stub',
      recordedAt: '2026-09-19',
      source: 'scripts/make-example-fixtures.js — deterministic stand-in answers for tests, not model output',
      answers,
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${path.relative(repoRoot, file)} with ${Object.keys(answers).length} stub answers`);
