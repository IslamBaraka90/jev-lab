# Jev Lab — UI/UX and evaluation review

Reviewed 20 September 2026 against `main` (`c422d1f`), on the static build served by
`scripts/serve-static.js`, in recorded mode. Nothing in this review called the API.

**Method.** Every page was opened at 1440 × 900 and 390 × 844. Every one of the fifty demos was loaded,
played through all of its items with motion reduced, and captured in seven frames (first paint, stage
idle, stage scored, answers, evaluation strip, full report, presenter mode) — 374 screenshots. Every
demo's `report()` was also computed offline over its full recorded fixture set, so the numbers quoted
here are the real ones and not what happened to be on screen. The shared runtime, the widgets, the
views, the styles and PRPs 003–006 were read in full, and the build was measured against its own spec.

**How to read this.** This file is the cross-cutting review: the verdict, the defects, the homepage,
the demo page, the Present screen, the evaluation and charting layer, the benchmark harness, and a
ranked roadmap. The nine files beside it go demo by demo:

| File | Domain | Demos |
|---|---|---|
| [1-books.md](1-books.md) | Books and reconciliation | 101–105 |
| [2-orders.md](2-orders.md) | Orders and customers | 111–116 |
| [3-fraud.md](3-fraud.md) | Fraud and financial crime | 121–126 |
| [4-crypto.md](4-crypto.md) | Crypto and on-chain | 131–135 |
| [5-portfolio.md](5-portfolio.md) | Portfolio | 141–146 |
| [6-trades.md](6-trades.md) | Trades and execution | 151–156 |
| [7-screening.md](7-screening.md) | Screening and fundamentals | 161–166 |
| [8-news.md](8-news.md) | News, filings and links | 171–175 |
| [9-strategy.md](9-strategy.md) | Strategy research | 181–185 |

---

## 1. Verdict

The hard part is done and it is good. Fifty demos share one contract, the datasets are seeded, the
planted labels never reach a state, the reports are honest to the point of naming their own false
alarms, and the whole site replays from committed fixtures with no server. The `report()` functions
contain genuinely interesting findings — "10 of 22 wrong actions are the same swap", "27 refund calls
refund nothing" — that most evaluation dashboards never reach.

Almost none of that is visible. The product currently reads as a developer fixture viewer:

1. **The payoff is hidden behind a button.** A demo opens on "0 of 220 answered" with no answers and no
   report. The report — the entire point — appears only after *Play all* walks every item, which takes
   about four minutes at the default 2× on a 220-item demo and about ten on the ledger. Every
   `report()` computes in under 110 ms. PRP 004 says "the report is also available instantly"; it is not.
2. **The one chart that proves accuracy is broken on forty-three demos.** A CSS class collision wrecks every
   confusion matrix (§2, D1). On expense posting it turns a 12 × 12 grid into a 5,000-pixel column with
   the diagonal in the wrong place.
3. **The stage is a key–value dump.** Most demos draw the item with a generic view that prints the
   dataset's field names and, for anything nested, raw JSON. Three-way match — a demo *about* comparing
   three documents — shows the purchase order, receipt and invoice as three JSON strings.
4. **"Check every answer" is not shown per item.** The homepage headline promises it; the item view
   never says whether the ground truth agreed. `evaluate()` receives no labels, so the *Checks* and
   *Scored* steps are labels on a stepper, not events.
5. **Present mode is the same page with the sidebar hidden.** Still the site header, still the field
   dump, still 2,800–9,300 px of scroll. Of the six behaviours PRP 005 lists, one is implemented.
6. **There is no notion of a run.** The stated purpose is to run the same model test over these use
   cases again and again. Today one fixture file per demo is overwritten on re-record, nothing is
   versioned, no metric is stored, and there is no page that shows all fifty results together.
7. **The homepage sells none of it.** Text-only hero with an empty right half and visibly corrupted
   characters, fifty identical text cards with no results on them, and a "Start with the lab" card
   that leads to an error page on the deployed site.

The direction that fixes all seven is the same: **make the result the first thing on every surface**
— the homepage, the card, the demo page, the present screen — and make the result a *versioned run*.

### Scorecard (shared surfaces)

| Surface | Score | One line |
|---|---:|---|
| Homepage | 3 / 10 | No visual, no proof, corrupted text, a dead-end primary path |
| Catalog | 5 / 10 | Filters and URL state are right; cards carry no outcome and have no padding |
| Demo page — structure | 4 / 10 | Right panels, wrong order, payoff gated, 7,000–12,000 px long |
| Demo page — item stage | 3 / 10 generic views · 6 / 10 bespoke views | Field dumps versus real charts |
| Answers panel | 6 / 10 | The probability bars are the best thing on the page; raw keys as headings |
| Evaluation strip | 3 / 10 | No ground truth, `true` always amber, raw numbers without units |
| Report and charts | 4 / 10 | Strong content, broken matrix, toy-sized curves, 14 sections never drawn |
| Present mode | 2 / 10 | A CSS class, not a mode |
| Re-run / benchmark harness | 1 / 10 | Does not exist yet |
| Engineering hygiene | 8 / 10 | Contract tests, budgets, no-secrets test, seeded data — excellent |

---

## 2. Defects — fix these before any redesign

Ordered by how much damage each does per line of fix. All verified in the build, with the cause.

| # | Defect | Cause | Fix |
|---|---|---|---|
| D1 | **Confusion matrix unreadable in all 43 demos that have one.** Empty cells render as stacked dashed boxes; counts land in the wrong column; a 12-class matrix is 5,000 px tall. | `widgets.jsx:131` gives empty cells the class `empty`; `base.css:479` defines a global `.empty` (the EmptyState: `display:flex; padding:48px 24px; border:1px dashed`). `display:flex` takes the `<td>` out of table layout. | Rename one of them (`cell-empty`, or scope EmptyState to `.empty-state`). One line. |
| D2 | **Corrupted characters on the homepage**: "JEV Â· STRUCTURED", "work â€” books", "analystâ€™s hour". | Double-encoded UTF-8 in `HomePage.jsx:24,28,29` and `demos/index.js` (fraud blurb). | Retype the four strings. Add a test that fails on `Â` or `â€` in tracked sources, next to the no-secrets test. |
| D3 | **Demo cards have no inner padding**; the domain eyebrow touches the border on the homepage and catalog. | `site.css:124,247` use `var(--s20)`; the token scale has no 20. | Add `--s20` or use `--s24`. |
| D4 | **Income planning chart draws black bars and an invisible legend.** | `demo.css:719–725` use `--cyan`, `--violet`; undefined. | Define the tokens or map to `--long` / `--accent`. |
| D5 | **Eleven undefined CSS variables** across the later views: `--radius-sm` (9 uses), `--line`, `--ink`, `--cyan`, `--violet`, `--text-sm`, `--font-mono`, `--surface-raised`, `--accent2`, `--warn`, `--s20`. Borders lose radius, mono text falls back, fills go black. | Views added later were written against a different token vocabulary. | Add aliases in `tokens.css`; add a build check that every `var(--x)` is defined. |
| D6 | **Fourteen computed report sections are never drawn.** `reconciliation`, `resolvedProblems` (102); `money`, `supplierRanking` (104); `innocents`, `economics` (112); `flips`, `money`, `deadlineAccuracy` (114); `courierRanking`, `money`, `unclear` (116); `decoys`, `friction` (122); `insufficient` (124). | `ReportPanel` renders a fixed key list and silently ignores the rest, on every branch. | Draw them (§6), and make `ReportPanel` warn in dev on an unknown key so this cannot recur. The contract test should assert every report key has a widget. |
| D7 | **"Start with the lab" and the Lab nav item lead to an error** on the static site: "The runs could not be loaded — status 404", with a live-looking *New backtest* button. | The lab needs the Express server; the deployed site has none. | Ship one recorded suite run as static JSON so the lab replays like the demos do, or hide the lab when `liveAvailable` is false. Until then, remove it from the homepage's four ways in. |
| D8 | **Mule-network graph draws 1 of 21 edges**, dashed and near-invisible; neighbours float unconnected. | See [3-fraud.md](3-fraud.md). | — |
| D9 | **Play all is quadratic.** Even with animation off it takes 25 s on card fraud and 29 s on regime classification, because `report()` re-runs over all results after every single item (`useDemoRun.js:88`). | Report memo depends on `results`, which changes per item. | Compute the full report once from fixtures (§4); let playback only *reveal* it. |
| D10 | **`true` is always a warning.** "Policy allows: ⚠ Yes" on a refund the policy allows. | `panels.jsx:69` maps every boolean `true` to the amber alert badge. | Let `evaluate()` return `{ value, tone }`, or a per-demo `evaluationSchema`. |
| D11 | **Item title printed twice** on every queue, candles and graph demo (stage `h2` and the view's own `h3`). | `DemoRuntime.jsx:191` and each view. | Drop it from the views. |
| D12 | **Wrong document metadata.** `<title>` flashes "Jev Backtest Lab"; the description is the lab's; every demo tab is titled "Demo · Jev Lab"; no Open Graph tags, so shared links have no preview. | `web/index.html`, `App.jsx` route titles. | Title from `demo.title`; add OG/Twitter tags and one generated share image per demo. |
| D13 | **KPI values break mid-number** ("£11,691." / "64") and the KPI row stops at ~80 % width. | Fixed card width, no `white-space: nowrap`, no auto-fit grid. | `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))`; shrink the font with `clamp()`. |
| D14 | **Hard-coded widget copy is wrong outside the demo it was written for**: matrix header always "Planted ↓ · Called →"; curve table always "Lines opened / Problems caught"; `BreakdownTable` always "Setups / Missed"; `CostBars` always "Estimated cost by habit"; `OverfitGallery` always "140 curves". | Widgets grew out of single demos. | Take labels from the report data. |
| D15 | **A 130 px void** sits between the demo heading and the recorded-answers banner, holding only the *Present* button. | `.demo-heading` lays the action out as its own row. | Put *Present* on the heading row. |

None of these needs a design decision. D1–D5 and D10–D15 are a day's work and change how the whole
site reads.

---

## 3. Homepage

### What is there

An eyebrow, a four-line headline set in the left 35 % of a 1440 px canvas, a paragraph, two buttons;
four small "ways in" cards; four counters (50 · 9 · 241 · 18); all fifty demo cards newest-first;
then the nine domains as rows. No image, chart, animation or number from any result anywhere on the page.

### What is wrong

- **The headline describes a different product.** "Ask a model fifteen questions about one ledger
  line" — the ledger demo asks five; fifteen is the backtest lab. A visitor who opens the ledger demo
  finds the claim false in one click.
- **Nothing shows what a typed answer *is*.** The site's single differentiating idea — a probability
  for every option, a position on a rubric, a probability of yes — is explained in a sentence and
  never drawn. The answer bars in `answers.jsx` are the most distinctive visual the project owns and
  the homepage does not use them.
- **No proof.** Fifty recorded runs exist, each with a headline metric, and the homepage quotes none.
  The counters count *inputs* (demos, domains, questions) rather than *outcomes*.
- **Fifty undifferentiated cards.** Same colour eyebrow for all nine domains, same shape, text only,
  sorted newest-first so the page opens on the five most abstract demos (overfit review, strategy
  correlation) and the most relatable ones (ledger, bank reconciliation, card fraud) are at the bottom
  of a 4,300 px scroll. "5 questions · 4 min" is the least interesting fact about any of them.
- **The four ways in are two.** "Find by job" and "Browse by domain" both go to the catalog; "Start
  with the lab" is D7; the fourth repeats the hero's secondary button.
- The domain list at the bottom repeats the catalog filter and says "5 of 5" nine times, which is a
  build-progress indicator, not visitor information.

### What an award-level version does

Think of the page as one argument in five screens, each making a single claim with the project's
own data:

1. **Hero — the answer, live.** Left: a headline that is true of every demo, such as *"Fifty finance
   jobs. One model. Every answer typed, and every answer graded."* Right: a real item cycling every
   few seconds through the domains — a dispute, a ledger line, a wallet, a candle chart — with its
   recorded probability bars animating in and a verdict chip landing ("Refund now · £134.50 · policy
   agrees"). This is `AnswersPanel` plus `evaluate()` on a fixture; it needs no new data. Respect
   reduced motion by showing the final frame.
2. **The scoreboard.** One strip, generated at build time from the fifty reports: *11,4xx items
   answered · N graded against planted truth · median agreement X % · worst demo Y %*. Showing the
   worst number is the credibility move, and the notes already do this in prose.
3. **Nine domains as a visual index.** A 3 × 3 grid where each tile carries the domain's own colour
   (the `domain-*` classes already exist and are unused), its signature visual in miniature (ledger
   rows, a candle strip, a wallet graph, a calendar), its flagship demo and its headline number.
   This replaces both the 50-card wall and the domain list.
4. **Three featured demos**, chosen for story, not recency — one per audience: finance operations
   (bank reconciliation or three-way match), risk (card fraud triage or sanctions matching), markets
   (overfit review or post-trade review). Large cards with a real screenshot-grade mini chart and the
   finding from `report.findings[0]` as the pull quote.
5. **How it is kept honest**, as a four-step diagram rather than a paragraph: seeded data → state
   (labels withheld) → typed answers → graded report, each linking to the real file. Then the full
   catalog link.

Catalog cards, wherever they appear, should carry the **result**: a headline metric with its
denominator ("90 % · 198 of 220"), a sparkline of the coverage curve or a 9-cell confusion thumbnail,
the domain colour, and the model version. Build a small `demos/summary.json` at build time (the
offline script used for this review does exactly that in under a second) so the catalog still never
loads a dataset.

Also: give the page real metadata and a share image (D12); sort the catalog by series order with
"featured" first rather than newest-first; and drop "X of 50 planned" now that it is 50 of 50.

---

## 4. The demo page

### Structure today

Breadcrumb → heading → void → recorded banner → [rail | stage → controls → answers → evaluation →
state → report → how it works] → data chip → pager. Measured page height: 5,800–12,400 px, median
about 8,500. On first paint, above the fold, the visitor sees a title, a banner and a table of field
names. The answers, the verdict and the report all require a click and a scroll; the report requires
four to ten minutes.

### Recommended structure

**Open on the result, then let people drill in.** Load fixtures on mount, run `evaluate()` and
`report()` once (under 110 ms for every demo, measured), and render:

1. **Header band** — title, the value line, and a *run chip*: `jev-1.13.0 · 19 Sep 2026 · 220 items ·
   recorded`. *Present* and *Run live* sit here.
2. **Headline strip** — three to five KPIs and the first finding, from the full report. This is the
   first thing on the page, not the last.
3. **Workbench** (two columns): the rail on the left, the stage + answers + verdict on the right, kept
   within one viewport. Answers sit *beside* the item on wide screens, not 900 px below it — the
   entire point of the product is reading an item and its typed answers together.
4. **Report** — full width, tabbed or anchored: Overview · Errors · Thresholds · Slices · Runs.
5. **How it works** — collapsed by default, four tabs rather than four stacked code blocks (it is
   currently 40 % of the page height).

*Play* stays, as the narrative: it replays the recorded run item by item, and the headline numbers
count up as it goes. It stops being a toll gate.

### The rail

502 buttons in a scroll box with no search, no filter and no grouping. Make it the error-analysis
tool: filter chips **All · Wrong · Low confidence · Flagged · Planted**, a text filter, a result dot
per row (agree / disagree / ungraded) from first paint, `j`/`k` as the PRP specified, and
virtualisation past 200 rows as PRP 004 itself required. Clicking a confusion-matrix cell or a check
chip should *filter the rail*, not just jump to one item.

### The stage

Two tiers exist today. The bespoke views (ledger, candles, insider candles, session curve, pair
curves, backtest curve) look like a product. The generic ones (`queue`, `table`, `comparison`) are
used by 28 of 50 demos and look like a debugger: field names derived from camelCase keys, enum values
in capitals, amounts without a currency, the first twelve scalar fields in dataset order, nested
objects as JSON strings. The domain files specify a replacement per demo; the shared fix is a small
**field schema** on the demo (`fields: [{ key, label, format: 'money' | 'date' | 'enum' | 'days',
group, emphasis }]`) plus four or five reusable stage layouts:

- **Case card** (queue demos): who, what, how much as a header; evidence grouped into labelled blocks
  (order · courier · customer history); the free text as a quoted message; risk-relevant fields
  highlighted.
- **Documents side by side** (bank reconciliation, three-way match, chargeback evidence, sanctions
  matching): two or three aligned panes with differing fields highlighted. LEFTOVERS 3.3 parked this;
  it is the single highest-value new view because it fixes four demos.
- **Entity graph** with all edges, direction, amounts and time (mule network, mixer tracing, entity
  links, sybil clusters).
- **Holdings table with weight bars** (the portfolio block).
- **Statement grid with sparklines** (the screening block).

### Answers

Keep the bars. Change: human question titles (add `title` to each question; the instruction text is
already there as the subtitle), a compact mode that shows only the chosen option with its probability
and expands on click (five questions currently take 900–1,400 px), the ground-truth option marked on
the bar when the demo is graded, and low-confidence answers flagged. Show token usage and latency
when the fixture has them.

### The verdict card (replacing the evaluation strip)

One card that reads as a decision: the **action** in words ("Refund now · £134.50 · reason: not
received"), **agreement** with ground truth (✓ matches policy / ✗ policy says *request evidence*,
with the planted reason), **money or risk at stake**, **confidence and whether it clears the
automation threshold**, and any **self-contradiction** the demo's checks detect on this item (a
refund with band *none*). This requires passing labels to a per-item `grade(result, label)` function,
kept separate from `evaluate()` so the "labels never reach the state" guarantee stays obviously true.
Rendering the downstream API call, as dispute routing does, is excellent — generalise it as an
optional `evaluation.call` convention for every routing demo.

### Smaller things

- The speed control, *Reset* and the answered counter are recording tools; move them into Present
  mode and leave visitors with *Replay this item* and *Replay the run*.
- The state panel is only available after an item has been run; build it from `buildState()` on
  selection so "what the model sees" is there from first paint, and offer a diff-style highlight of
  which item fields made it into the state.
- The recorded banner is good and honest. Merge it into the run chip so it costs no vertical space.
- Deep links work (`?item=…&phase=scored`). Add `#report` and per-widget anchors.
- Mobile layout holds with no horizontal overflow on the pages tested; the long page is the issue
  there too (8,400 px on a phone).

---

## 5. The Present screen

### Today

`?present=1` adds a class. It hides the rail, the banner, the caveat, the code panel and the footer,
and sets `font-size: 18px`. The site header stays. The stage is the same field dump. The page is
still 2,800–9,300 px tall (median ≈ 4,900), so recording a video means scrolling a web page. PRP 005
specifies: hide the top bar, scale type, step with → through item, item, report, a corner slug with
the demo number, a copy-shot-link button, and `scripts/shot-list.js`. Only the type scale exists.
`PresenterMode.jsx` was never created.

More importantly, even the specified version would be generic: the same panels, bigger. Presenting a
use case means telling its story, and each of the fifty has a different one.

### Design: a stepped, full-viewport storyboard per demo

A presenter route that renders **beats**, one viewport each, no scrolling, advanced with → / ←,
with a progress rail and the corner slug ("113 · Dispute and refund routing · 3 / 5"). Five beat
types cover every demo; each demo declares its own sequence and hero items in `demo.js`:

```js
present: [
  { beat: 'problem',  headline: '220 disputes. Each one ends in a backend call.', stat: '£11,692 requested' },
  { beat: 'item',     item: 'DSP-0001', caption: 'A parcel that stopped scanning 14 days ago.' },
  { beat: 'answers',  item: 'DSP-0001', reveal: ['action', 'refund_band', 'reason_code'], then: 'call' },
  { beat: 'miss',     item: 'DSP-0057', caption: 'Fair complaint, outside the window. Policy says refuse.' },
  { beat: 'proof',    kpis: ['Action agrees with policy', 'Refunded against policy'], chart: 'curve', threshold: 4 },
]
```

| Beat | On screen | Purpose |
|---|---|---|
| **Problem** | One sentence, one big number, the queue as a texture behind it | Why this job costs money |
| **Item** | The bespoke stage, full bleed, with two or three annotated callouts on the fields that matter | What a person would have to read |
| **Answers** | The item shrinks left; typed answers animate in one at a time; the verdict card or API call assembles from them | What "typed" means — the product moment |
| **Miss** | A real wrong answer, with the truth beside it | Honesty; this is what makes the numbers credible |
| **Proof** | Two or three KPIs counting up, the one chart that matters for this demo, the threshold moving | The business case in one frame |

The domain files give a concrete storyboard, with real item ids and the closing number, for every one
of the fifty demos. Supporting pieces: a true full-screen layout (no site header), 1080p-safe type
(minimum 24 px body), `?present=1&beat=3` deep links, *copy shot link*, and the missing
`scripts/shot-list.js` generated from the same `present` array so the shot list and the screen can
never disagree.

This is also the right **landing experience for visitors**: a "Watch the 60-second story" button on
each demo page that plays the same beats automatically.

---

## 6. Evaluation, reporting and charting

### What is strong

Grading against planted truth; findings written as sentences that say something ("one rule to settle,
not ten separate mistakes"); checks that need no labels (a refund call that refunds nothing); drill-down
from a check to the items; text alternatives on charts; honesty about false alarms and easy datasets.

### What is missing, across the board

1. **Standard classification metrics.** Most reports lead with raw accuracy or "caught N of M".
   With class imbalance this misleads: the ledger run flags 85 lines to catch 9 of 11 — 82 % recall,
   about 11 % precision — and the page says neither word. Every graded demo should show per-class
   **precision, recall and F1**, macro and weighted averages, and support, under the matrix.
2. **A baseline.** No number means anything alone. Add, per demo, the trivial baselines (always the
   majority class; random at class priors) and, where the dataset has one, the incumbent (the rules
   engine's ranking in card fraud, the computed ratio in fundamentals, always-take-the-signal in the
   strategy block). Report **lift over baseline**, not just the level.
3. **Calibration.** The product's claim is that the probabilities mean something. Prove it: a
   **reliability diagram** (confidence bucket versus observed accuracy, with bucket counts) and an
   ECE figure on every graded demo. The lab already has `ConfidenceBuckets`; PRP 004 lists it as a
   shared widget; it was never wired in.
4. **The threshold control.** PRP 004: "every demo that routes items exposes one threshold slider…
   with the automation rate and precision updating live." It is the most persuasive interaction the
   product could have — *drag to 80 %: 61 % of the queue automated at 99.2 % precision, 3 wrong refunds
   worth £212* — and it is absent. The data is already in `report.curve`.
5. **Cost-weighted error.** Every demo is about money or risk, and several already carry amounts.
   Turn confusion cells into currency: a missed fraud costs the amount, a false alarm costs analyst
   minutes. One **cost curve** against the threshold beats any accuracy figure.
6. **Uncertainty.** "9 of 11" and "1 of 6" are presented as plainly as "399 of 400". Show Wilson
   intervals on every rate and grey out any slice with a denominator below about 20. Several demos
   have 4, 16, 18 or 24 items; their percentages should not be displayed as percentages at all.
7. **Slices.** Accuracy by planted scenario exists in some checks; make it a standard **slice table**
   (by scenario, amount band, confidence band) with a small bar per row.
8. **Consistency checks as a first-class metric.** The cross-answer contradictions (refund + band
   *none*) are a distinctive strength of typed answers. Report a contradiction rate everywhere it
   applies.
9. **Run-to-run stability.** The about page says "answers can vary between runs" and nothing measures
   it. See §7.

### Chart-by-chart

| Widget | State | Recommendation |
|---|---|---|
| `ConfusionMatrix` | Broken (D1); header hard-coded; colour scales to the global max so off-diagonals vanish beside a large true-negative cell | Fix; row-normalise the colour; show count and row-% in each cell; marginal totals; per-class P/R/F1 beside it; cell click filters the rail; collapse to top-k confusions beyond eight classes |
| `CoverageCurve` | 520 × 180 inside a 1,100 px panel; no ticks, no gridlines, no units; axis titles overlap the plot; the dashed rate line shares an unlabelled axis | Full width, labelled ticks on both axes, a second labelled axis for the rate, a draggable threshold marker bound to the KPIs, the chosen default annotated, area under curve stated |
| `DistributionBar` | Every non-good option is the same amber, so a four-way split reads as two; legend styled as links | Categorical palette per option, direct labels on segments wide enough, legend as chips; show planted distribution beneath it for comparison |
| `KpiRow` | Wraps mid-number; no baseline, delta or interval | Auto-fit grid; each KPI carries `value`, `denominator`, `baseline`, `delta vs previous run`, `tone` |
| `CheckList` | Good | Add the rate bar; make chips filter the rail |
| `TopItems` | Styled as a list of pink links | Make them mini case rows with the verdict and the amount |
| `EquityCurve`, `SizeScatter` | No y-axis values; scatter points 2.4 px | Axis ticks, zero line, hover readout, larger hit targets |
| `QualityLeverageGrid`, `DividendSafetyScatter` | Labels collide when points cluster | Label collision avoidance or leader lines; quadrant shading with names |
| `TimingGridReport` | A 480-row table, 7,500 px | A weekday × month-phase **heatmap** per instrument and direction, insufficient cells hatched |
| `OverfitGallery` | 140 cards, 6,800 px | Keep as small multiples but paginate / group by verdict; colour the border by agreement with the planted class |
| `EntityNetworkReport`, `EventClusterReport` | 100-row tables, 6,500 px and 3,800 px | A real force or layered graph; a before/after cluster strip |
| `FingerprintChart` | Bars in a table | Fine; consider a radar or parallel-coordinates small multiple per archetype |

And draw the fourteen hidden sections (D6): money-at-stake summaries as KPI bands, supplier and
courier rankings as ranked bar tables, *innocents* and *decoys* as the false-positive drill-down they
were written to be, deadline accuracy as a small calendar strip, the reconciliation as a classic
waterfall from bank balance to book balance.

Follow one chart grammar throughout: tick labels and units on every axis, direct labelling over
legends, the magenta accent reserved for the model's choice (already the rule in `answers.jsx` —
extend it to the reports), a sequential ramp for intensity, and a qualitative palette that survives
colour-vision deficiency for categories.

---

## 7. From fifty demos to a benchmark: the re-run harness

The owner's stated purpose is to run the model test over these use cases over and over. The
foundation is unusually well suited — seeded data, withheld labels, deterministic `evaluate()` and
`report()`, one run loop shared by the recorder and live mode — but the concept of a **run** does not
exist.

### What to build

1. **Versioned runs.** `npm run record` writes `runs/<demo>/<runId>.json` (answers, model version,
   timestamp, usage, latency, git commit, dataset seed and hash, questions hash) instead of overwriting
   `fixtures.json`. `fixtures.json` becomes a pointer to the pinned run. A change to the dataset or the
   questions changes the hash, so runs are only ever compared like for like.
2. **A metrics contract.** Each demo's `report()` additionally returns a flat, typed `metrics` object
   — `{ accuracy, macroF1, recall@flagged, precision@threshold, automationRate@threshold, ece,
   contradictionRate, costWeightedError, n }` with whichever apply — and declares `gates`:
   `{ macroF1: { min: 0.85 }, contradictionRate: { max: 0.02 } }`. `scripts/score.js` computes these
   for any run offline, in seconds, at no cost.
3. **`/benchmark` — the suite scoreboard.** One page, fifty rows grouped by domain: headline metric
   with interval, gate status, delta against the previous run, a sparkline across runs, tokens, latency
   and cost. Filter by model version. This page is the product for anyone evaluating the model, and
   the best single homepage link.
4. **A Runs tab on each demo.** Pick two runs: metric deltas, the **flip list** (items whose answer
   changed, with both answer bars side by side), confusion-matrix difference, calibration overlay.
   Chargeback evidence already computes "flips"; this generalises it.
5. **Stability runs.** Record the same demo *k* times: report per-item agreement, the share of items
   with a unanimous choice, and the variance of each score. This is the missing evidence behind
   "answers can vary between runs" and a real selling point for a typed-answer model if it is stable.
6. **CI.** `npm run check` already runs budgets and tests; add `npm run score` so a regression in any
   gate fails the build, and publish the scoreboard JSON as a build artefact.
7. **Dataset hygiene for repeatability.** Fix the items already known (LEFTOVERS 1.1: the VAT account
   that produces 68 identical false alarms; 1.2: expense posting is a lookup, 399 of 400). Raise the
   tiny sets (peer valuation 4, fundamentals and dividends 16, portfolio compare 18, portfolio health
   24) or present them as case studies rather than percentages. Hold out a second seed per demo so a
   prompt tuned on seed A is scored on seed B. The domain files list per-demo changes.

### Cost control

Recording is the only paid step. Keep it explicit and estimated as it is now; add a `--sample N` flag
for cheap smoke runs with a stratified sample across planted scenarios, and show clearly on the
scoreboard when a run is a sample.

---

## 8. Accessibility, performance and polish

- **Good already:** skip link, focus token, `aria-current`, text alternatives and tables behind every
  SVG chart, reduced-motion support, 44 px targets, no horizontal overflow at 390 px, no console
  errors on any of the fifty demos, budgets enforced.
- **Colour alone** distinguishes matrix cells and distribution segments; add text or pattern.
- **Keyboard:** `←`/`→` change item and `Space` plays — both collide with normal page scrolling and
  screen-reader navigation, and nothing on the page announces them. Add a `?` shortcut sheet and
  announce playback state in a live region.
- **`Play all` state** lives in a ref, so the button label and icon do not update until something
  else re-renders (`DemoRuntime.jsx:212`).
- **Typography:** system UI font throughout; a distinctive display face for headings and a proper
  tabular monospace for figures would lift the whole thing for the cost of two font files. The about
  page sets body copy in bold.
- **Entry bundle** is 640 KB (188 KB gzip) because the homepage imports the registry, which imports
  all fifty `demo.js` files with their report code. Split card metadata into a generated manifest so
  the homepage ships none of it. The largest dataset chunk is 2.6 MB raw; fine lazily, but the
  scoreboard must read `summary.json`, never datasets.
- **404s and empty states** are well written.
- **Microcopy** is a strength — plain, specific, honest. Keep that voice in the new surfaces.

---

## 9. Roadmap

Ranked by visible impact per unit of work. S ≈ hours, M ≈ a day or two, L ≈ a week.

### Phase 0 — stop the bleeding (S, all shared)
1. D1 confusion matrix class collision.
2. D2 encoding, D3 card padding, D4–D5 missing tokens, D11 duplicate title, D13 KPI wrap, D15 void.
3. D7 take the lab off the homepage until it replays statically.
4. D12 titles and share metadata.

### Phase 1 — result first (M)
5. Instant report on load; *Play* becomes a replay. Fixes D9 as a side effect.
6. Verdict card with ground-truth agreement; `grade()` separate from `evaluate()`; D10 tones.
7. Question `title`s, enum and money formatting via a per-demo field schema.
8. Rail filters (wrong / low confidence / flagged) and matrix-cell → rail filtering.
9. Draw the fourteen hidden report sections (D6) and fix widget copy (D14).

### Phase 2 — the evaluation layer (M–L)
10. Precision / recall / F1, baselines, intervals, slice tables — one shared `metrics.js`.
11. Reliability diagram and ECE.
12. Threshold slider bound to the KPIs and a cost curve.
13. Full-width, ticked, labelled charts; heatmap for timing; real graph for entity links.

### Phase 3 — stages and Present (L)
14. The five reusable stage layouts, starting with documents-side-by-side and the case card.
15. Presenter route with beats, per-demo `present` arrays, slug, deep links, `shot-list.js`.
16. "Watch the story" autoplay on the public demo page.

### Phase 4 — the benchmark (L)
17. Versioned runs, the metrics contract and gates, `scripts/score.js`.
18. `/benchmark` scoreboard and the per-demo Runs tab with flip lists.
19. Stability runs; CI gate; dataset fixes and held-out seeds.

### Phase 5 — the front door (M)
20. Homepage rebuilt around the live answer hero, the scoreboard strip, the nine-tile visual index
    and three featured demos; result-bearing cards everywhere.

The homepage is deliberately last: it should be assembled from real outputs of phases 1–4 — the
verdict card, the scoreboard numbers, the mini charts — rather than designed ahead of them.

---

## 10. What has been done since

This review was written against `c422d1f`. The work that followed it, on `main`:

| Roadmap item | State |
|---|---|
| Phase 0 — defects D1–D6, D9–D15 | Done. D7 (the lab on the static site) is parked in `LEFTOVERS.md`; D8 turned out to be a generator issue and is listed there too. A hygiene test now fails on double-encoded text or an undefined design token. |
| Phase 1 — result first | Done. The run is loaded, evaluated and reported once on load; the page is run chip, headline strip, rail with filters, item beside answers, verdict card, sectioned report, code as tabs. |
| Phase 2 — the evaluation layer | Done in the shared layer: precision, recall and F1 from every matrix, the majority baseline with lift and a 95% interval, a reliability diagram with calibration error, an automation slider, a threshold slider on every coverage curve, and automatic drawing of report keys no widget claims. Per demo: a rules baseline, a per-item grade and flat metrics for all fifty. Cost-weighted error is done where a demo carries money; slice tables are per demo, not yet a shared widget. |
| Phase 3 — stages and Present | The generic stage renders nested records as groups and tables, with per-demo hide, label and highlight hints; the graph view lays deep traces out in lanes. Presenter mode is five beats per demo with a story written for each of the fifty, deep links, a shot link and `scripts/shot-list.js`. Bespoke document, case-card and holdings stages are not built. |
| Phase 4 — the benchmark | `npm run score`, `benchmarks/history.json`, gates and a regression check in `npm run check`, `/benchmark`, and archiving of replaced runs. Flip lists, stability runs and held-out seeds are not built. |
| Phase 5 — the front door | Done: the live typed-answer hero, the suite strip with its weakest demo named, nine domain tiles, three featured demos, and result-bearing cards everywhere. |

What the review found about the **datasets** — that a short rule matches or beats the model on most of
them, and that several leak their label through one field — could not be fixed without recording again,
which costs money. Every affected demo now shows the rule beside the model and carries a caveat, and the
list, with costs, is the first section of `LEFTOVERS.md`.
