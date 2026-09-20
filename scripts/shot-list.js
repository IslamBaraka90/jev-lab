#!/usr/bin/env node
// Prints a demo's video beats with the address of each one, ready to paste into a production document.
// The beats come from the same `present` field presenter mode plays, so the list and the screen agree.
//
//   node scripts/shot-list.js dispute-routing
//   node scripts/shot-list.js --all --base https://jev-lab.example
//   node scripts/shot-list.js fraud                 every demo in a domain

import { DEMOS, DOMAIN_BY_ID, findDemo } from '../demos/index.js';

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const base = (baseIndex >= 0 ? args[baseIndex + 1] : 'http://localhost:3000').replace(/\/$/, '');
const wanted = args.find((arg, index) => !arg.startsWith('--') && (baseIndex < 0 || index !== baseIndex + 1));

const chosen = args.includes('--all') ? DEMOS : DOMAIN_BY_ID[wanted] ? DEMOS.filter((demo) => demo.domain === wanted) : [findDemo(wanted)].filter(Boolean);

if (!chosen.length) {
  console.error('Usage: node scripts/shot-list.js <demo | domain | --all> [--base https://site]');
  process.exit(1);
}

const BEATS = [
  ['The job', (story) => `${story.problem.headline}  [${story.problem.stat} ${story.problem.statLabel}]`],
  ['One item', (story) => `${story.hero.item}: ${story.hero.caption}`],
  ['Typed answers', (story) => story.answers.caption],
  ['Where it missed', (story) => `${story.miss.item}: ${story.miss.caption}`],
  ['The whole run', (story) => `${story.proof.kpis.join(' · ')}  →  ${story.proof.closing}`],
];

for (const demo of chosen) {
  const story = demo.present;
  console.log(`\n${story?.number ?? '···'} · ${demo.title}  (${DOMAIN_BY_ID[demo.domain].title})`);
  if (!story) {
    console.log(`  no present story written yet; presenter mode falls back to a generic one\n  ${base}/demos/${demo.id}?present=1`);
    continue;
  }
  BEATS.forEach(([name, describe], index) => {
    console.log(`  ${index + 1}. ${name.padEnd(16)} ${base}/demos/${demo.id}?present=1&beat=${index + 1}`);
    console.log(`     ${describe(story)}`);
  });
  console.log(`  +  the item on the page  ${base}/demos/${demo.id}?item=${encodeURIComponent(story.hero.item)}`);
}
