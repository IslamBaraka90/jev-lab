# Domain 5 · Portfolio — demo-by-demo review

Demos: 141 portfolio-health · 142 portfolio-compare · 143 rebalance-review · 144 factor-exposure · 145 mandate-compliance · 146 income-planning.

Evidence base: `demos/<id>/demo.js`, `notes.md`, `prps/14x-*.md`, label files, the computed report dumps, the recorded fixtures (queried with scripts, never read whole), and screenshots -1/-3/-5/-6/-7. Global findings 1–10 from the brief are assumed and not re-reported; everything below is specific to these six demos.

Headline for the domain: **four of the six datasets can be solved perfectly by a ten-line rules script reading fields that are already in the state, two datasets leak the label through a free-text note, and two of the most quotable claims in the notes ("tolerance was read as part of the rule", "all eight were treated as breaches") are not supported by the data.** The one genuinely award-worthy result in the domain — confidence on `main_risk` separates right from wrong answers perfectly in portfolio-health — is computed nowhere and shown nowhere.

---

### 141 · Portfolio health (`portfolio-health`)

**Scores (0–10):** Story clarity 5 · Item stage 1 · Answers-to-decision legibility 4 · Report and charts 4 · Presenter readiness 1 · Evaluation rigour 3 · Re-run/benchmark readiness 3

**1. The one-sentence value.** "Give it a holdings list and the client's plan; it names the one risk that matters, grades it, and says what to do — and it knows when it is unsure." The first paint does not land it. `portfolio-health-1-landing.png` shows a key/value table starting with `Id`, `Client`, `Client Spends In`, then `Target Allocation {"equity":65,"defensive":25,"cash":10}` as raw JSON, and **four numeric rows that are visibly blank** (Total Value Usd, Cash Percent, Holding Count; further down Largest Holding Percent and Held Outside…). A visitor sees an admin record, not a portfolio.

**2. Item stage review.**
- What is shown (`view: 'table'`, `demos/portfolio-health/demo.js:230` → `web/src/demo/views/TableView.jsx`): every item key as a row; `holdings` and `pairCorrelations` as one unbroken JSON string (`portfolio-health-3-stage-scored.png`).
- Demo-specific defect: the JSON string makes the table several thousand pixels wide; numeric cells get `className="num"` (`TableView.jsx:22`) and are right-aligned to the far edge of that over-wide table, so **every number on the item is scrolled out of view**. In mandate-compliance the same view shows numbers (right-aligned at the visible edge) because nothing stretches the table. The five numbers a practitioner looks at first are therefore the five that are invisible.
- What an adviser needs, in order: (a) the client line — objective, spends in AED, total value; (b) target vs current allocation as two stacked 100% bars (equity/defensive/cash) with the drift in points annotated; (c) a holdings table sorted by weight with a weight bar per row, sector, currency chip, 12-month return, volatility, worst fall, and days-of-ADV with a marker at the 1.0-day rule from `context.howToRead`; (d) the three most-correlated pairs as a mini heat strip (0.65, 0.45, 0.40 for PF-01); (e) a "held outside the client's currency: 91%" gauge; (f) the adviser note as a quote.
- Hide: `id`, `objectiveId`, `holdingCount` (derivable), `price`.
- Bespoke visual: a **"portfolio X-ray" card** — left third: allocation bars target vs now; middle: weight-sorted holdings with bars that turn from neutral to accent when a holding crosses the 25% "worth a sentence" line; right third: four small dials, one per detectable risk (largest name %, top pair correlation, max days of ADV, % outside home currency, drift in points), each with its house threshold tick. When the answer arrives, the dial matching `main_risk` lights up and the action chip (Trim / Hedge / Rebalance) appears under it. That makes "the model picked the right dial" visible without reading anything.

**3. Answers and evaluation strip.**
- `main_risk` is forced single-label on portfolios that legitimately carry several risks (the notes concede this). `NONE` was never chosen: 0 of 24. The confusion row for planted `NONE` is 2 concentration / 2 correlation / 1 liquidity.
- `action` has **HOLD chosen 0 of 24** ("Something to do: 24 of 24") and `TRIM` 17 of 24; the question is effectively "which non-hold action", and it is never graded against anything. The labels carry no expected action.
- `fits_objective` is graded as simply "planted risk ≠ NONE ⇒ does not fit" (`demo.js:126`), which is wrong in principle: a 40% single name can fit a growth objective. 87.5% on that definition is not meaningful.
- `diversified_in_name_only` is only scored on the 4 correlation books (4 of 4) — its false-positive rate on the other 20 is not reported. PF-01 (currency) answers `nameOnly: true` (`portfolio-health-5-evaluation.png`), so the rate is clearly non-zero.
- Evaluation strip defects specific to this demo: `Fits: ✓ No` renders **green with a tick** although "no longer fits" is the bad outcome, while `Name Only ⚠ Yes` and `Flagged ⚠ Yes` are amber; `Value At Risk 72733938` is unformatted and **wrong for the risk named**: `valueAtRisk` is always largest-holding weight × total (`demo.js:95`), so for PF-01, a *currency* finding on a book 91% outside AED, it shows NVDA's $72.7M instead of ≈ $378M. For drift it should be the points-off-plan × value; for correlation, the summed weight of the correlated cluster.
- The verdict card should read: "**Currency** · severity 4.2 Serious · **Hedge** — $378M of $416M is outside AED and unhedged. Planted: currency ✔. Confidence 0.99 (above the 0.5 act-threshold)."

**4. Report, charts and metrics.**
- **Label leakage through `adviser_note`** (sent at `demo.js:34`). There are exactly six distinct notes and they map 1:1 to the six planted classes: all 5 concentration books say "Client asked to keep the winner rather than trim it…", all 4 currency books say "Everything here is priced in dollars and nothing hedges it", all 4 correlation books say "The large positions are the same story told three ways", all 3 drift books "Nobody has rebalanced since the technology holdings ran", all 5 healthy books "Reviewed in June, rebalanced in July, nothing outstanding." The 16-of-19 headline cannot be attributed to reading the holdings. Interesting corollary: the model ignored the healthy note every time.
- **The liquidity class contradicts the house rule in the state.** `howToRead.liquidity` says more than one day of ADV is the problem; the planted liquidity books top out at 0.517, 0.617 and 0.725 days (PF-03, PF-19, PF-06). The model's 0 of 3 is the *correct* reading of the state; the label is wrong. The PRP beat "one position at 4 days of average volume" does not exist in the data.
- **The best result is hidden.** Sorting the 24 by `main_risk.confidence`: all 8 wrong answers sit at 0.20–0.43 (five healthy books plus three liquidity books), all 16 correct answers at 0.55–1.00. A 0.5 abstain threshold gives 16 of 16 acted-on correct and routes exactly the 8 problematic books to a human. This is the single most valuable chart in the domain and the report does not compute it; it uses a severity curve instead, where healthy books score 2.3–4.1 against 2.9–5.5 and barely separate (rate moves only 0.792 → 0.818 at severity ≥ 3).
- KPI critique: "Risk named exactly 16 of 19" excludes the 5 healthy books; overall accuracy is 16 of 24 = 66.7% and should be stated. "Something to do 24 of 24" has no tone but is a failure (5 healthy books got an action). Missing: macro-F1 across six classes, false-alarm rate as a first-class KPI (5 of 5 = 100%), always-majority baseline (5 of 24 = 20.8%), a threshold rules baseline (largest > 25% → concentration, top pair > 0.7 → correlation, outside-currency > 50% → currency, drift > 10 pts → drift, else none) which, checked against the labels, scores 21 of 24 with the house 1-day liquidity rule and 24 of 24 if the liquidity cut is tuned to 0.4 days — either way it beats the model's 16 of 24, and risk-coverage (accuracy vs share acted on as the confidence threshold moves).
- Charts that fit: (1) risk-coverage curve, x = share of portfolios auto-answered, y = accuracy among them, with the 0.5 operating point marked; (2) a 24-dot strip, x = confidence, colour = right/wrong, shape = planted class; (3) the 6×6 confusion matrix (keep); (4) a severity box-strip per planted class to show the healthy books are not separated by severity.
- Suspicious numbers: portfolio sizes of $175M–$5.8B for named individuals ("Amina Aziz", $416M) — private-client books do not look like this; the liquidity trick needed billions to move SPY-like instruments and that is what inflated them. `topItems` ranks by severity then the mis-defined valueAtRisk.
- The distribution bar is three amber segments (trim/hedge/rebalance all `warn`); it carries no information.

**5. Bespoke Present screen (4 beats).**
1. *"Seven tickers, one bet."* PF-24: holdings fan out as seven bars, then three of them snap together into one block labelled "same story, correlation 0.7+"; answer chips: Correlation · 4.9 Severe-ish · Trim; `diversified_in_name_only = yes`.
2. *"The problem is not in the portfolio, it is in the passport."* PF-01: a single dial — 91% outside AED — and the Hedge chip. Money line: $378M unhedged.
3. *"When it does not know, it says so."* PF-04 (healthy): probabilities shown as six thin bars, top one only 0.36 → card flips to "Below 0.5 — sent to the adviser". Then the 24-dot confidence strip animates in: 8 hollow dots left of the line, 16 solid right of it.
4. Close: **"16 answered, 16 right. 8 handed to a person — the 8 it would have got wrong."**

**6. Re-runnable model test.**
- Benchmark card: exact-risk accuracy (all 24), macro-F1, false-alarm rate on healthy books, accuracy@confidence≥0.5 and coverage at that threshold, AUROC of confidence vs correctness, action agreement once actions are labelled, per-class recall, tokens and latency, diff vs previous model version (items that flipped).
- Gates: accuracy@0.5 ≥ 95% with coverage ≥ 60%; false-alarm rate on healthy ≤ 20%; no class with recall 0.
- Dataset changes needed: remove or randomise `adviser_note` (at minimum decouple it from the class; add misleading notes); rebuild liquidity with a thin instrument so days-of-ADV reaches 3–20; resize books to $0.5M–$30M; at least 20 items per class and 30% healthy; add multi-risk books with a label *set* and score with Jaccard/any-hit; add near-threshold books (24% vs 26% largest name); label the expected action; three seeds.

**7. Bugs and defects seen.**
- All numeric item fields invisible (`-1-landing`, `-3-stage-scored`, `-7-present`).
- `Fits ✓ No` green for a bad outcome; `Value At Risk 72733938` raw and semantically wrong (`-5-evaluation`).
- Holdings/pair correlations as clipped raw JSON (`-3-stage-scored`); `name` field holds the industry ("Oil & Gas Integrated"), not the company, and SPY's name is "SPY", sector "Other".
- List labels wrap to two lines because of `· balanced` suffix (`-1-landing`).
- PRP says "ten holdings that is really one bet"; books have 5–7.

**8. Top 5 actions.**
1. Remove the class-revealing `adviser_note` from the state (or decouple it) and re-record. [S] [demo-only]
2. Add the confidence-vs-correctness strip and risk-coverage curve, with "answered / handed over" KPIs; make it the headline. [M] [shared-runtime]
3. Build the portfolio X-ray view (allocation bars, weight-sorted holdings, five risk dials). [L] [demo-only, reusable by 144]
4. Fix the liquidity class (thin instrument, 3–20 days ADV) and the book sizes; add multi-risk labels. [M] [demo-only]
5. Correct `valueAtRisk` per risk type and grade `action` and `fits_objective` against real labels. [S] [demo-only]

---

### 142 · Portfolio compare (`portfolio-compare`)

**Scores (0–10):** Story clarity 7 · Item stage 5 · Answers-to-decision legibility 5 · Report and charts 4 · Presenter readiness 3 · Evaluation rigour 3 · Re-run/benchmark readiness 3

**1. The one-sentence value.** "Two portfolios, one client goal: it picks the one that fits the goal, refuses to pick when they are genuinely the same, and is not seduced by last year's return." First paint is the best in the domain — the goal sentence sits in a bordered strip above aligned A/B columns (`portfolio-compare-1-landing.png`) — but it shows only the goal *words*. **The hard constraints (`minimum_income_yield_percent: 2.5`, `maximum_drawdown_percent: 28`, `minimum_liquid_share_percent: 90`) are never displayed**, and they are what every answer hangs on.

**2. Item stage review.**
- Shown: nine summary rows, then `Sector mix`, `Currency mix` and five `Holding n` rows as raw JSON blobs (`-3-stage-scored`, `-7-present`). No winner marking, no constraint marking, no emphasis on which row differs most.
- Needed: each summary row should carry the constraint as a tick on a shared horizontal scale, with A and B as two dots on that scale. PC-01: income yield scale 0–4%, constraint tick at 2.5%, A at 2.95 (pass), B at 0.7 (**breach**, accent colour). Drawdown scale with the 28% line; both pass. This is a "dumbbell against a limit" row and it makes the decision self-evident.
- Sector mix as two stacked 100% bars (A: 60/18/17 Consumer Defensive/Healthcare/Energy; B: 67/18/10 Technology/Other/Financials). Holdings as two compact five-row tables (ticker, weight bar, yield, drawdown), not JSON.
- After the answer: the chosen column gets a header ribbon "Better fit · 5.7/6 decisive", the row named by `biggest_difference` is outlined, and for TOO_CLOSE both headers go neutral with "No meaningful preference".
- Hide: `daysOfAverageVolume` 0/0.001 noise, `cashPercent` unless different.

**3. Answers and evaluation strip.**
- Questions are well formed; `decisiveness` behaves (close pairs 0.4–0.6, traps 3.4–4.1, clear pairs 4.9–5.8) — a good calibration story that is only visible by reading `topItems` labels.
- `goal_constraint_breached` and `one_change_would_flip_it` are **never graded** and never appear in the report. The first is deterministic from the state and should be scored; the second is the interesting one and needs a label.
- `biggest_difference` on the four close pairs is graded against an arbitrary `reason` (PC-13 "INCOME", PC-14 "SECTOR_MIX" for portfolios that differ by 0.01 points of yield). Those four rows contaminate the matrix; grade the separator only on decisive and trap pairs.
- Strip: `Constraint Breached ⚠ Yes` is amber even though it is the *explanation* for a correct pick; `Confidence 1`. Card should say: "**A fits better** — B breaks the 2.5% income floor (0.7%). Decisive 5.7/6. Label: A ✔. One change would not flip it."

**4. Report, charts and metrics.**
- 18 of 18, 4 of 4, 2 of 2, 0 — a perfect wall, on a file that is far smaller than it looks. **The 18 pairs are built from about six portfolio templates**; the summaries repeat to two decimals (17.65/−15.99, 19.08/−18.69, 18.05/−17.66, 20.3/−14.96, 28.95/−19.37). PC-07 is PC-01 with sides swapped, PC-08 = PC-02 swapped, PC-10 = PC-04 swapped, PC-11 = PC-06 swapped, PC-18 = PC-17 swapped, and PC-05/PC-17/PC-18 share portfolios with PC-02. Effective sample: roughly 9 distinct comparisons. The mirrored pairs are a legitimate *position-bias* test — the model passed it — but the report never says so.
- A rules baseline (count constraint breaches from `summary` vs `goal.constraints`; if equal and all metrics within 1 point → TOO_CLOSE; else fewer breaches wins) gets 18 of 18, because the state pre-computes every figure the rule needs. The 100% therefore measures dataset ease.
- The separator matrix is where the model is imperfect and nobody is told: diagonal = 15 of 18 (83%); sector-mix pairs were called concentration once and drawdown once, an income pair was called drawdown. There is no KPI for it.
- PC-02/PC-08 are labelled decisive on drawdown although neither side breaches (−15.99 vs −18.69 against a 22% cap); the model's decisiveness there is 3.8–4.0, arguably better calibrated than the label "decisive".
- Missing: position-bias KPI ("5 mirrored pairs, 5 consistent"), return-chaser baseline (pick the higher 12-month return — it fails both traps and several income/drawdown pairs; show its score next to the model's), decisiveness-by-cohort chart, constraint-breach accuracy.
- Charts: (1) **decisiveness strip** — 18 dots on a 0–6 axis, coloured by cohort (close / trap / decisive); the separation 0.4–0.6 vs 3.4–5.8 is the calibration proof; (2) model vs return-chaser vs rules bar trio; (3) separator matrix restricted to 14 decisive+trap pairs.
- Distribution bar is three grey segments without tone (`-6-report`) — A 7 / B 7 / Too close 4; fine as a balance check, useless as a headline.

**5. Bespoke Present screen (4 beats).**
1. Goal card full-width: "Low drawdown — never lose more than 18%." Two portfolio cards slide in under it (PC-17).
2. The trap: return row lights first — A +28.95% vs B +17.65% — a ghost "return-chaser picks A" stamp appears. Then the drawdown row draws its 18% limit line; A's dot (−19.37%) lands on the wrong side. Verdict: **B**, decisiveness 4.1.
3. Mirror: PC-18, the same two books with sides swapped — verdict flips to **A**. Caption: "It reads the goal, not the column."
4. PC-13: every row within a hair (yield 2.95 vs 2.96) → "Too close · 0.4/6". Close on the decisiveness strip and the number: **"18 of 18 picks; a return-chaser gets N of 18"** (compute the baseline; on this data it loses at least the two traps and PC-02/05/08).

**6. Re-runnable model test.**
- Card: pick accuracy, TOO_CLOSE precision/recall, trap pass rate, **swap-consistency rate**, separator accuracy on decisive pairs, constraint-breach accuracy, mean decisiveness per cohort with a monotonicity gate (close < trap < decisive), baselines (return-chaser, rules), drift vs last run.
- Gates: swap-consistency 100%; traps 100%; TOO_CLOSE recall ≥ 75% with precision ≥ 75%.
- Dataset: generate ≥ 120 pairs from ≥ 40 distinct books; every pair appears in both orders; add traps on other axes (yield trap, liquidity trap, concentration trap), graded margins (pairs where one side breaches by 0.3 points), pairs where *both* breach, and soft-goal pairs with no hard constraint so the rules baseline cannot reach 100%. Remove the pre-computed `summary` in a "hard" slice so the model must aggregate from holdings.

**7. Bugs and defects seen.**
- Constraints missing from the stage (`-1-landing`, `-7-present`).
- Raw JSON in Sector mix / Currency mix / Holding rows (`-3-stage-scored`).
- Negative drawdowns shown as "−14.96%" against a positive "maximum_drawdown_percent: 28" — sign convention differs between goal and data.
- `Portfolio a` / `Portfolio b` lower-cased by `title()` in labels and legend (`-6-report`, `-5-evaluation`).
- `liquidWithinOneDayPercent` 95% everywhere except one pair (PC-12: 10%) — a row that is noise 17 times out of 18.

**8. Top 5 actions.**
1. Show the constraints and draw each metric as A/B dots against the limit; ribbon the winner. [M] [demo-only, extends ComparisonView]
2. Add return-chaser and rules baselines plus the swap-consistency KPI to the report. [S] [demo-only]
3. Add the decisiveness-by-cohort strip; exclude close pairs from the separator matrix; add separator accuracy KPI (15 of 18 today). [S] [demo-only]
4. Regenerate with ≥ 40 distinct books and traps on four axes; keep mirrored ordering as a deliberate slice. [M] [demo-only]
5. Grade `goal_constraint_breached` and label `one_change_would_flip_it`. [S] [demo-only]

---

### 143 · Rebalance review (`rebalance-review`)

**Scores (0–10):** Story clarity 7 · Item stage 3 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 2 · Evaluation rigour 4 · Re-run/benchmark readiness 5

**1. The one-sentence value.** "A rebalancer proposes 200 trades knowing only target weights; the reviewer catches the 47 that are right on paper and wrong here, and what is left is an order list." First paint (`rebalance-review-1-landing.png`) shows TR-0001 as twelve key/value tiles. It does not show the one thing that makes this demo: what the rebalancer *did not know*.

**2. Item stage review.**
- `QueueView.jsx:10-12` keeps only the first 12 scalar fields and long strings. **`recentTradesInThisName` (the wash-sale evidence), `sameNameOtherAccountToday` (the crossing evidence) and the account mandate (not on the item at all; `mandateNote` is null for most) are never shown.** For 26 of the 47 problem trades the evidence that decides the answer is invisible on the stage. `desk.rules` — the five house rules — are also not shown anywhere.
- Needed layout, a **trade ticket with a blind-spot panel**:
  - Header: `BUY 103,174 AAPL · $34.7M · Balanced, taxable`.
  - Weight track: one horizontal axis, three markers — now 2.72%, after 3.23%, target 5.41% — with the ±1.5 pt tolerance band shaded. This instantly shows whether the trade moves toward target.
  - ADV meter: trade as % of average daily volume on a 0–60% bar with the 20% rule line (0.19% for TR-0001; 54.6% for TR-0154).
  - "What the rebalancer could not see" panel with four slots that are empty/grey when clean and filled when present: tax lots (18 days ago BUY $109M, "lot still held, at a loss"), other account today (ACC-FAMILY-A SELL $25.7M), mandate sentence, minimum-ticket rule.
  - After the answer: a stamp — APPROVE / RESIZE → split over days / DEFER / REJECT — and the ticket slides into or out of an order-list tray on the right with a running total.
- Format: `Value Usd 34,680,000` → `$34.7M`; `Share Of Average Volume Percent 0.19` → `0.19% of ADV`; hide `Average Daily Volume`, `Price`, `Account Id` raw code (use the account name).

**3. Answers and evaluation strip.**
- **`needs_pm_sign_off` is yes on 200 of 200 trades**, including TR-0001, a clean $35M AAPL buy at 0.19% of ADV. It is a dead question, it is never graded, and on the strip it renders as an amber warning on every single item (`-5-evaluation`). Either re-word with a concrete house threshold or drop it.
- `size_band` is asked even when the verdict is REJECT/DEFER and produces contradictions: TR-0035 verdict REJECT with band SPLIT_OVER_DAYS; TR-0112 DEFER with HALF. `evaluate()` also treats SPLIT_OVER_DAYS as fraction 1 (`demo.js:88`), so the "order value" of a split trade is the full amount today.
- `execution_risk` is a reasonable score but is used as if it were a problem detector (see curve below).
- TR-0001 shows `Confidence 0.40` on an APPROVE. Low-confidence approvals are precisely what a desk wants routed to a person; the strip shows the number with no meaning attached.
- `Goes ⚠ Yes` — amber for the good outcome.
- Card should say: "**Resize → split over days.** 54.6% of PEP's daily volume against a 20% rule. $592M stays in the list as 3 child orders. Label: resize ✔ liquidity ✔."

**4. Report, charts and metrics.**
- The two headline KPIs (47 of 47 stopped, 47 of 47 named) sit next to "Verdict agrees 69%" with no explanation. Breaking the recorded verdicts down against labels:
  - APPROVE→APPROVE 122, APPROVE→RESIZE 30, APPROVE→REJECT 1;
  - RESIZE→RESIZE 9, RESIZE→REJECT 5; DEFER→REJECT 14, DEFER→RESIZE 3; REJECT→REJECT 7, REJECT→DEFER 8, REJECT→RESIZE 1.
  - **On the 47 problem trades the exact verdict agrees only 16 times (34%).** All 11+6 labelled DEFER (tax lot, mandate) were REJECTed or resized; 8 of 9 crossing trades labelled REJECT were DEFERred. The story "it stopped all of them" is true; "it knew what to do with them" is not, and that is hidden. A 4×4 verdict confusion matrix is the chart this demo needs; the 6×6 issue matrix shown is a perfect diagonal plus 4 cells and teaches nothing.
- The finding "14 of the 14 oversized trades were given a smaller size rather than only a verdict" (`demo.js:204-205`) counts `size_band` regardless of verdict. Only 9 of 14 were actually RESIZEd; 5 were REJECTed with a split band attached. The sentence in the notes ("the trade still happens, in pieces") is false for those five.
- `topItems` tags "agrees" when the *issue* agrees (`demo.js:217`). TR-0035 is listed "buy XLE · reject · agrees" although the label verdict is RESIZE. Misleading.
- The 31 clean trades resized are the real cost. The KPI "Good trades stopped 1 of 153" (tone good) hides it; "Ordinary trades not approved 31 of 153" appears only as a check row. Put dollars on it: value of clean trades cut by HALF/QUARTER.
- The coverage curve uses `execution_risk` as the ranking score: at ≥ 3 it reviews 23 trades and finds 21 of 47 (45% recall). Execution risk is not meant to find tax-lot or crossing problems, so the curve makes the model look weak at a job it was not asked to do. Rank by `1 − P(APPROVE)` or `1 − P(issue = NONE)` instead.
- Rules baseline: every planted problem breaks a rule written in the state (notes admit it is "the easiest file in the set"). `shareOfAverageVolumePercent > 20`, `valueUsd < 250000`, `sameNameOtherAccountToday != null`, a BUY lot "at a loss" within 30 days plus SELL in a taxable account, XOM/CVX sells in ACC-GROWTH — five `if`s, checked against the labels, score 200 of 200 on issue naming. The report needs that baseline beside the model, and the honest framing: "parity with a hand-written rules engine, from the policy text alone, with zero code".
- **Planted trades are mechanically incoherent**, which gives the model a side channel: TR-0035 *buys* XLE at 5.16% against a 4.69% target, ending at 14.8%; TR-0112 buys GLD at 7.11% vs 7.04% target, ending at 8.8%; TR-0002 sells 412 shares and the weight does not move (6.87 → 6.87, target 3.13). A rebalancer would never propose these; "moves away from target" alone flags many planted items.
- Data scale: single trades of $1.36B (TR-0007, 37% of GLD's ADV) and a $13B order list for "Balanced, taxable" and two family trusts. PRP beats quote "3 days of volume" and "200 → 163"; the data tops out at 55% of one day and lands at 165.
- Missing KPIs: turnover avoided ($ of proposed value not sent: $18.6B proposed → $13B listed), estimated cost avoided (spread on too-small tickets, tax on wash sales), verdict macro-F1, over-caution rate (31 + 1 of 153 = 20.9%), automation rate at a confidence threshold.

**5. Bespoke Present screen (5 beats).**
1. A 200-row order blotter scrolls, all grey: "The rebalancer knows target weights. Nothing else."
2. TR-0154: BUY PEP $592M. ADV meter fills to 54.6% past the 20% line → stamp **RESIZE · split over days**; three child tickets drop into the tray.
3. TR-0015: SELL KO $124M at a loss; blind-spot panel reveals "bought $109M 18 days ago, lot at a loss, taxable" → **held**. Then TR-0112 / family trust A & B arrows pointing at each other in GLD → **net, don't send**.
4. TR-0139: SELL CVX in the Growth account; mandate sentence highlights "do not trim XOM or CVX below 9% before the December review"; after-trade weight 8.56% → **stopped**.
5. Blotter collapses: 200 → 165 tickets, $18.6B → $13B. Closing number: **"47 of 47 problem trades stopped; 1 clean trade held."** Footnote on screen: "31 clean trades trimmed — the cost of caution."

**6. Re-runnable model test.**
- Card: stop-recall (47/47), issue accuracy, **4-class verdict accuracy and macro-F1** (today 69% / 34% on problems), over-caution rate on clean trades ($ and count), wrong-in-list count (TR-0072 today), rules-engine baseline, per-issue slice table, sign-off rate (flag if 0% or 100%), confidence on approvals, diff vs previous run by trade id.
- Gates: stop-recall ≥ 98%; clean trades fully blocked ≤ 2%; clean trades resized ≤ 10%; nothing labelled REJECT in the order list.
- Dataset: make planted trades arithmetically consistent with their weights; add a **held-out-rule slice** (drop one rule from `desk.rules` and see whether the trade is still caught — the notes already propose this); add near-threshold items (19% and 21% of ADV; $240k and $260k; 29 and 31 days); add decoys (recent trades at a *gain*, same-name other-account trade in the *same* direction, mandate sentence about a different sector); state a DEFER-vs-REJECT convention in the rules or merge them for grading; realistic trade sizes.

**7. Bugs and defects seen.**
- Evidence arrays/objects dropped from the stage (`-3-stage-scored`, `-7-present`): no tax lots, no crossing, no mandate, no desk rules.
- `Needs Sign Off ⚠ Yes` and `Goes ⚠ Yes` amber on a clean approve; `Order Value 34680000` unformatted (`-5-evaluation`).
- Title appears three times (stage h2, eyebrow "TR-0001", view h3) (`-1-landing`).
- "agrees" suffix on items whose verdict disagrees (`-6-report`, Worth opening).
- Coverage curve has no axis values; KPI "$13B" has no "of $18.6B proposed".

**8. Top 5 actions.**
1. Build the trade-ticket view with weight track, ADV meter and the "what the rebalancer could not see" panel. [L] [demo-only]
2. Replace the issue matrix with a 4×4 verdict matrix; add problem-trade verdict accuracy (16 of 47) and an over-caution KPI in dollars; fix the "14 of 14" finding and the "agrees" tag. [S] [demo-only]
3. Fix or drop `needs_pm_sign_off` (200 of 200 yes); ask `size_band` only conditionally or grade its consistency with the verdict. [S] [demo-only]
4. Regenerate planted trades so weights/after-weights are coherent; add near-threshold, decoy and held-out-rule slices. [M] [demo-only]
5. Order-list artefact: a before/after blotter (200 → 165, $18.6B → $13B) as the report's hero instead of the distribution bar. [M] [demo-only; the "artefact" widget is reusable]

---

### 144 · Factor and sector exposure (`factor-exposure`)

**Scores (0–10):** Story clarity 6 · Item stage 1 · Answers-to-decision legibility 3 · Report and charts 3 · Presenter readiness 1 · Evaluation rigour 2 · Re-run/benchmark readiness 2

**1. The one-sentence value.** "The owner says 'diversified growth, not a momentum trade'; the holdings say otherwise — name the real bet and the one nobody meant to make." The first paint (`factor-exposure-1-landing.png`) at least puts the owner's sentence in the title, but the body is a JSON wall, `Cash Percent` and `Foreign Revenue Percent` are blank (same over-wide-table defect as 141), and the list rail wraps every label to three or four lines because `itemLabel` embeds the whole belief sentence (`demo.js:112`).

**2. Item stage review.**
- Needed: a two-panel **"what they said / what they hold"** stage.
  - Left: the owner's belief as a large pull-quote, home currency chip.
  - Right: a **seven-bar co-movement chart** (Momentum 0.423, Size 0.296, FX 0.190, Rates 0.186, Value 0.071, Quality −0.109, Energy −0.154 for FE-01), diverging around zero, with the representative basket tickers under each bar label. Under it, holdings as weight bars with a per-holding 7-cell heat row of `correlations` (4 holdings × 7 factors), sector and revenue-from-US %.
  - Sector weights as one stacked bar (Technology 76.9 / Other 18.1); foreign revenue gauge (49.1%).
  - After the answer: the dominant bar is outlined, the unintended bar gets a second outline in a different hue, and a "belief vs holdings" badge reads *Does not match*.
- Hide `id`, `homeCurrency` when USD, `currencyWeights` when 100% home.

**3. Answers and evaluation strip.**
- `dominant_factor` is answerable as `argmax(co_movement_by_plain_language_factor)`, which the state supplies pre-computed (`demo.js:20`). For all 30 books the top co-movement bucket equals the label. 30 of 30 is arithmetic, not judgement.
- `unintended_exposure` carries prompt-engineering inside the question text ("Never repeat dominant_factor; choose NONE when…") — a sign it was tuned until it passed; this belongs in the task, and it is a leading question.
- `single_factor_portfolio` is **uncalibrated and self-contradictory**: probabilities hover at 0.17–0.82 with most in 0.3–0.55; FE-01 answers unintended = SIZE *and* single-factor = yes (0.52) (`-5-evaluation` shows `Single ⚠ Yes`). Score: 15 of 30 — a coin flip — shown with no tone.
- `beliefGap` (`demo.js:57`) = 3 if mismatch + 2 if any unintended + strength/6: an arbitrary composite with no unit, surfaced as "gap 6.0" in Worth opening. The strip shows `Belief Gap 5.75` and `Matches ✓ No` in green.
- Card should say: "**Momentum** (co-movement 0.42), strength 4.5 Strong. Second bet the owner did not describe: **Size** (0.30). Owner's story does not match. Labels: dominant ✔ unintended ✔ belief ✔."

**4. Report, charts and metrics.**
- **The `unintendedFactor` label depends on the owner's words, not the holdings.** FE-01 and FE-03 have identical co-movement vectors (momentum 0.424, size 0.296) — FE-01 ("not a momentum trade") is labelled SIZE, FE-03 ("a deliberate momentum allocation") is labelled NONE. The model answered SIZE for both, which is consistent. Of the 12 "misses", **7 are this pattern** (FE-03, 05, 08, 15, 17, 20, 24: a "deliberate X" book whose twin carries the same second factor), 3 are the FX books (FE-26/28/30, where energy was named instead), and only 2 are ordinary misses (FE-07 rates→energy, FE-11 size→none). The finding text reports only "1 portfolios … called clean" (also a grammar bug) and says nothing about the 7 over-calls. The honest KPI: on books with a planted second factor, 16 of 20; false second-factor rate on single-factor books, 7 of 10.
- Label inconsistencies: FE-05 "A high-conviction momentum sleeve" is labelled `beliefMatchesHoldings: false` while FE-03 "A deliberate momentum allocation" is `true`. FE-27/FE-29 "deliberate global-revenue allocation" are labelled `true` although the labelled dominant factor is QUALITY, not FX; the model said "does not match" (0.20, 0.31) and was marked wrong. At least 3 of the 6 belief errors are label problems.
- Factor construction will not survive a practitioner: baskets overlap heavily (VALUE = JPM, BAC, XOM; RATES = JPM, BAC, GLD), **FX = GLD, XOM, SPY** has nothing to do with currency, "Momentum" = NVDA/MSFT/AAPL is a mega-cap-tech sector bucket, "Size" includes MSFT again. The caveat "teaching buckets" is on the page, but the matrix title still says "factor". Rename the demo's vocabulary to "themes" or build simple long-short proxies from the cache.
- Effective sample is about seven templates: within each group the co-movement vector is identical to three decimals (FE-01…05 all 0.423–0.424; FE-22…25 all 0.720–0.725), only the belief sentence changes. That is actually a nice design for testing the *belief* reading — but then the headline metric should be belief accuracy per template, not dominant factor.
- The 7×7 matrix is a perfect diagonal with an **entirely empty FX row and column** (0 planted dominant FX) — a decorative row that takes a seventh of the chart (`-6-report`).
- Strength distribution (16 / 10 / 4 at 4, 5, 6) is grey and answers no question.
- The PRP's "gap chart across 30 portfolios" and the "tech-free portfolio that still moves with tech" beat do not exist: no book is described as tech-free.
- Missing: argmax baseline (30 of 30 on dominant — say it), second-factor precision and recall separately, belief accuracy with a confusion 2×2, calibration of the two noul questions (reliability bars), per-template consistency.
- Charts that fit: (1) **said-vs-held slope chart** — left column the factor implied by the owner's sentence, right column the factor found, 30 lines coloured by match; (2) a 30-row small-multiple of seven-bar co-movement sparkbars with dominant/unintended outlined and a ✔/✘ per question; (3) reliability bars for `belief_matches_holdings` (bins 0–0.2 … 0.8–1).

**5. Bespoke Present screen (4 beats).**
1. Quote fills the screen: *"An income book whose returns should not depend on rates."* (FE-18)
2. The seven co-movement bars rise: Rates 0.479 tallest. Holdings heat rows appear — banks and gold. Badge: **Rates · 5.1 Very strong**; second bet: Value.
3. Twin reveal: FE-20, same holdings, owner says *"A deliberate rates-sensitive allocation."* → same dominant answer, badge flips to **Story matches** (0.77). "Same book, different owner, different verdict."
4. Close on the said-vs-held slope chart for all 30: **"24 of 30 owner stories read correctly — and the dominant bet named on all 30."** (Only after the label fixes; otherwise quote 24 of 30 alone.)

**6. Re-runnable model test.**
- Card: dominant accuracy with the argmax baseline beside it; second-factor precision/recall/F1; belief accuracy; twin-consistency (same holdings, different story → dominant answer unchanged, belief answer changes) as a named gate; Brier score for the two noul questions; per-template table; diff vs last run.
- Gates: twin-consistency 100%; second-factor F1 ≥ 0.75; `single_factor` either fixed to ≥ 80% or removed.
- Dataset: define "unintended" from holdings and belief *jointly* and document the rule; fix the FE-05/27/29 labels; remove `co_movement_by_plain_language_factor` from a hard slice so the model must aggregate the per-holding correlations itself; add books where the top two buckets are within 0.03 (ambiguous dominant); add a genuinely "tech-free" book that co-moves with tech; at least 15 distinct holdings templates; give FX a real proxy or delete the option.

**7. Bugs and defects seen.**
- Blank `Cash Percent` and `Foreign Revenue Percent` cells; holdings as clipped JSON with nested correlation objects (`-1-landing`, `-3-stage-scored`).
- Stage title wraps and pushes the phase stepper to a second row (`-1-landing`, `-3`).
- Empty FX row/column in the matrix (`-6-report`).
- "1 portfolios" grammar in findings (`demo.js:101`).
- `Matches ✓ No` green / `Single ⚠ Yes` amber semantics inverted (`-5-evaluation`).
- Worth opening lists three identical-looking energy books at "gap 6.0" — a capped composite with no discrimination.

**8. Top 5 actions.**
1. Fix the label logic for `unintendedFactor` and the three inconsistent belief labels; split the KPI into second-factor recall (16 of 20) and false second-factor rate (7 of 10). [S] [demo-only]
2. Build the said/held stage: quote + seven-bar co-movement chart + holdings heat rows. [L] [demo-only]
3. Drop or rewrite `single_factor_portfolio`; replace `beliefGap` with a plain "story mismatch" flag plus strength. [S] [demo-only]
4. Add the argmax baseline, twin-consistency gate and the said-vs-held slope chart. [M] [demo-only; slope chart reusable]
5. Rename "factors" to themes or rebuild the baskets so RATES/VALUE/FX are not the same five tickers. [M] [demo-only]

---

### 145 · Mandate compliance (`mandate-compliance`)

**Scores (0–10):** Story clarity 7 · Item stage 4 · Answers-to-decision legibility 5 · Report and charts 4 · Presenter readiness 2 · Evaluation rigour 3 · Re-run/benchmark readiness 5

**1. The one-sentence value.** "240 policy checks in, a 34-line compliance report out — every real breach, no near-miss noise, and the judgement calls flagged as judgement calls." First paint (`mandate-compliance-1-landing.png`, `-7-present`) is a 14-row key/value table for P-ALPHA-R01; it is readable (this is the one demo where TableView is merely dull, not broken) but it is a record, not a check: the limit (8), tolerance (0.25) and measured value (4.97) sit in three separate right-aligned rows far from each other.

**2. Item stage review.**
- Needed: a **limit gauge**. One horizontal scale per check: the measured value as a marker, the limit as a hard line, the tolerance as a hatched band beyond it, green/neutral/accent zones. For a floor (`limitIsAFloor`) the scale mirrors. For P-ALPHA-R01: marker at 4.97 on a 0–10% scale, limit at 8, band to 8.25. For notch and days rules the unit changes but the form does not.
- Above it: the rule sentence as a quotation with its reference (R01), the portfolio and mandate as a sub-header. Below it: the measurement note in a call-out when present, and the relevant policy definition (look-through, cash, ratings) pulled in by rule kind — these definitions are sent to the model (`demo.js:26`) but never shown.
- Better still, make the *item in presenter mode the portfolio*, not the check: a 20-row **compliance sheet** for one portfolio (R01…R20), each row a mini gauge with a status pill (Met / Inside tolerance / Breach / Depends on reading). This is the PRP's third video beat ("the compliance sheet for one portfolio, as a finished artefact") and it does not exist.
- Hide: `Id`, `Portfolio Id`, `Rule Id` duplicates, `Rule Kind` raw enum (it is a label-side field; showing `SINGLE_NAME` next to a question that asks for the kind looks like an answer key). Fix the label "Limit Is AFloor".

**3. Answers and evaluation strip.**
- `breach` is the right primary question and its probabilities are well behaved (194 of 240 below 0.1; 31 above 0.9).
- `breach_kind` is a **non-question**: it asks the category of the rule, which is a property of the rule text, not a judgement about the portfolio. 240 of 240 correct, and the `NONE` option ("nothing is at issue") was chosen 0 times because the prompt asks "What kind of rule is at issue?" — the option contradicts the prompt. It occupies the matrix and a KPI.
- `interpretation_dependent` fired on **35 checks**, only 6 of them among the 8 planted ones: 12 clear passes, 12 near misses and 5 plain breaches were also flagged. Recall 6 of 8, **precision 6 of 35 = 17%**. The report shows only the recall.
- `severity` is never compared with anything (distance beyond limit is known; a monotonicity check is trivial).
- `distanceFromLimit` (`demo.js:87`) is `measured − limit` regardless of `limitIsAFloor`, so for floors a breach shows a negative distance and a pass a positive one; the strip shows `-3.03` with no unit.
- Card should say: "**Met.** Largest issuer 4.97% against an 8% cap (+0.25 tolerance) — 3.03 points of headroom. Label: met ✔."

**4. Report, charts and metrics.**
- **The near-miss cohort does not test tolerance.** All 30 "near miss" items sit on the *compliant* side of the limit (P-ALPHA-R12: 2.95 against 3; P-ALPHA-R13: 99 against 100; P-BETA-R01: 7.9 against 8; the notes' own example is 19.54% against 20%). None of them is over the limit but inside the band. "Not one of the thirty near misses was written up as a breach. The tolerance in the policy was read as part of the rule" is therefore unsupported — the tolerance was never needed. The PRP's beat (10.4% against a 10% cap with 0.5% tolerance) is the real test and is absent.
- **Leakage:** `measurement.note` is sent to the model (`demo.js:43`). For all 30 near misses it reads "Inside the tolerance the policy allows." — the answer — and a note is present *only* on near-miss and reading-dependent items (0 of 176 clear passes, 0 of 26 breaches). Note-present is a perfect "not a plain breach" signal.
- **KPI contradiction:** "Checks called a breach wrongly — 8 of 214 — 0 of them are the ones sitting inside the tolerance", tone warn. Those 8 are 6 reading-dependent items (labelled `breach: false`, although the notes say they are deliberately *not* scored right or wrong) **plus 2 clear passes** — P-DELTA-R14 (0.58) and P-LAMBDA-R14 (0.55). The notes claim "all eight were treated as breaches" and "34 lines = 26 breaches plus the 8 arguable ones"; the data says 6 arguable + 2 false positives; P-BETA-R14 and P-KAPPA-R14 (the overdraft pair) were called *not* a breach at 0.14 and 0.12.
- The R14 borrowing rule is the model's real weak spot and nobody mentions it: measured value −0.3 against a limit of 0 produces breach probabilities of 0.36, 0.47, 0.47, 0.47, 0.46, 0.55, 0.58 across seven portfolios — a cluster sitting on the 0.5 decision line. A negative "borrowing" figure is also odd data. This is exactly what a threshold slider and a calibration plot would expose.
- Arithmetic baseline: `measured > limit + tolerance` (mirrored for floors) scores 232 of 240; it misses only the 8 reading-dependent items. The model's added value over a spreadsheet is entirely in those 8 — so they should be the centre of the report, shown as a table of their own with the note, the model's breach probability and its interpretation flag.
- The 6×6 "rule kind" matrix (48/48/36/36/36/36 on the diagonal) and the six-segment amber distribution bar are the two largest elements in the report and carry zero information (`-6-report`).
- The coverage curve is filtered to items already called breach, so x runs 34 → 0 and it is really a "severity vs realness" plot: at severity ≥ 2 it keeps 24 lines of which 22 are real; at ≥ 3, 11 of 11. Useful, but needs to be drawn as precision/recall of the *report* against a severity cut.
- Right headline KPIs: breach recall 26/26; false breaches on unambiguous checks 2/206; judgement calls surfaced 6/8 with flag precision 6/35; report compression 240 → 34 lines; arithmetic-baseline parity on 232 unambiguous items. Missing: ECE/Brier for `breach` (the distribution is bimodal and should score well — show it), per-rule slice table (R14 stands out), per-portfolio breach counts (P-EPSILON 5, P-MU 0).
- Charts that fit: (1) **portfolio × rule heat grid**, 12 rows × 20 columns, cell = status (met / inside tolerance / breach / reading-dependent), with a ✘ overlay where the model disagrees — it is the whole dataset on one screen and is the domain's strongest candidate for a signature visual; (2) a "distance to limit" strip: x = (measured − limit)/tolerance-scaled distance, y = P(breach), 240 dots — a well-behaved model draws a step function and R14 shows up as a smear at zero; (3) the eight judgement calls as a table.

**5. Bespoke Present screen (5 beats).**
1. The 12 × 20 grid appears empty: "Twelve funds. Twenty rules. 240 checks a compliance analyst does by hand each month."
2. Zoom into P-ZETA-R07: rule sentence, gauge — average rating 9.3 notches below AAA against a limit of 7 → **Breach · 4.3 Material**. Cell turns accent.
3. P-ETA-R02: two subsidiaries of one parent, 11.97% looked-through against 10%. The definition of look-through slides in from the policy. Model: breach 0.97. Then P-LAMBDA-R11 (cash incl. a six-week bill; definitions silent): breach 0.87 **and** "depends on the reading" 0.67 → cell gets a striped "judgement" pattern.
4. The grid fills in at speed; 206 cells stay quiet.
5. The grid folds into a one-page report: **"240 checks → 34 lines. 26 of 26 breaches. 0 missed."** (Once a real over-limit-inside-tolerance cohort exists, add "30 inside tolerance left alone".)

**6. Re-runnable model test.**
- Card: breach recall and precision on unambiguous checks; false-breach count; interpretation-flag precision *and* recall; Brier/ECE on `breach`; count of answers within 0.35–0.65 (the "on the fence" count — 9 today, 7 of them R14); severity monotonicity vs distance beyond limit; per-rule-kind and per-rule-id slices; arithmetic baseline; diff vs last run by check id.
- Gates: recall = 100%; false breaches ≤ 1%; flag precision ≥ 50% and recall ≥ 75%; no rule id with more than 2 answers in the 0.35–0.65 band.
- Dataset: make near misses real (over the limit, inside tolerance) and add "just outside tolerance" twins; remove or neutralise `measurementNote` on near misses and add neutral notes to clear passes and breaches so note-presence is not a signal; fix the R14 measurement (no negative borrowing); give reading-dependent items a label of `ARGUABLE` and exclude them from the false-breach KPI; more of them (≥ 24, several patterns per rule kind); remove `breach_kind` or turn it into "which clause of the policy decides this".

**7. Bugs and defects seen.**
- "Limit Is AFloor" label (`-3-stage-scored`, `-7-present`).
- `Rule Kind SINGLE_NAME` raw enum on the stage next to a question asking for it.
- `Distance From Limit -3.03` unitless and sign-wrong for floors (`-5-evaluation`).
- KPI context "0 of them are the ones sitting inside the tolerance" reads as reassurance while hiding 2 genuine false positives (`-6-report`).
- Six-segment distribution all amber, labelled with rule kinds as if they were findings (`-6-report`).
- `topItems` label "against 7" / "against 100" drops the unit on the limit.

**8. Top 5 actions.**
1. Rebuild the near-miss cohort so it is genuinely over-limit-inside-tolerance, and strip the answer-revealing `measurementNote`; re-record; correct the notes. [M] [demo-only]
2. Replace the rule-kind matrix and distribution bar with the 12 × 20 portfolio-by-rule status grid. [M] [demo-only; grid widget reusable]
3. Limit-gauge stage and a per-portfolio compliance sheet for presenter mode. [L] [demo-only]
4. Fix the KPIs: separate arguable items from false breaches (2 of 206), add interpretation-flag precision (6 of 35), add the arithmetic baseline (232 of 240) and the R14 slice. [S] [demo-only]
5. Remove `breach_kind`; add the distance-vs-P(breach) strip with a movable threshold. [M] [shared-runtime for the threshold control]

---

### 146 · Income and cash planning (`income-planning`)

**Scores (0–10):** Story clarity 7 · Item stage 5 · Answers-to-decision legibility 5 · Report and charts 3 · Presenter readiness 3 · Evaluation rigour 1 · Re-run/benchmark readiness 2

**1. The one-sentence value.** "Enough income for the year is not the same as enough cash in March — it tells a shortfall from a timing gap from idle cash, and names the month." This is the only demo in the domain with a bespoke chart on first paint (`income-planning-1-landing.png`), and the form is right — but **the bars are black on navy**: `.calendar-income { fill: var(--cyan) }` and `.calendar-commitment { fill: var(--violet) }` (`web/src/styles/demo.css:719-720`) reference undefined variables, so income and commitment bars fall back to black and the two legend swatches are invisible. Global finding 9 in general; here it destroys the demo's only visual.

**2. Item stage review.**
- Shown (`CalendarView.jsx`): paired monthly bars for income and commitments, a translucent "uncovered gap" block, a y-axis with two oddly specific ticks ($30,177 / $15,089 — the max and half-max, not round numbers), a collapsed table.
- Missing, in order of importance:
  1. **The projected cash line.** `projectedCash` is in the data and in the table but not drawn. The whole distinction between SHORTFALL, TIMING and NONE is whether that line crosses zero and whether it recovers; without it the chart cannot show the thing the demo is about. Draw it as a line on a secondary scale (or a second panel beneath, sharing the x-axis) with the area below zero filled in the accent colour and, for cash drag, a dashed line at six months of commitments (`six_month_cash_drag_threshold_usd`) with the area above it hatched.
  2. Starting cash ($4,758 = 0.9 months) — the most important scalar — appears nowhere.
  3. The special commitment and its purpose ("JAN · $26,899 · property instalment and tax payment") should be an annotation on the January bar.
  4. Income sources: monthly fund $1,084 × 12, quarterly dividends $3,048, semi-annual coupon $5,418 — stack the income bar by source so quarter-ends visibly differ, and show reliability as solid/hatched.
  5. The sale rule sentence.
- After the answer: a pin on the month named by `worst_month`, and a header pill "Shortfall — $30.2k short over the year · sell needed".
- Use round ticks ($0 / $10k / $20k / $30k). Title is duplicated three times (stage h2, eyebrow, view h3) and is a poor title — "$36,036 income · $66,235 commitments" should be "Household 01 · income covers 54% of commitments".

**3. Answers and evaluation strip.**
- `worst_month`'s prompt contains the algorithm ("choose the month with the most negative monthly_gap_usd, not a later month with the lowest accumulated cash… CASH_DRAG and NONE must answer NONE") and each option repeats it. With `monthly_gap_usd` pre-computed in the state (`demo.js:20`), this is an argmin lookup. It reads as a question rewritten until the score reached 40 of 40.
- `problem` definitions are arithmetic, and the state provides every operand pre-computed: `annual_income_usd`, `annual_commitments_usd`, `starting_cash_usd`, `minimum_projected_cash_usd`, `six_month_cash_drag_threshold_usd`. A four-line rule (`cash + income − commitments < 0` → SHORTFALL; else `minimumProjectedCash < 0` → TIMING; else `startingCash > 6 × avgMonthly` → CASH_DRAG; else NONE) scores **40 of 40 on problem and 40 of 40 on month**. The notes say the labels are "arithmetic invariants"; that is another way of saying there is nothing for a model to add.
- `sell_needed` has a label (`sellNeeded`) and clean separation in the answers (0.66–0.87 for shortfall/timing, 0.07–0.10 otherwise) and **is not graded or shown in the report at all**.
- `coverage` "accuracy" uses overlapping bands (`demo.js:88-93`: NONE ≥ 3.5, CASH_DRAG ≥ 4, TIMING 2–4.5, SHORTFALL < 3) — a score of 4.2 is "correct" for three of four classes. 40 of 40 on that is not evidence.
- Strip: `Worst Gap -29093` unformatted; `Sell Needed ⚠ Yes` amber (appropriate here, by luck); `Confidence 1`.
- Card should say: "**Shortfall.** $36.0k income + $4.8k cash against $66.2k commitments: $25.4k short. Worst month January (−$29.1k: property instalment and tax). A sale is needed. Labels ✔ ✔ ✔."

**4. Report, charts and metrics.**
- Four KPIs all perfect (40/40, 40/40, 40/40, 5/5), a 4×4 identity matrix, four green check rows with 0 misses, no findings, no curve (`-6-report`). There is no tension, nothing to look at, and — given the rules baseline — nothing demonstrated. **A 100% wall on an arithmetic dataset is the least persuasive report in the domain.**
- Items are ordered by class in the file: IP-01…09 shortfall, 10…15 timing, 16…20 cash drag, 21…40 none. Not a leak to the model (one item per call) but it makes the list rail look staged and means "Play all" shows every shortfall first.
- `topItems` is fine (worst gap in dollars) but lists 15 rows with the same "1.1/6" coverage — no discrimination.
- What would make it a test: uncertainty. The holdings already carry `reliability` strings ("amount may vary", "amount estimated", "contractual coupon") that play no role in any label. Make them matter: a timing gap that only closes if an *estimated* dividend arrives in full is a different answer from one covered by a contractual coupon.
- Missing KPIs: `sell_needed` accuracy, rules-baseline parity, dollars of shortfall identified, months of idle cash flagged, a robustness slice (does the answer hold when the pre-computed helper fields are removed?).
- Charts that fit: (1) a **40-row cash-runway small-multiple** — one sparkline of projected cash per account, zero line marked, coloured by named problem, ✔/✘ per row; the four classes have four unmistakable shapes (dives and stays under; dips and recovers; floats high; hugs the band); (2) a lollipop of lowest projected cash per account, sorted, with class colour; (3) if uncertainty is added, a fan around the cash line.

**5. Bespoke Present screen (4 beats).**
1. IP-13 (timing): the headline tiles "Income $X ≥ Commitments $Y — fine for the year" with a green tick. Pause.
2. The calendar animates month by month; the cash line draws left to right, crosses zero in August (gap −$25.9k) and recovers when the coupon lands. Pin drops on **AUG**. Verdict: **Timing, not shortfall** · coverage 2.4 Tight · sale needed unless the payment is moved.
3. Contrast pair, side by side: IP-01 (shortfall — the line goes under in January and never returns, −$31.7k minimum) and IP-16…20's first cash-drag account (line floats far above the six-month band, hatched "idle").
4. The 40 sparkline wall, grouped into its four shapes: **"9 shortfalls, 6 timing gaps, 5 idle-cash accounts, 20 left alone — 40 of 40, month named on every one."** With an on-screen footnote that a rules engine ties here, until the harder slice exists.

**6. Re-runnable model test.**
- Card: problem accuracy, month accuracy, `sell_needed` accuracy, coverage-band accuracy with non-overlapping bands, rules-baseline score, **helper-free slice** (state without `monthly_gap_usd`, `projected_cash_after_month_usd`, `minimum_projected_cash_usd`, threshold — model must do the running sum), near-boundary slice, latency/tokens, diff vs last run.
- Gates: full-state slice 100% (it is arithmetic; anything less is a regression); helper-free slice ≥ 90%; near-boundary slice ≥ 80%.
- Dataset: shuffle item order; add boundary cases (minimum projected cash between −$500 and +$500; starting cash at 5.9 and 6.1 months); accounts with two problems (shortfall *and* an earlier timing hole; label primary + secondary); payment-reliability scenarios that change the answer; irregular schedules (a skipped dividend, a coupon that moves month); multiple special commitments; remove the algorithm from the `worst_month` prompt and put the convention in `policy.interpretation` only (it is already there).

**7. Bugs and defects seen.**
- Income and commitment bars render black; legend swatches for both invisible (`-1-landing`, `-3-stage-scored`, `-7-present`).
- Gap block is a wide translucent mauve rectangle behind both bars, reading as a third bar rather than a gap (`-3-stage-scored`).
- Y ticks at $30,177 and $15,089 (`-3`).
- Title tripled (`-7-present`).
- `Worst Gap -29093` raw (`-5-evaluation`).
- Presenter first screen (`-7-present`) is the black chart at larger size — the worst possible frame to record.
- Distribution bar all grey (`-6-report`).

**8. Top 5 actions.**
1. Fix the chart colours locally (do not wait for the global variable fix) and draw the projected-cash line with the below-zero area, six-month band, starting cash and the annotated special commitment. [M] [demo-only, CalendarView]
2. Add a helper-free slice and a near-boundary slice; publish the rules baseline next to the model; grade `sell_needed`. [M] [demo-only]
3. Replace the identity matrix with the 40-row cash-runway sparkline wall. [M] [demo-only; sparkline-wall widget reusable by 141/144]
4. Remove the algorithm from the `worst_month` question text; shuffle the item order; tighten the coverage bands. [S] [demo-only]
5. Make payment reliability matter (scenarios that flip TIMING ↔ NONE) so the demo contains a judgement. [L] [demo-only]

---

## Domain summary

**Cross-demo patterns**

1. **The state does the thinking.** Every demo pre-computes the decisive quantities and ships them to the model: `co_movement_by_plain_language_factor` (144), `summary` blocks (142), `monthly_gap_usd` / `minimum_projected_cash_usd` / the drag threshold (146), `this_trade_as_share_of_that_percent` and the five desk rules (143), limit/tolerance/measured (145), `largest_holding_percent` / `held_outside…` (141). Rules baselines: 146 → 40/40 and 40/40; 142 → 18/18; 145 → 232/240; 144 dominant → 30/30; 143 issue → 200/200; 141 → 21–24 of 24 against the model's 16. None of the six reports shows a baseline. The honest pitch for this domain is "parity with a hand-built rules engine from policy text alone, plus the judgement calls a rules engine cannot make" — so every demo needs (a) the baseline on screen and (b) a slice where the baseline fails.
2. **Free-text notes leak labels.** 141 `adviser_note` is 1:1 with the six classes; 145 `measurementNote` says "Inside the tolerance the policy allows." on all 30 near misses and is present only on non-plain items; 143's lot note ("currently at a loss") is close to it.
3. **Planted classes that do not test what they claim.** 141 liquidity (0.5–0.7 days against a 1-day rule — the model is right, the label is wrong); 145 near misses (all under the limit — tolerance never exercised); 144 unintended = NONE decided by the owner's adjective, not the holdings; 143 problem trades that move away from target.
4. **Notes and PRP beats that the data does not support.** 145 "all eight were treated as breaches" / "34 = 26 + 8" (actually 26 + 6 + 2 false positives); 143 "all fourteen oversized trades came back with a smaller size… the trade still happens" (5 were rejected); PRP beats quoting "4 days of volume", "3 days of volume", "10.4% against 10%", "tech-free portfolio", "200 → 163" — none exist in the files.
5. **Dead and ungraded questions.** `needs_pm_sign_off` 200/200 yes (143); `action` HOLD 0/24 (141); `breach_kind` 240/240 trivially (145); `single_factor_portfolio` 15/30 (144); ungraded: `sell_needed` (146), `goal_constraint_breached` and `one_change_would_flip_it` (142), `size_band` consistency (143), `severity` everywhere.
6. **Effective sample sizes are much smaller than item counts.** 142 ≈ 9 distinct comparisons of 18; 144 ≈ 7 holdings templates of 30; 141 has 3–5 per class.
7. **Stage:** three of six demos use the fallback TableView (141, 144, 145) and one the generic QueueView (143). Domain-specific consequence: in 141 and 144 the JSON blobs widen the table so that every right-aligned numeric value is off-screen; in 143 the evidence arrays are dropped entirely. The two bespoke-ish views (142 comparison, 146 calendar) each omit the decisive element (the constraints; the cash line).
8. **Implausible money.** Named individuals with $416M–$5.8B books (141); $1.36B single trades and a $13B order list for family trusts (143). A portfolio practitioner will stop believing at that point.
9. **The genuinely strong results are buried:** confidence separating all 8 errors from all 16 correct answers (141); swap-consistency on five mirrored pairs and decisiveness separating close/trap/decisive cohorts (142); 47 of 47 stops with a 20.9% over-caution cost (143); twin books with identical holdings and different stories (144); a bimodal, well-calibrated breach probability with one visibly shaky rule, R14 (145).

**Flagship pick: 145 · Mandate compliance.** It is the use case a buyer recognises immediately (monthly mandate monitoring is real, tedious and expensive), it has the largest and most naturally structured dataset (12 portfolios × 20 rules), it ends in a tangible artefact (240 checks → a 34-line report), it contains the domain's only intrinsically non-rule-engine content (the eight reading-dependent checks with their policy definitions), and its answers are well calibrated enough to support a threshold slider and a calibration plot. It needs the near-miss cohort rebuilt and the note leakage removed before it can carry the claim "tolerance understood", but those are small generator changes. Runner-up: 143 rebalance-review, for the before/after order blotter — best video, weakest as a model test until a held-out-rule slice exists.

**Signature visual for the domain: the "limit track".** One horizontal scale with a marker for *where the portfolio is*, a hard line for *where it should be or must not pass*, and a shaded band for tolerance. Every demo in this domain is, underneath, a position measured against a line: measured value vs policy limit (145), weight now → after → target with a tolerance band (143), A and B dots against a goal constraint (142), largest name / top correlation / days-of-ADV / off-currency share against house thresholds (141), co-movement bars against the owner's stated bet (144), projected cash against zero and the six-month band (146). Used as the row primitive in each bespoke stage, and tiled into a grid for the reports (12 × 20 in 145, 40 cash-runway rows in 146, 24 five-dial rows in 141), it would give the Portfolio domain one recognisable visual language instead of six key/value tables.
