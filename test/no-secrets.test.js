import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// This repository is public. A key that reaches a commit is public the moment it is pushed, and
// rotating it afterwards does not un-publish it — so the guard runs with the ordinary tests rather
// than living in somebody's memory.

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const tracked = () => git('ls-files', '-z').split('\0').filter(Boolean);

/** Shapes that are always a secret, whoever issued them. */
const SECRET_PATTERNS = [
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'an sk- style API key'],
  [/\bghp_[A-Za-z0-9]{20,}/, 'a GitHub personal access token'],
  [/\bgho_[A-Za-z0-9]{20,}/, 'a GitHub OAuth token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, 'a private key'],
];

/** A setting assigned a literal value, rather than left empty or read from the environment. */
const ASSIGNED = /\b(TYPESAFE_API_KEY|API_KEY|SECRET|ACCESS_TOKEN|PASSWORD)\s*[:=]\s*["']?([A-Za-z0-9_\-.]{12,})["']?/;

test('no env file is tracked, and .env is ignored', () => {
  const env = tracked().filter((file) => /(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.env.example'));
  assert.deepEqual(env, [], `these env files are tracked and would be published: ${env.join(', ')}`);

  const ignored = git('check-ignore', '-v', '.env').trim();
  assert.match(ignored, /\.env/, '.env must be covered by .gitignore');
});

test('.env.example carries names, never values', () => {
  const text = readFileSync('.env.example', 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const [, value = ''] = line.split(/=(.*)/s);
    const named = line.split('=')[0].trim();
    if (/KEY|SECRET|TOKEN|PASSWORD/i.test(named)) {
      assert.equal(value.trim(), '', `${named} in .env.example must be left empty`);
    }
  }
});

test('no tracked file contains anything shaped like a credential', () => {
  const offences = [];

  for (const file of tracked()) {
    // Datasets are long strings of numbers and would only ever match by accident.
    if (/\.(json|png|jpg|ico|woff2?)$/.test(file)) continue;

    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    text.split(/\r?\n/).forEach((line, index) => {
      for (const [pattern, what] of SECRET_PATTERNS) {
        if (pattern.test(line)) offences.push(`${file}:${index + 1} looks like ${what}`);
      }
      // The test file itself holds the patterns, so it is allowed to name them.
      if (file.endsWith('no-secrets.test.js')) return;
      const assigned = line.match(ASSIGNED);
      if (assigned && !/process\.env|import\.meta|your-|example|placeholder|\.\.\./i.test(line)) {
        offences.push(`${file}:${index + 1} assigns ${assigned[1]} a literal value`);
      }
    });
  }

  assert.deepEqual(offences, [], `these would be published:\n  ${offences.join('\n  ')}`);
});

test('the live key on this machine is in no commit, ever', { skip: !existsSync('.env') }, () => {
  const key = readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*TYPESAFE_API_KEY\s*=\s*(.+?)\s*$/))
    .find(Boolean)?.[1]
    ?.replace(/^["']|["']$/g, '');

  if (!key || key.length < 12) return;

  // `git log -S` walks the whole history for a commit that added or removed this exact string.
  const found = git('log', '--all', '--oneline', '-S', key).trim();
  assert.equal(found, '', 'the API key in .env appears in the git history and must be scrubbed and rotated');
});
