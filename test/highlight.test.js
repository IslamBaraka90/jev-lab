import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlight } from '../web/src/lib/highlight.js';

// The code panel shows the project's own sources, so the highlighter is not allowed to change a
// single character of them. It shipped once as four chained replaces, and the later passes rewrote
// the markup the earlier ones had emitted, which showed `class="tok-number"` on the page.

const escape = (code) => code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (html) => html.replace(/<span class="tok-[a-z]+">/g, '').replace(/<\/span>/g, '');

const SAMPLE = `// One trial balance line, with a number and a 'string'.
function trialBalanceLine(random, account) {
  const prior = round(account.base * random.float(0.94, 1.06, 4));
  return { id: \`TB-\${account.code}\`, prior, kind: "clean", ok: a < b && c > d };
}`;

test('highlighting never changes the code it shows', () => {
  assert.equal(strip(highlight(SAMPLE)), escape(SAMPLE));
});

test('markup is emitted once and never highlighted again', () => {
  const html = highlight(SAMPLE);
  assert.equal(html.includes('<span <span'), false, 'a span inside a span means a pass read its own output');
  assert.equal(html.includes('class="tok-number"&gt;'), false, 'an escaped attribute means the markup was re-wrapped');
  assert.equal(html.match(/<span class="tok-/g).length, html.match(/<\/span>/g).length, 'every opened span closes');
});

test('each kind of token is wrapped for what it is', () => {
  const html = highlight(SAMPLE);
  assert.ok(html.includes('<span class="tok-number">0.94</span>'));
  assert.ok(html.includes('<span class="tok-keyword">function</span>'));
  assert.ok(html.includes('<span class="tok-string">"clean"</span>'));
  assert.match(html, /<span class="tok-comment">\/\/ One trial balance line, with a number and a 'string'\.<\/span>/);
});

test('angle brackets in the source cannot become tags', () => {
  const html = highlight('const ok = a < b && c > d;');
  assert.equal(html.includes('a &lt; b'), true);
  assert.equal(html.includes('c &gt; d'), true);
  assert.equal(strip(html).includes('<'), false);
});
