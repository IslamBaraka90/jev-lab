import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEMOS } from '../demos/index.js';
import { DOMAINS } from '../demos/domains.js';
import { metaFor, siteRoutes, SITE_URL } from '../web/src/lib/meta.js';

// The site renders in the browser, so the head the build writes into each page is the only thing most
// crawlers ever read. A duplicate title across fifty pages is invisible in the app and fatal in search.

test('every route the sitemap lists has a title and a description', () => {
  const routes = siteRoutes();
  assert.equal(routes.length, 4 + DOMAINS.length + DEMOS.length);

  for (const route of routes) {
    const meta = metaFor(route.path);
    assert.ok(meta.title, `${route.path} has no title`);
    assert.ok(meta.description, `${route.path} has no description`);
    assert.equal(meta.canonical, `${SITE_URL}${route.path}`, `${route.path} has the wrong canonical`);
    assert.equal(meta.noindex, undefined, `${route.path} must be indexable`);
  }
});

test('no two pages share a title or a description', () => {
  const routes = siteRoutes();
  const titles = new Map();
  const descriptions = new Map();

  for (const route of routes) {
    const meta = metaFor(route.path);
    assert.equal(titles.has(meta.title), false, `${route.path} reuses the title of ${titles.get(meta.title)}`);
    assert.equal(descriptions.has(meta.description), false, `${route.path} reuses the description of ${descriptions.get(meta.description)}`);
    titles.set(meta.title, route.path);
    descriptions.set(meta.description, route.path);
  }
});

test('titles and descriptions stay inside what a search result shows', () => {
  for (const route of siteRoutes()) {
    const meta = metaFor(route.path);
    assert.ok(meta.title.length <= 70, `${route.path} title is ${meta.title.length} characters: ${meta.title}`);
    assert.ok(meta.description.length <= 165, `${route.path} description is ${meta.description.length} characters`);
    assert.ok(meta.description.length >= 70, `${route.path} description is too thin at ${meta.description.length} characters`);
  }
});

test('a demo page describes that demo and nothing else', () => {
  const demo = DEMOS[0];
  const meta = metaFor(`/demos/${demo.id}`);

  assert.match(meta.title, new RegExp(demo.title.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(meta.description.startsWith(demo.value.slice(0, 40)), 'the demo’s own one-liner leads the description');
  assert.equal(meta.type, 'article');
  assert.ok(meta.keywords.includes('jev'));
  assert.equal(meta.jsonLd[0]['@type'], 'TechArticle');
  assert.equal(meta.jsonLd[0].url, `${SITE_URL}/demos/${demo.id}`);
});

test('an address that does not exist is not offered to search engines', () => {
  const meta = metaFor('/nope');
  assert.equal(meta.noindex, true);
  assert.equal(siteRoutes().some((route) => route.path === '/nope'), false);
});

test('the lab is not in the sitemap', () => {
  const paths = siteRoutes().map((route) => route.path);
  for (const path of paths) assert.equal(path.startsWith('/lab'), false, `${path} should not be published`);
});

// The prerendered files are the artefact that actually ships. A second canonical or title in the
// head is invisible in the browser and tells a crawler the opposite of what the page means.
test('each built page declares each head tag exactly once', { skip: !existsSync('web/dist/index.html') }, () => {
  const pages = ['index.html', 'demos/index.html', 'about/index.html', ...DEMOS.slice(0, 5).map((demo) => `demos/${demo.id}/index.html`)];

  for (const page of pages) {
    const html = readFileSync(`web/dist/${page}`, 'utf8');
    for (const [pattern, what] of [[/<title>/g, 'title'], [/rel="canonical"/g, 'canonical'], [/name="description"/g, 'description'], [/property="og:title"/g, 'og:title'], [/name="robots"/g, 'robots']]) {
      assert.equal(html.match(pattern)?.length ?? 0, 1, `${page} has ${html.match(pattern)?.length ?? 0} of ${what}`);
    }
    assert.match(html, /<link rel="canonical" href="[^"]+" \/>/);
  }
});
