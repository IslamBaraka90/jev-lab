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
  'cod-abuse': () => import('./cod-abuse.js'),
  'dispute-routing': () => import('./dispute-routing.js'),
  'chargeback-evidence': () => import('./chargeback-evidence.js'),
  'merchant-onboarding': () => import('./merchant-onboarding.js'),
  'delivery-exceptions': () => import('./delivery-exceptions.js'),
  'card-fraud-triage': () => import('./card-fraud-triage.js'),
  'account-takeover': () => import('./account-takeover.js'),
  'aml-alert-triage': () => import('./aml-alert-triage.js'),
  'sanctions-name-match': () => import('./sanctions-name-match.js'),
  'mule-network': () => import('./mule-network.js'),
  'wallet-risk': () => import('./wallet-risk.js'),
  'mixer-tracing': () => import('./mixer-tracing.js'),
};

const asJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function generate(slug) {
  const generator = GENERATORS[slug];
  if (!generator) throw new Error(`No generator for "${slug}". Known: ${Object.keys(GENERATORS).join(', ')}`);

  const { generate: build, SEED } = await generator();
  const { dataset, labels, artifacts = [] } = build(SEED);
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

  for (const artifact of artifacts) {
    const file = path.resolve(repoRoot, artifact.path);
    const relative = path.relative(repoRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${slug} artifact escapes the repository: ${artifact.path}`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, asJson(artifact.data));
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
