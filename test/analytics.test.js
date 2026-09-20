import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { startAnalytics } from '../web/src/lib/analytics.js';
import { SITE_URL } from '../web/src/lib/meta.js';

// The repository is public. Somebody who clones it, or deploys a fork, must not report into
// somebody else's analytics property — so both halves of that promise are asserted here, and so is
// the absence of the id from anything that gets committed.

const HOST = new URL(SITE_URL).hostname;

test('a clone with no measurement id sends nothing', () => {
  assert.equal(startAnalytics({ hostname: HOST, id: '' }), 'no-measurement-id');
  assert.equal(startAnalytics({ hostname: HOST, id: '   ' }), 'no-measurement-id');
});

test('a fork or a preview build with the id still sends nothing', () => {
  for (const hostname of ['localhost', '127.0.0.1', 'jev-typesafe-real-financial-use-cas.vercel.app', 'someone-elses-fork.vercel.app', 'thefintechbuilder.com']) {
    assert.equal(startAnalytics({ hostname, id: 'G-TEST123456' }), 'not-the-published-site', `${hostname} must not report`);
  }
});

test('the published host is the one taken from the canonical address', () => {
  assert.equal(HOST, 'jev.thefintechbuilder.com');
  // With no document there is nothing to inject into, which is how it reads in this test runner —
  // the point is that it got past the id and the host checks before finding that out.
  assert.equal(startAnalytics({ hostname: HOST, id: 'G-TEST123456' }), 'no-document');
});

test('the measurement id is not in the repository', () => {
  const example = readFileSync('.env.example', 'utf8');
  const line = example.split(/\r?\n/).find((entry) => entry.startsWith('VITE_GA_ID'));

  assert.ok(line, '.env.example should document the name');
  assert.equal(line.split('=')[1]?.trim(), '', 'and must leave it empty');

  const source = readFileSync('web/src/lib/analytics.js', 'utf8');
  assert.equal(/G-[A-Z0-9]{8,}/.test(source), false, 'no measurement id may be hard-coded');
});
