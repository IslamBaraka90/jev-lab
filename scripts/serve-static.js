#!/usr/bin/env node
// Serves a built site the way the deployed one is served: static files, SPA fallback, and no API.
// Use this to look at the site while working on a demo. The Express server reads .env and marks the
// page live-capable, which can spend real requests; this cannot.
//
// Usage: node scripts/serve-static.js [dir=web/dist] [port=3210]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '../src/services/dataset.js';

const root = path.resolve(repoRoot, process.argv[2] ?? 'web/dist');
const port = Number(process.argv[3] ?? 3210);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');

  // The deployed site has no API. Anything asking for one is a bug worth seeing.
  if (url.pathname.startsWith('/api/')) {
    console.warn(`blocked: ${request.method} ${url.pathname}`);
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('no API on the static site');
    return;
  }

  const wanted = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, ''));
  if (!wanted.startsWith(root)) {
    response.writeHead(403).end('outside the site');
    return;
  }

  try {
    const body = await readFile(wanted);
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(wanted)] ?? 'application/octet-stream' }).end(body);
  } catch {
    // Client-side routes fall back to the page, exactly like the deploy's rewrite rule.
    response.writeHead(200, { 'Content-Type': TYPES['.html'] }).end(await readFile(path.join(root, 'index.html')));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`static site on http://127.0.0.1:${port} from ${path.relative(repoRoot, root)}`);
  console.log('no API, no key, nothing paid. Stop it with Ctrl+C.');
});
