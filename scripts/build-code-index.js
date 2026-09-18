#!/usr/bin/env node
// Pulls the snippets the site shows out of the real source files, so "how it works" can never drift
// from the code. A region is marked in the source like this:
//
//   // #region demo:state
//   ...
//   // #endregion
//
// and a demo refers to it as `demos/<slug>/demo.js#demo:state`. The build fails if a demo points at a
// region that no longer exists.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from '../src/services/dataset.js';

const SCANNED = ['demos', 'src/services', 'src/strategies', 'scripts/generate', 'web/src/demo'];
const EXTENSIONS = new Set(['.js', '.jsx']);
const MAX_LINES = 40;
const OUTPUT = path.join(repoRoot, 'web', 'src', 'generated', 'code-index.json');

const files = [];
for (const dir of SCANNED) await collect(path.join(repoRoot, dir));

const index = {};
for (const file of files) {
  const relative = path.relative(repoRoot, file).replaceAll('\\', '/');
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  let open = null;

  lines.forEach((line, number) => {
    const start = line.match(/^\s*\/\/\s*#region\s+(\S+)/);
    const end = /^\s*\/\/\s*#endregion/.test(line);
    if (start) {
      open = { key: start[1], startLine: number + 2, body: [] };
      return;
    }
    if (open && end) {
      index[`${relative}#${open.key}`] = snippet(relative, open, number);
      open = null;
      return;
    }
    if (open) open.body.push(line);
  });

  if (open) throw new Error(`${relative}: region "${open.key}" is never closed`);
}

// A demo may point at a whole file instead of a region; that becomes a link with no snippet.
const { ALL_DEMOS } = await import(pathToFileURL(path.join(repoRoot, 'demos', 'index.js')).href);
for (const demo of ALL_DEMOS) {
  for (const [step, key] of Object.entries(demo.explain ?? {})) {
    if (!key.includes('#')) {
      index[key] ??= { path: key, startLine: null, endLine: null, code: null, language: language(key) };
      continue;
    }
    if (!index[key]) throw new Error(`${demo.id} explains its ${step} with "${key}", but that region does not exist`);
  }
}

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(index, null, 2)}\n`);
console.log(`code index: ${Object.keys(index).length} entries → ${path.relative(repoRoot, OUTPUT)}`);

function language(file) {
  return file.endsWith('.json') ? 'json' : 'javascript';
}

function snippet(relative, open, endNumber) {
  const trimmed = trim(open.body);
  if (trimmed.length > MAX_LINES) {
    throw new Error(`${relative}#${open.key} is ${trimmed.length} lines; keep a shown region under ${MAX_LINES} by simplifying the code`);
  }
  return { path: relative, startLine: open.startLine, endLine: endNumber, code: trimmed.join('\n'), language: language(relative) };
}

/** Drops blank edges and the shared indentation, so a snippet reads on its own. */
function trim(body) {
  const lines = [...body];
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)[0].length));
  return lines.map((line) => line.slice(indent));
}

async function collect(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collect(full);
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
}
