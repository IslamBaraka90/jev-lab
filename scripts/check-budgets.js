#!/usr/bin/env node
// Checks the built site against the budgets in PRP 006. Fifty demos with a dataset each is the fastest
// way to build a slow site, so this runs with the tests and fails loudly.

import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '../src/services/dataset.js';

const DIST = path.join(repoRoot, 'web', 'dist');

const BUDGETS = {
  entryJsGzip: 220 * 1024,
  cssGzip: 40 * 1024,
  demoChunkGzip: 800 * 1024,
  totalOutput: 60 * 1024 * 1024,
};

const files = await walk(DIST).catch(() => []);
if (files.length === 0) {
  console.error('No build found. Run "npm run build" first.');
  process.exit(1);
}

const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
const entryNames = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((match) => match[1]);

let total = 0;
const report = [];
for (const file of files) {
  const size = (await stat(file)).size;
  total += size;
  const name = path.relative(DIST, file).replaceAll('\\', '/');
  if (!name.endsWith('.js') && !name.endsWith('.css')) continue;
  const gzip = gzipSync(await readFile(file)).length;
  report.push({ name, size, gzip, entry: entryNames.some((entry) => name.endsWith(entry)) });
}

const entryJs = report.filter((file) => file.entry && file.name.endsWith('.js')).reduce((sum, file) => sum + file.gzip, 0);
const css = report.filter((file) => file.name.endsWith('.css')).reduce((sum, file) => sum + file.gzip, 0);
const biggestChunk = report.filter((file) => !file.entry).sort((a, b) => b.gzip - a.gzip)[0];

const checks = [
  ['entry JavaScript (gzip)', entryJs, BUDGETS.entryJsGzip],
  ['CSS (gzip)', css, BUDGETS.cssGzip],
  ['largest lazy chunk (gzip)', biggestChunk?.gzip ?? 0, BUDGETS.demoChunkGzip],
  ['total output', total, BUDGETS.totalOutput],
];

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
let failed = false;
for (const [label, value, budget] of checks) {
  const ok = value <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${label.padEnd(28)} ${kb(value).padStart(10)} of ${kb(budget)}`);
}

if (biggestChunk) console.log(`\nlargest lazy chunk: ${biggestChunk.name} (${kb(biggestChunk.gzip)} gzip)`);
process.exit(failed ? 1 : 0);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else found.push(full);
  }
  return found;
}
