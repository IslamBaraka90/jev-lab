import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEMOS } from '../demos/index.js';
import { matchRoute } from '../web/src/lib/routes.js';

// The router is the one place where a mistake takes a whole page down rather than showing a wrong
// number, and nothing covered it before the lab was removed.

test('the site pages resolve', () => {
  assert.equal(matchRoute('/').page, 'home');
  assert.equal(matchRoute('/demos').page, 'catalog');
  assert.equal(matchRoute('/benchmark').page, 'benchmark');
  assert.equal(matchRoute('/about').page, 'about');
  assert.equal(matchRoute('/demos/').page, 'catalog', 'a trailing slash is the same page');
});

test('every demo in the registry has an address that resolves to it', () => {
  for (const demo of DEMOS) {
    const route = matchRoute(`/demos/${demo.id}`);
    assert.equal(route.page, 'demo', `${demo.id} does not resolve`);
    assert.equal(route.id, demo.id);
    assert.ok(route.title && route.title !== 'Demo', `${demo.id} has no title in the catalog manifest`);
  }
});

test('the backtest lab is not part of the published site', () => {
  for (const path of ['/lab', '/lab/compare', '/lab/runs/abc', '/lab/runs/abc/theater', '/compare', '/runs/abc']) {
    const route = matchRoute(path);
    assert.equal(route.redirect, '/demos', `${path} should send people to the demos`);
    assert.equal(route.area, undefined, `${path} must not resolve to a lab area`);
  }
});

test('anything else is the not-found page', () => {
  for (const path of ['/nope', '/demos/not-a-demo/extra', '/domains/']) {
    assert.equal(matchRoute(path).page, 'missing', `${path} should not resolve`);
  }
  // A demo id that does not exist still routes, and the page reports it — that is the demo page's job.
  assert.equal(matchRoute('/demos/not-a-demo').page, 'demo');
});
