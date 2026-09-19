# Leftovers

Open items parked deliberately, so the demo series keeps moving. Each one says what is wrong, what it
would cost to fix, and what the fix actually is. Nothing here blocks building the next demo.

Last reviewed after demo 104's handover, with 101, 102 and 103 recorded.

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

### 2.2 Nothing has been deployed yet

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

### 3.2 A multi-document view has not been decided

Demo 102 wanted two panes and shipped in the plain `table` view instead, which reads well. Demo 104 has
three documents per item and has been told to do the same and ask afterwards. If a `documents` view is
worth adding, it should be added once, by whoever owns `web/src/demo/views/`, not by a demo branch.

### 3.3 The coverage curve's text alternative ignores its rate line

`CoverageCurve` has an `aria-label` and a table behind a toggle, but both were written before the
optional dashed `rate` series existed, so a screen reader hears volume and catches without the rate.
One-line fix in `web/src/demo/widgets.jsx`, shared file, so it waits for a quiet moment.

---

## 4. Watch items, not yet problems

- **Progress against the plan.** 50 demos are specified; 101, 102 and 103 are recorded, 104 is handed
  over, 105 is in build. `DOMAINS[].planned` in `demos/index.js` still claims the full 50, which is
  correct as intent but should be re-checked when a domain finishes.
- **The token estimate factor.** Measured at 3.07× (101), 3.55× (102) and 3.51× (103) over `chars / 4`.
  The handovers tell agents to use 3.5. Re-check after two more demos and settle on a number.
- **Live mode has never been exercised by anyone but me.** It is opt-in per demo with a confirmation
  dialog that states the request count, and the static server refuses `/api/*` so browser checks stay
  free. Before the site goes public, decide whether live mode ships at all.
