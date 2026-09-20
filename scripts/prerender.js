// Writes a real HTML file for every address the site answers, each with its own title, description,
// canonical link and structured data, plus a sitemap and a robots file.
//
// The app renders in the browser, so without this every one of the sixty-three pages would ship the
// same head: one title, one description, one preview card. Search engines that run JavaScript would
// eventually sort it out; the crawlers behind link previews — Slack, LinkedIn, WhatsApp, most of
// Bing — do not run any, and would show the home page's words for all fifty demos.
//
// Vercel serves a matching file before it applies a rewrite, so `/demos/x/index.html` answers
// `/demos/x` and the single-page app takes over from there.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'web', 'dist');

const { metaFor, siteRoutes, SITE_URL, SITE_NAME } = await import('../web/src/lib/meta.js');

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Replaces the head of the built index.html with the head this page should have. */
function pageHtml(shell, meta) {
  const tags = [
    `<title>${escape(meta.title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}" />`,
    `<link rel="canonical" href="${escape(meta.canonical)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    meta.keywords?.length ? `<meta name="keywords" content="${escape(meta.keywords.join(', '))}" />` : '',
    `<meta property="og:type" content="${escape(meta.type)}" />`,
    `<meta property="og:site_name" content="${escape(SITE_NAME)}" />`,
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    `<meta property="og:url" content="${escape(meta.canonical)}" />`,
    `<meta property="og:image" content="${escape(`${SITE_URL}/og.png`)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escape(meta.title)}" />`,
    `<meta name="twitter:description" content="${escape(meta.description)}" />`,
    `<meta name="twitter:image" content="${escape(`${SITE_URL}/og.png`)}" />`,
    ...(meta.jsonLd ?? []).map((block) => `<script type="application/ld+json">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`),
  ].filter(Boolean);

  // Drop the head tags the shell ships with, so nothing is declared twice.
  return shell
    .replace(/\s*<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/g, '')
    .replace(/\s*<meta property="og:[^"]*"[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^"]*"[^>]*>/g, '')
    .replace('</head>', `  ${tags.join('\n    ')}\n  </head>`);
}

const shell = await readFile(path.join(dist, 'index.html'), 'utf8');
const routes = siteRoutes();
const today = new Date().toISOString().slice(0, 10);

for (const route of routes) {
  const meta = metaFor(route.path);
  const html = pageHtml(shell, meta);
  const file = route.path === '/' ? path.join(dist, 'index.html') : path.join(dist, route.path.slice(1), 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

// The not-found page is written too, so a mistyped address is still a real page rather than the home
// page's head on somebody else's screenshot.
await writeFile(path.join(dist, '404.html'), pageHtml(shell, metaFor('/not-found')));

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map((route) => `  <url><loc>${SITE_URL}${route.path}</loc><lastmod>${today}</lastmod><priority>${route.priority}</priority></url>`),
  '</urlset>',
].join('\n');
await writeFile(path.join(dist, 'sitemap.xml'), `${sitemap}\n`);

await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`prerendered ${routes.length} pages, a sitemap and robots.txt into web/dist`);
