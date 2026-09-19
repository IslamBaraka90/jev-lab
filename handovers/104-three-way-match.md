# Handover · Build demo 104, three-way match

You are picking up one task in a project you have not seen. Read this file top to bottom before you
touch anything. It tells you what the project is, what to build, which files are yours, which files
other agents may be editing right now, and the traps that cost the first three builds time.

**Your task:** implement [`prps/104-three-way-match.md`](../prps/104-three-way-match.md). That file is
the specification. This file is how to work here.

**Base commit:** `9532cb4` on `main`. Branch from there.

---

## 1. What this project is, in one minute

- **Jev** is a model from TypeSafe. You send it a `state` (any JSON) and a set of **typed questions**,
  and it answers all of them in one call: a choice question returns a probability for every option plus
  a confidence, a score question returns a position on a rubric, a yes/no question returns the
  probability of yes. It never returns prose, and it never invents a field.
- **This repository** is a demo site that puts those questions to real financial work. Fifty demos are
  specified in `prps/`; three are built and recorded — 101 ledger integrity, 102 bank reconciliation,
  103 expense posting. Yours is the fourth.
- **The deployed site is static.** It replays answers recorded once and committed here: no API key, no
  server, no network. Recording is the only paid step and it is the owner's decision, never yours.
- There is also an older **backtest lab** under `/lab`. You will not touch it.

Read these before writing code, in this order:

1. `prps/README.md` — how a PRP works and the repo layout.
2. `prps/004-demo-runtime.md` — the contract your demo must satisfy.
3. `demos/bank-reconciliation/demo.js` — the closest demo to yours: several documents per item, an
   arithmetic identity proved in the report, and all of it inside the plain table view.
4. `demos/expense-posting/notes.md` — what a good explainer reads like, including admitting when the
   dataset turned out easier than intended.

---

## 2. Concurrency: the rules that matter most

Demo 102 was built by another agent on its own branch while demo 103 was built on `main`; both are now
merged. More demos may be started beside yours at any time. **Run `git branch -a` and `git worktree
list` before your first commit** so you know who else is in the tree.

### 2.1 Branch and commits

```bash
git switch -c demo/104-three-way-match 9532cb4
```

- Commit only your own paths, named explicitly. **Never `git add -A` or `git add .`** from the repo
  root: another agent's half-finished files live in the same tree.
  ```bash
  git add demos/three-way-match scripts/generate/three-way-match.js \
          data/synthetic/three-way-match.labels.json test/three-way-match.test.js
  git add demos/index.js scripts/generate/index.js web/src/generated/code-index.json
  ```
- Commit messages describe the change and nothing else: no attribution lines, no tool names, no
  "generated with" footers. That is a hard rule here; the repository is published under the owner's
  name. Read `git log` for the house style — a short subject, a blank line, plain prose.
- Rebase onto `main` before handing back. Never force-push, never amend or rebase a commit you did not
  write, never resolve a conflict by deleting someone else's line.
- Do not commit `web/dist/`, `results/` or `screenshots/` (already ignored). Do commit
  `web/src/generated/code-index.json` — your four regions change it.

### 2.2 Shared files: three, one line each

| File | Your edit | Conflict rule |
|---|---|---|
| `demos/index.js` | one `import`, one entry in `DEMOS` | keep entries in demo-number order: ledgerIntegrity, bankReconciliation, expensePosting, threeWayMatch |
| `scripts/generate/index.js` | one line in `GENERATORS` | same order |
| `web/src/styles/demo.css` | **append only**, at the end, under a comment naming your demo | never edit rules above your block |

**Do not touch:** `web/src/demo/DemoRuntime.jsx`, `web/src/demo/panels.jsx`,
`web/src/demo/widgets.jsx`, `web/src/demo/views/*`, `web/src/lib/*`, `src/services/*`,
`scripts/record-demo.js`, `scripts/build-code-index.js`, `package.json`, `demos/lib/*`, `prps/00*.md`,
`test/demo-contract.test.js`, `test/generators.test.js`.

If you believe the shared runtime needs a change, **stop and put it in your hand-back note** rather
than editing it from your branch. Demo 102 wanted a two-pane view and did not get one; it shipped in
the table view and the demo is better for it (§4.5).

### 2.3 Processes, ports and money

- The owner runs a server on **port 3000**. Never kill a process you did not start, never bind to 3000.
- To look at the site, build it and serve the static output on **your own port**:
  `npm run serve:static -- web/dist 3212`. It serves exactly what the deploy serves and **refuses
  `/api/*` with a logged 404**, so a demo reaching for the model is obvious and free.
- **Never start the Express server while a key is in `.env`.** It marks the page live-capable, and a
  click can then spend real requests. That happened once in this project: about 24 requests went out
  during a careless browser check.
- `npm run generate` with no argument regenerates **every** dataset, including other agents' work in
  progress. Always pass your slug: `npm run generate three-way-match`.
- **Recording is paid and is the owner's call.** Build everything, leave the demo in its
  `pending-recording` state, and hand back an estimate (§6.1). Do not run `npm run record`.

---

## 3. How a demo is put together

One folder plus one registry line. The page, the replay, the answer cards, the report widgets and the
code panel are shared; you write none of them.

```
demos/three-way-match/
  demo.js         metadata, state builder, questions, evaluation, report
  data.json       the dataset, written by your generator, committed
  fixtures.json   recorded answers, committed (placeholder until recording)
  notes.md        the explainer: the data, what was planted, what the run found
scripts/generate/three-way-match.js              the seeded generator
data/synthetic/three-way-match.labels.json       ground truth, written by the generator
test/three-way-match.test.js                     your tests
```

### 3.1 The dataset envelope

```json
{
  "id": "three-way-match",
  "class": "synthetic",
  "generatedAt": "2026-09-19",
  "seed": 1104,
  "source": "scripts/generate/three-way-match.js",
  "context": { "shared by every item": true },
  "items": [{ "id": "P-0001" }]
}
```

Validated by `demos/lib/dataset-shape.js`. Item ids are unique, stable and URL-safe; the site
deep-links them as `?item=P-0001`.

### 3.2 Ground truth

Your generator plants problems deliberately and writes them to
`data/synthetic/three-way-match.labels.json`, **outside the demo folder**, so no state builder can
import them. Give every label a field ending in `Id` that names its item (`packetId` is right) — the
generator contract test accepts any such field. The report reads labels; `buildState` and `evaluate`
never do.

### 3.3 The demo object

```js
export default {
  id: 'three-way-match', title, domain: 'books', value, tags,
  dataClass: 'synthetic', readMinutes, view,
  status: 'pending-recording',                 // remove when fixtures exist
  itemLabel: (item) => `${item.id} · ${item.supplier} · ${money(item.invoice.total)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/three-way-match.labels.json'),
  buildState, questions, evaluate, report,
  explain: { data, state, questions, evaluate },
};
```

- `buildState(item, context)` is **pure**; `context` is the dataset's `context` plus `items`.
- `questions` is an **object keyed by question name** — `{ mismatch: choice(...), within_tolerance:
  noul(...), overbilling_risk: score(...), hold_payment: noul(...) }` — built with
  `demos/lib/questions.js`. Never import the SDK in a demo.
- `evaluate(answers, item, context)` → the small object the page shows, reading `answers.mismatch` and
  so on. No label access.
- `report(results, context)` → `{ note, findings, kpis, distribution, matrix, curve, checks, topItems }`,
  all optional except `kpis`. `context.labels` is the ground truth.

### 3.4 Report widgets you can use

`KpiRow`, `DistributionBar`, `CheckList`, `TopItems`, `ConfusionMatrix`, and `CoverageCurve`. The curve
takes points of `{ threshold, reviewed, caught, rate }`, where `rate` is optional and draws a dashed
second line — use it for "how much of what is held back is really wrong". Labels are yours: `xLabel`,
`yLabel`, `rateLabel`. KPIs take an optional `tone: 'good' | 'warn'`.

### 3.5 Recorded answers

`fixtures.json` maps item id → answers. Score answers are stored without their rubric and restored on
read (`demos/lib/answers.js`), so never hand-write or hand-edit one. Commit this placeholder first, or
the bundler cannot resolve the import:

```json
{
  "demo": "three-way-match",
  "model": null,
  "recordedAt": null,
  "source": "not recorded yet — run: npm run record three-way-match",
  "answers": {}
}
```

### 3.6 The code panel

Four snippets per demo — data, state, questions, evaluation — extracted at build time from
`// #region <key>` … `// #endregion` and named in `demo.explain`. **A shown region must be 40 lines or
fewer or the build fails.** Keep helpers outside the regions; those four blocks get read aloud in a
video.

---

## 4. What to build

The specification is `prps/104-three-way-match.md`. This section adds the decisions the earlier builds
settled.

### 4.1 Data (`scripts/generate/three-way-match.js`, seed 1104)

150 packets from 40 suppliers. Each packet is three documents that should agree:

- **Purchase order:** lines of item, quantity, unit price, currency, incoterm.
- **Goods receipt:** quantity received, date, condition.
- **Invoice:** quantity billed, unit price, tax, freight, total.

Plant, and label: 9 unit-price increases above tolerance, 7 over-billed quantities, 5 tax errors,
4 currency mismatches, 3 duplicate invoices against one receipt, 6 partial deliveries billed in full.
Then plant **8 differences that sit inside tolerance and must not be flagged** — they matter as much as
the problems, and the report counts them separately.

Tolerances live in `context` (2% on price, 1 unit on quantity) and are part of the state, so a verdict
can be judged against a stated rule rather than a hunch.

Labels: `{ packetId, mismatch, amountAtRisk, kind }`, where `kind` is the difficulty group
(`problem` / `within-tolerance` / `clean`). That split is what makes the report worth reading.

Helpers: `scripts/generate/lib/random.js` (seeded; never `Math.random`), `lib/names.js` (invented
suppliers), `lib/money.js` — `unitPrice`, `percentOf`, `split` and `round` are made for invoice lines.

Budgets: dataset under 500 KB; expect roughly 1 KB of fixture per item once recorded.

### 4.2 State

The three documents in full, the supplier's agreed tolerances and payment terms, and **the last two
packets from the same supplier** — that history is the only way a duplicate invoice is findable,
exactly as vendor history was in demo 103.

**Do not precompute the differences.** The arithmetic is part of what is being tested: no
`priceVariance`, no `totalDifference`, no `isDuplicate`. Compute those in the *report* instead, to show
money at risk beside the model's own risk score.

One hard-won rule: before adding a field to a state, ask whether it decides the question by itself. An
earlier draft of demo 103 put a vendor-to-account map in the dataset, which handed over the answer for
335 of 400 items and would have made its accuracy number meaningless.

### 4.3 Questions (four)

`mismatch` (choice: `PRICE`, `QUANTITY`, `TAX`, `CURRENCY`, `DUPLICATE`, `PARTIAL_DELIVERY`, `NONE`),
`within_tolerance` (yes/no), `overbilling_risk` (score 0–6: None · Negligible · Low · Moderate · High ·
Severe · Certain), `hold_payment` (yes/no). Give every option a one-line description; the page shows
them.

### 4.4 Report

- **KPIs:** packets reviewed, problems caught, false holds, money at risk held against money missed.
- **checks:** one per planted kind plus the within-tolerance group, in the shape
  `{ id, label, detail, count, of, items }` — copy the `difficulty()` helper in
  `demos/expense-posting/demo.js`.
- **matrix:** planted mismatch against the one named.
- **curve:** the risk-score threshold against packets held and problems caught, with `rate` as the
  share of holds that were real.
- **An identity, proved.** Demo 102's report shows that the opening balance plus every bucket equals
  the statement close, so the arithmetic is visibly right. Do the same with money: held plus released
  equals the file's total at risk, on partial runs too.
- **findings:** the single most repeated mistake, if there is one. All three earlier demos have this
  line and it is the one people quote.
- **Never round a rate up to a clean number.** 149 of 150 is 99.3%, not 100%; demo 103 printed "100%"
  for 399 of 400 until that was fixed.

### 4.5 The view

The runtime draws items with `table`, `ledger` or `queue`. The PRP sketches three panes; **build with
`view: 'table'`**. Demo 102 faced the same shape — one statement line against five candidate entries —
and shipped in the table view by putting the records in the state and writing a dense `itemLabel`. It
reads well on camera and cost no shared-file changes. If you still want a `documents` view after
building, **ask for it in your hand-back** (§2.2); do not add one, and do not put JSX in your demo
folder.

### 4.6 Tests (`test/three-way-match.test.js`)

Model them on `test/expense-posting.test.js` and `test/bank-reconciliation.test.js`:

- the dataset has the planted counts it claims, including the 8 within-tolerance packets;
- the state carries all three documents, the tolerances and the supplier history, and no label text;
- a perfect set of stand-in answers catches every problem, holds no within-tolerance packet, and
  produces no findings;
- a lazy set ("hold everything") shows a false-hold rate equal to the clean packets;
- money held plus money released equals the file's total at risk;
- the curve's held count falls as the threshold rises.

Stand-in answers are built in the test file. No test touches the network.

---

## 5. Traps that have already cost time here

1. **Tests can pass while the page is broken.** A missing import in the browser replay path left every
   node test green and every run in the page throwing. Always finish with a real browser check (§6.2).
2. **`chars / 4` underestimates tokens about 3.5×** for this kind of structured JSON. Demo 101 was
   estimated at 221K and cost 679K. Use the correction in §6.1.
3. **`fixtures.json` must exist before `npm run build`**, even empty.
4. **A shown region over 40 lines fails the build.** It caught demo 103's `report`; the fix is to move
   helpers out of the region, not to shorten names.
5. **Determinism is enforced.** `npm run generate three-way-match` twice must leave `git status` clean.
   Sort anything built from a `Map` or `Set` before writing it.
6. **No ground truth in the dataset**, and no field that decides the answer on its own (§4.2).
7. **Do the mechanical work in the generator, not in the state.** Demo 102 ranks and stores five
   candidate entries at generation time, so the recorded run is reproducible and the model is asked to
   judge rather than to search. Your supplier history is the same idea: two prior packets, chosen by a
   rule that never reads a label.
8. **Design the difficulty on purpose and report it group by group.** Demo 103 scored 99.8% because
   three charges in four were effectively a lookup; only the 30 deliberately ambiguous rows said
   anything. Your 8 within-tolerance packets and 6 partial deliveries are the rows that matter.
9. **Windows shell notes.** Use bash heredocs for multi-line commit messages, not PowerShell
   here-strings. Prefer a small Python or Node script over shell quoting for multi-line source edits.
   Use `pathToFileURL` when importing an absolute path in a script. Kill stale `msedge.exe` before a
   headless browser run and pass **absolute** paths for its user-data directory.
10. **`status: 'pending-recording'`** stays on the demo until fixtures exist. A contract test fails both
    ways: a demo claiming to be recorded that is not, and a fully recorded demo still claiming pending.
11. **Your demo appears in the catalog as soon as it is in `DEMOS`.** With the pending status it gets an
    "Answers not recorded yet" badge and disabled run buttons. That is the intended intermediate state;
    do not hide it instead.
12. **Long snippets used to overflow the walkthrough grid**; demo 102 fixed that by appending two rules
    to `demo.css`. If your three-document state overflows somewhere else, fix it in your own appended
    block.

---

## 6. Commands

### 6.1 Build, check, estimate

```bash
npm install                          # once
npm run generate three-way-match
npm test                             # all tests, offline
npm run build                        # runs the code-index step first
npm run check                        # size budgets, then the tests
```

The recording estimate, without spending anything:

```bash
node --input-type=module -e "
const demo = (await import('./demos/three-way-match/demo.js')).default;
const { loadDataset } = await import('./src/services/dataset.js');
const { demoContext } = await import('./src/services/demo-runner.js');
const d = await loadDataset('three-way-match');
const ctx = demoContext(d);
const chars = d.items.reduce((sum, item) => sum + JSON.stringify(demo.buildState(item, ctx)).length, 0);
console.log('input tokens ~', Math.round((chars / 4) * 3.5));
console.log('output tokens ~', d.items.length * 250);
console.log('minutes ~', Math.round(d.items.length / 60));
"
```

The 3.5 is measured, not guessed: the two most recently recorded demos came in at 3.55× (102, 60 items,
1,952 chars of state each) and 3.51× (103, 400 items, 1,579 chars each) over `chars / 4`. Output ran
205–255 tokens per item for four questions. Demo 101, with a larger state and five questions, came in
at 3.07×, so treat 3.5 as the estimate and expect a big state to land a little under it.

### 6.2 Look at it, safely

```bash
npm run build
npm run serve:static -- web/dist 3212
```

Open `http://127.0.0.1:3212/demos/three-way-match`, click through a few packets, confirm the four code
snippets and the data chip are there, then stop the server. Any `/api/*` call is logged and refused, so
if one shows up in the log, something is wrong.

### 6.3 Recording (owner's decision)

```bash
node scripts/record-demo.js three-way-match --dry-run   # free; prints what it would send
npm run record three-way-match                          # only after the owner says yes
```

The recorder retries each item once, saves every 25, skips items already answered, and keeps going past
a failure, so a run is resumable.

---

## 7. Where things are

| Path | What it is |
|---|---|
| `prps/104-three-way-match.md` | your specification |
| `prps/README.md`, `prps/001`–`006` | foundations: demo mode, data, structure, runtime, code panel, quality bar |
| `demos/index.js` | the registry the catalog, router, recorder and tests read |
| `demos/lib/questions.js` · `answers.js` · `dataset-shape.js` | question builders, fixture compaction, the envelope |
| `demos/bank-reconciliation/` | several documents per item, an identity proved in the report, table view |
| `demos/expense-posting/` | difficulty groups, and a coverage curve with a rate line |
| `demos/ledger-integrity/` | the first demo, and a cautionary tale in its notes |
| `scripts/generate/lib/` | seeded random, invented names, money helpers |
| `scripts/serve-static.js` | the safe way to view the built site |
| `src/services/dataset.js` · `demo-runner.js` | loading and the shared run loop |
| `web/src/demo/` | runtime, views, panels, widgets (read, do not edit) |
| `test/demo-contract.test.js` | the contract every demo must pass |
| `handovers/102-bank-reconciliation.md` | the same rules, written one demo earlier |

Git history, newest first:

```
9532cb4  Record the bank reconciliation demo
40b7fd2  Add the bank reconciliation demo
6cbfddf  Record the expense demo's answers
6e278b5  Merge demo 103, expense posting
aebd44e  Add the expense posting demo
9d8e6ef  Let a coverage curve carry a rate, and labels point at items by any Id field
a57a8dc  Add the handover for demo 102
9cab67d  Add a static server for looking at the built site
4d597a1  Fix the replay path losing its answer expansion
f3b30a8  Record the ledger demo's answers
ee71758  Add the ledger integrity demo
46821f9  Add the demo site: catalog, runtime and code walkthrough
f1df510  Add demo mode and the data foundation
a20abc9  Add backtest lab and demo PRPs
```

---

## 8. Done means

- [ ] `npm run generate three-way-match` twice leaves `git status` clean.
- [ ] `npm test` passes, including your file and the contract tests.
- [ ] `npm run check` passes its budgets.
- [ ] The page renders from the **static build** with the data, the state panel, the four code
      snippets, the data chip and the pending-recording notice, and no `/api/*` call appears in the
      server log.
- [ ] `notes.md` explains the data, the planted problems, the eight within-tolerance packets, why
      duplicates are only findable through supplier history, and why a false hold costs as much as a
      missed one.
- [ ] Your branch holds only your files plus the minimal shared-file lines, rebased onto `main`.
- [ ] `prps/104-three-way-match.md` updated wherever the build settled something the spec left open.

## 9. Hand back

1. What you built, and anything in the PRP you changed and why.
2. The measured recording estimate: requests, input and output tokens, minutes.
3. Shared-runtime requests, with the `documents` view named explicitly if you still want it.
4. Any trap worth adding to the next handover.
