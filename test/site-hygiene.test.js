import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Two mistakes that are invisible in a diff and obvious on the page: text saved in the wrong
// encoding, and a style that leans on a design token nobody defined. Both shipped once.

const tracked = (pattern) =>
  execFileSync('git', ['ls-files', '-z', '--', ...pattern], { encoding: 'utf8' }).split('\0').filter(Boolean);

test('no source file carries double-encoded text', () => {
  // UTF-8 read as Latin-1 and saved again turns "·" into "Â·" and "—" into "â€”".
  const broken = /Â[ -¿]|â€/;
  const files = tracked(['web/src/**/*.jsx', 'web/src/**/*.js', 'web/src/**/*.css', 'web/index.html', 'demos/**/*.js']);
  const bad = files.filter((file) => broken.test(readFileSync(file, 'utf8')));
  assert.deepEqual(bad, [], `these files contain double-encoded characters: ${bad.join(', ')}`);
});

test('every design token a style uses is defined', () => {
  const files = tracked(['web/src/styles/*.css']);
  const css = files.map((file) => readFileSync(file, 'utf8')).join('\n');
  const defined = new Set([...css.matchAll(/(^|[\s;{])(--[A-Za-z0-9-]+)\s*:/g)].map((match) => match[2]));
  // A custom property set from a component's inline style is defined there, not in a stylesheet.
  const inline = new Set(
    tracked(['web/src/**/*.jsx']).flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/['"](--[A-Za-z0-9-]+)['"]\s*:/g)].map((match) => match[1])),
  );
  const used = new Set([...css.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/g)].map((match) => match[1]));
  const missing = [...used].filter((name) => !defined.has(name) && !inline.has(name)).sort();
  assert.deepEqual(missing, [], `these tokens are used and never defined: ${missing.join(', ')}`);
});
