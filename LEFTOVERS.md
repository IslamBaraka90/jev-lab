# Leftovers

Open items parked deliberately, so the demo series keeps moving. Each one says what is wrong, what it
would cost to fix, and what the fix actually is. Nothing here blocks building the next demo.

Last reviewed after demo 121, with 101 to 105, 111, 113, 115 and 121 built and recorded.

---

## 1. Decisions that cost a paid re-record

### 1.1 Demo 101 treats input VAT as a payable

`demos/ledger-integrity/` · 502 recorded answers

The run raised 75 false alarms, and **68 of them are the same objection**: input VAT debited to "VAT
payable". The model is right and the dataset is wrong — there is no VAT receivable account in the
chart, so the generator had nowhere else to put it. The demo currently reports this in its findings
line rather than hiding it.

- **Fix:** add a VAT receivable account to the chart of accounts, regenerate seed 1101, re-record.
- **Cost:** 502 requests, roughly 680K input and 128K output tokens.
- **Why parked:** the demo is honest as it stands, and the note explains the convention. Worth doing
  before the video is recorded, because 68 identical false alarms are hard to narrate.

### 1.2 Demo 103's dataset is too easy

`demos/expense-posting/` · 400 recorded answers

399 of 400 correct, which says more about the file than the model: three charges in four come from a
vendor that only ever posts to one account, and the state shows up to three earlier postings from that
vendor, so those rows are a lookup rather than a judgement.

- **Fix:** cap `priorPostings` at one, or drop it for the ambiguous vendors, then re-record.
- **Cost:** 400 requests, roughly 555K input and 102K output tokens.
- **Why parked:** the caveat is written into `notes.md`, and the calibration result — the single wrong
  answer is also the least confident one — is worth showing as it is.

---

## 2. Waiting on a value or an action

### 2.1 The repository URL is a placeholder

`web/src/lib/links.js` falls back to `https://github.com/set-VITE_REPO_URL`, so every "run it yourself"
and "open this file" link is dead until `VITE_REPO_URL` is set at build time. `VITE_REPO_REF` defaults
to `main`, which means line links drift as the code moves — pin it to a commit for the video build.

### 2.2 Two finished demos are not merged

Four finished demos sit on a chain of branches, each built on the one before: `demo/105-close-blockers`,
`demo/111-order-risk`, `demo/113-dispute-routing` and the 115 and 121 work on top of it. Between them
they also carry three fixes every demo page needs — the code panel was rewriting its own markup, the
front page only showed the first three demos, and the evaluation strip could not render a call body.
None of it could be merged because `main` was checked out in another worktree at the time. From
whichever worktree holds `main`, one merge brings the lot:

```
git merge --no-ff demo/113-dispute-routing
```

### 2.3 Nothing has been deployed yet

`vercel.json` is written (static build, SPA rewrites, immutable asset caching) but no deploy has run.
Worth doing once with a throwaway project to confirm three things: the build command works from a clean
checkout, no `/api/*` route exists in the output, and the demo pages replay their fixtures with the
network tab empty.

---

## 3. Unbuilt pieces of the foundation PRPs

### 3.1 `scripts/shot-list.js` does not exist

PRP 005 asks for `node scripts/shot-list.js <demo>` to print the video beats with working deep links.
The deep links themselves work (`?item=…&phase=scored` is handled in `DemoRuntime.jsx`), so this is a
small script over each demo's PRP beats, not new runtime work.

### 3.2 The queue cannot re-order itself on screen

Demo 121 compares two orderings of the same four hundred alerts — the rules engine's, and the model's —
and the comparison only exists in the report, with the top of the new ordering listed alongside each
alert's old rank. PRP 121 asks for both orderings to be playable. That needs the runtime to sort a
queue by an evaluation field, which is a shared-runtime change and the single most video-worthy one
outstanding.

### 3.3 A multi-document view has not been decided

Demo 102 wanted two panes and shipped in the plain `table` view instead, which reads well. Demo 104 has
three documents per item and has been told to do the same and ask afterwards. If a `documents` view is
worth adding, it should be added once, by whoever owns `web/src/demo/views/`, not by a demo branch.

### 3.4 The coverage curve's text alternative ignores its rate line

`CoverageCurve` has an `aria-label` and a table behind a toggle, but both were written before the
optional dashed `rate` series existed, so a screen reader hears volume and catches without the rate.
One-line fix in `web/src/demo/widgets.jsx`, shared file, so it waits for a quiet moment.

---

## 4. Watch items, not yet problems

- **Progress against the plan.** 50 demos are specified and nine are done: 101 to 105 finish the books
  domain, 111, 113 and 115 are three of the six orders demos, and 121 opens fraud. `DOMAINS[].planned`
  in `demos/index.js` still claims the full 50, which is right as intent, but the books count can now be
  checked against what shipped.
- **The token estimate formula is settled; the handovers still carry the old one.** Estimating from the
  state alone needs a factor that swings from 3.07× (101) to 5.16× (105), because the questions are
  sent on every request and a small state makes them the bigger half. Counting both collapses it:

  > input tokens per item ≈ **1.8 × (state chars + questions chars) / 4**

  which lands within 8% on 101, 102 and 105, 8% under on 103, and has now planned four runs in advance:
  11% over on 111, and 12% over across 113, 115 and 121 together (1.11M estimated, 994K spent). Output
  has run 160–280 tokens per item. Treat it as an upper bound that is right to about ten per cent. `handovers/104-three-way-match.md`
  still tells the next agent to multiply the state by 3.5, so fix that when the next handover is
  written.
- **Live mode has never been exercised by anyone but me.** It is opt-in per demo with a confirmation
  dialog that states the request count, and the static server refuses `/api/*` so browser checks stay
  free. Before the site goes public, decide whether live mode ships at all.
