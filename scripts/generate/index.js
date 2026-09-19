#!/usr/bin/env node
// Builds the synthetic datasets. Every generator is seeded, so running this twice produces identical
// files and a regenerated dataset shows up as an empty diff.
//
// Usage: node scripts/generate/index.js [slug ...]

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDataset, demoDataFile, labelsFile, repoRoot } from '../../src/services/dataset.js';

/** Every synthetic dataset in the project. A demo PRP adds its generator here. */
export const GENERATORS = {
  __example__: () => import('./example.js'),
  'ledger-integrity': () => import('./ledger-integrity.js'),
  'bank-reconciliation': () => import('./bank-reconciliation.js'),
  'expense-posting': () => import('./expense-posting.js'),
  'three-way-match': () => import('./three-way-match.js'),
  'close-blockers': () => import('./close-blockers.js'),
  'order-risk': () => import('./order-risk.js'),
  'dispute-routing': () => import('./dispute-routing.js'),
  'merchant-onboarding': () => import('./merchant-onboarding.js'),
  'card-fraud-triage': () => import('./card-fraud-triage.js'),
  'aml-alert-triage': () => import('./aml-alert-triage.js'),
  'mule-network': () => import('./mule-network.js'),
  'wallet-risk': () => import('./wallet-risk.js'),
  'mixer-tracing': () => import('./mixer-tracing.js'),
  'sybil-clusters': () => import('./sybil-clusters.js'),
  'portfolio-health': () => import('./portfolio-health.js'),
};

const asJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function generate(slug) {
  const generator = GENERATORS[slug];
  if (!generator) throw new Error(`No generator for "${slug}". Known: ${Object.keys(GENERATORS).join(', ')}`);

  const { generate: build, SEED } = await generator();
  const { dataset, labels } = build(SEED);
  assertDataset(dataset, `${slug} dataset`);
  if (dataset.id !== slug) throw new Error(`${slug} generator produced id "${dataset.id}"`);

  const dataFile = demoDataFile(slug);
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, asJson(dataset));

  let labelCount = 0;
  if (labels) {
    const file = labelsFile(slug);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, asJson(labels));
    labelCount = Array.isArray(labels) ? labels.length : Object.keys(labels).length;
  }

  return { slug, items: dataset.items.length, labels: labelCount, dataFile: path.relative(repoRoot, dataFile) };
}

async function main() {
  const wanted = process.argv.slice(2);
  const slugs = wanted.length ? wanted : Object.keys(GENERATORS);
  for (const slug of slugs) {
    const result = await generate(slug);
    console.log(`${result.slug}: ${result.items} items, ${result.labels} labels → ${result.dataFile}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
