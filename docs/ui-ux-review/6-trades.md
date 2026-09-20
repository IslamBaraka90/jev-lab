# Domain 6 · Trades and execution — demo-by-demo review

Scope: 151 post-trade-review, 152 trade-feature-analysis, 153 execution-quality, 154 trader-behaviour, 155 journal-vs-reality, 156 missed-trades. Evidence: demo.js, notes.md, PRPs, labels, fixtures, the computed report dumps and the 1440px screenshots. Numbers quoted as "recomputed" were derived read-only from `demos/<id>/data.json`, `fixtures.json` and the label files; nothing in the repository was changed. Global findings 1–10 from the brief are assumed and not repeated except where they bite unusually hard here.

---

### 151 · Post-trade lesson review (`post-trade-review`)

**Scores (0–10):** Story clarity 5 · Item stage 3 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 2 · Evaluation rigour 4 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "Every closed trade gets a one-line lesson that grades the plan, not the P&L — discipline scored 4.7 on winners and 4.6 on losers." First paint (`post-trade-review-1-landing.png`) shows a title, a 220-row rail and a bare candle chart of KO with a red "Decision" flag. Nothing says plan, stop, target, exit or lesson. The strongest claim in the whole domain (outcome-blind grading) is invisible until Play all finishes, and even then it is KPI 4 of 5 with a value that wraps onto three lines.

2. **Item stage review.** The single most damaging defect in this domain: the chart draws **no entry, stop, target, exit or stop-move**. `CandleChart` fully supports a trade overlay (`web/src/charts/CandleChart.jsx:154-178`: stop/target levels, entry dot, exit dot, trade path, return label) but `LabCandlesView` only passes `chart.trade` (`web/src/demo/views/CandlesView.jsx:118-120`) and this dataset's `item.chart` contains only `{markIndex, bars}` — the generator never emits `trade`. Demo 152 does emit it and gets the levels; 151, the demo whose entire subject is the plan, does not. The PRP's own video beat ("a moved stop, shown as two dashed levels") is impossible today.
   - A reviewer needs, above the chart: a **plan strip** — Direction · Signal 53.61 on 27 Sep · Entry 54.25 on 1 Oct (**+4 bars late**) · Stop 53.53 (−1.3%) · Target 56.04 (+3.3%, 2.5R) · Horizon 7 bars · ADR 1.32% · "Target needs 0.36× of range×horizon".
   - On the chart: signal marker and entry marker as two distinct pins (the gap between them *is* the chased-entry story); stop and target as labelled horizontal levels; each stop move as a second dashed level beginning at `onBar` with an arrow from → to; exit dot coloured by result with the exit reason as its label; a shaded "planned horizon" band from entry to entry+horizon.
   - Rename the "Decision" flag to "Entry". Hide `sizeUsd` unless converted to dollars at risk (size × stop distance).
   - Missing fields when no stop: render a red "NO STOP" ghost level rather than nothing.

3. **Answers and evaluation strip.**
   - `plan_complete`, `target_realistic`, `stop_honoured` are good, separable, checkable questions. `exit_discipline` is fine. `repeatable_setup` has **no ground truth** and returns yes on only 35 of 220 — including only 30 of the 90 well-run trades (recomputed). A reviewer would read that as "two thirds of your properly-run trades were not worth taking", which the state cannot support (no setup thesis is in the state). Drop it or give it a label.
   - `target_realistic` is not graded at all in the report, yet it answers "no" for 13 of the 90 well-run trades and for TD-0001 (whose target needs 3.3% in 7 bars at 1.32% ADR — easily reachable). It is the noisiest question and it is unaudited.
   - Evaluation strip (`post-trade-review-5-evaluation.png`): "Plan Complete: Yes" and "Stop Honoured: Yes" are rendered as **amber warnings**, while "Target Realistic: No" and "Repeatable: No" get a **green tick**. The polarity is exactly backwards for every boolean in this demo.
   - Verdict card should read: `Lesson: PLAN FOLLOWED (58%) · Planted: CHASED ENTRY · ✗ miss` / `Plan ✓ complete · Target ✓ reachable · Stop ✓ honoured · Exit 5.3/6` / `Entry was 4 bars after the signal and 1.2% above it — not covered by any desk rule`. Note the first item a visitor ever sees, TD-0001, is one of the 18 misses; with agreement hidden it looks like a success.

4. **Report, charts and metrics.**
   - Headline should be **198/220 = 90.0% exact, macro-recall 83%** with per-class recall: no stop 30/30, moved stop 24/24, exited early 26/26, target too far 24/28, **chased entry 4/22**, plan followed 90/90. Precision for "plan followed" is 90/112 = 80% — the report celebrates "90 of 90 left alone" but never says that 22 faulty trades were also waved through as clean.
   - **Label defect:** all 28 `TARGET_TOO_FAR` trades are labelled `planComplete:false`, yet the desk rule in the state says a plan is complete "when direction, stop, target and holding period are all written down". The model answered "complete" for all 28 — correctly by the written rule. The KPI "Plan completeness read right 87.3% (192 of 220)" is therefore 100% model-correct and 28 label errors. Fix the labels (only `NO_STOP` is incomplete) and this KPI becomes 219/220 or similar.
   - **The task is solved by five if-statements.** A rules baseline — null stop → NO_STOP; non-empty `stopMoves` → MOVED_STOP; `exitReason` contains "by hand" → EXITED_EARLY; `barsBetweenSignalAndEntry ≥ 3` → CHASED_ENTRY; target distance > ADR × horizon → TARGET_TOO_FAR — scores **220/220** (recomputed). The model scores 198. Planted targets are absurdly far (TD-0005: 63.13 → 88.45, +40% in 8 bars; minimum planted ratio 1.61× vs maximum clean ratio 0.62×), and `exit_reason` literally says "closed by hand, no reason recorded". The report must show this baseline and the dataset must be made harder, otherwise the benchmark proves the model is *worse* than a lookup.
   - **Post-exit leakage:** 54 of 220 items include one bar *after* the exit in `chart.bars`, contradicting the header comment, the notes and the PRP acceptance test. Cause: `scripts/generate/post-trade-review.js:90` slices to `entryIndex + max(barsHeld + 1, 3)`, so any trade held 0–1 bars gets an extra bar. TD-0001 exits 4 Oct and the state includes 5 Oct.
   - **Wrong instruction in the state:** `demo.js:48` tells the model "The entry bar is the twenty-sixth" but `BEFORE = 20` in the generator, so the entry is the twenty-first bar and most items have only 23 bars. Likely contributes to the chased-entry and target misses.
   - **Unfillable entries:** 18 chased entries have an `entryPrice` outside the entry bar's high–low range (TD-0001: entry 54.25, bar range 52.57–53.20). Once the overlay is drawn the entry dot will float above the candle.
   - Calibration (recomputed, top-probability bins): 0.4–0.6 → 64% correct (n=14); 0.6–0.8 → **48%** correct (n=29); 0.8–1.0 → 99% (n=177). A reliability diagram would show one badly over-confident bin, entirely made of chased entries.
   - Coverage curve: discipline ≤ 2 returns 34 trades, all faulty; but NO_STOP averages 4.5/6 and CHASED/TARGET 5.4–5.5/6, so discipline score is only a detector for exited-early (1.5) and moved-stop (3.1). Say that; replace the curve with a **strip plot of discipline score by planted lesson**.
   - Missing versus spec: the "if the stop had been honoured" counterfactual, discipline-versus-return scatter, stop-move frequency. The counterfactual is the money number this demo lacks entirely — no KPI is in dollars.
   - Charts that fit: (a) ranked horizontal bar "repeating mistakes" with count and total P&L per lesson; (b) scatter x = result %, y = discipline score, colour = planted lesson, with the flat regression line annotated "slope ≈ 0: grades the plan, not the result"; (c) per-class recall bars with the rules baseline as a tick mark.

5. **Bespoke Present screen.**
   - Beat 1 — "A loss that was well run": TD-0104-style contrast is weaker than a clean loser; use any PLAN_FOLLOWED loser and show plan levels, stop hit exactly, lesson "Plan followed. The result is not the lesson."
   - Beat 2 — "No stop": **TD-0060** (NVDA long, no stop, held 9 bars, −12.62%). Ghost stop level where a 1×ADR stop would have been, counterfactual loss beside the real one.
   - Beat 3 — "Moved stop": **TD-0024** (CVX short, stop moved 158.42 → 161.33 on bar 1, stopped at the moved level, −5.27% versus −3.4% at the original). Two dashed levels, arrow between them, discipline 1.1/6.
   - Beat 4 — "The honest miss": **TD-0001** (KO, entered 4 bars late, read as plan followed). Overlay the four desk rules and highlight that none mentions late entry; caption "18 of 22 chased entries missed — the rule was never written."
   - Close: split screen winners 4.7 / losers 4.6 with the single number **0.1 points apart**.

6. **Re-runnable model test.** Benchmark card: exact-lesson accuracy, macro-recall, per-class recall and precision, clean-trade false-fault rate (gate: ≤ 2/90), plan-complete accuracy, winner–loser discipline gap (gate: |gap| ≤ 0.5), ECE on `lesson`, rules-baseline score, delta versus previous model and versus a "fifth rule added" state variant. Dataset changes: fix `planComplete` labels; fix the bar slice and the "twenty-sixth" sentence; make targets borderline (ratios 0.8–1.4 around the threshold); neutralise `exitReason` wording ("closed manually" with a separate optional `exit_note`); add compound faults with a documented primary; add chase cases at 1–2 bars as negatives; publish seed and a second held-out seed; keep 40% clean.

7. **Bugs and defects seen.**
   - No trade overlay on any chart (`-3-stage-scored.png`, `-7-present.png`).
   - Boolean badge polarity reversed (`-5-evaluation.png`).
   - KPI "4.7 against 4.6" wraps to three lines; its context sentence reads as a criticism although tone is good (`-6-report.png`).
   - Distribution legend: five faults in identical amber, indistinguishable (`-6-report.png`).
   - Coverage chart has no ticks and its first two points are null-rate (`-6-report.png`).
   - Check label "Target too far not named 4 of 28" while the matrix row sums to 28 but distribution shows 24 — fine, but the check rows are phrased as double negatives ("No stop not named · 0 of 30" with a green tick).
   - State text says twenty-sixth bar; data has 21st (`demo.js:48`).

8. **Top 5 actions.**
   1. Emit `chart.trade` (+ signal index, stop moves, horizon) from the generator and extend `TradeOverlay` for stop-move levels and a signal pin. [M] [demo-only + small shared-runtime]
   2. Fix the three data defects: `planComplete` labels, post-exit bar slice, "twenty-sixth" sentence; re-record. [S] [demo-only]
   3. Add the rules baseline and per-class precision/recall to the report; harden the dataset so the baseline no longer scores 100%. [M] [demo-only]
   4. Compute the stop-honoured counterfactual in dollars and the discipline-vs-return scatter; make "0.1 points apart" and the dollar figure the two headline tiles. [M] [demo-only + one shared scatter widget]
   5. Re-record with a fifth desk rule on late entry as a named variant, and show before/after chased recall as the first "drift between runs" example. [S] [demo-only]

---

### 152 · Trade feature analysis (`trade-feature-analysis`)

**Scores (0–10):** Story clarity 4 · Item stage 5 · Answers-to-decision legibility 3 · Report and charts 3 · Presenter readiness 2 · Evaluation rigour 3 · Re-run/benchmark readiness 3

1. **The one-sentence value.** "Reading only the entry bar, the model's 'would take again' picks won 55.6% against a 44.3% base — and the features that did not matter show no gap." First paint shows an AAPL chart with a stop and target tag and nothing about outcomes, hidden information or edges. The concept (blind read, later reveal) is the most interesting mechanic in the domain and is not communicated anywhere on the stage.

2. **Item stage review.** Best of the candle demos because `chart.trade` exists, so entry dot, stop 109.21 and target 121.59 are drawn (`trade-feature-analysis-3-stage-scored.png`). But the two things that actually drive outcomes are not drawn:
   - the **20-day moving average** (in the state as `moving_average_20`, 116.08 for TF-001) — draw it as a line, and draw the distance from entry to MA as a bracket labelled "1.92% from MA";
   - the **entry bar close location** (0.026 for TF-001) — draw a small vertical gauge beside the entry candle with the close position and a "top third" band.
   - Add a locked "Outcome — revealed in report" chip at the right edge where post-entry bars would go; when the report exists, unlock it to WIN/LOSS. This is the hidden-information device the demo needs.
   - Fact strip: Setup (trader's label) · R multiple of plan (1.67R) · volume 1.12× · gap −0.14% · recent range 6.36%. Hide `dayOfWeek`, `roundNumber` from the practitioner view but show them in a "controls" footnote.
   - Y-axis label "110.00" is overdrawn by the stop tag.
   - Note `distance_from_ma_percent` is unsigned: TF-001 enters *below* its MA (113.85 vs 116.08) and is still labelled "extended". A "breakout" long that closes at the bottom 3% of its bar, below the MA, is not a breakout; the synthetic setup label is detached from the real candles.

3. **Answers and evaluation strip.**
   - `setup_type` is an **echo question**: `trader_labelled_setup` is in the state and the answer equals it on 300 of 300 items (recomputed). It carries zero information and should either be removed or the label withheld and graded.
   - `context`: `NEWS_DAY` is never chosen (0 of 21 items whose `contextEvidence` is NEWS_DAY) because no news evidence is in the state; agreement with `contextEvidence` is 158/300 = 53% and TREND is read as RANGE 73 times. It is ungraded in the report. Either put the evidence in the state or drop the option.
   - `extended_entry` has a label (`extendedEntry`, threshold exactly 1.5% — planted min 1.50, clean max 1.49) and the number is handed to the model verbatim, yet accuracy is only **70%** (TP 139, FN 55, FP 35, TN 71; precision 0.80, recall 0.72). A one-line rule scores 100%. The report never shows this.
   - `entry_quality` uses only 0.9–4.3 of the 0–6 range; nothing is ever "Very good" or "Excellent", so the PRP's beat "quality 5 and 6 against 1 and 2" cannot be filmed.
   - Strip shows "Confidence 0.27", which is actually the `would_take_again` probability (`demo.js:33`), not a confidence.
   - Verdict card: `Entry quality 1.7/6 · Would not take (27%) · Called: not extended — planted: extended ✗` and, after reveal, `Outcome: LOSS`.

4. **Report, charts and metrics.**
   - The lift is **not statistically distinguishable from noise**: 30 wins of 54 selected vs 44.3% base gives z ≈ 1.66 (one-sided p ≈ 0.05, 95% CI for the take-rate roughly 42–68%). AUC of `entry_quality` against outcome is **0.596**, of `would_take_again` 0.594 (recomputed). The report prints "11.2 percentage points versus base" in green with no interval.
   - **No ceiling is shown.** The planted structure is nearly deterministic: near-MA + top-third close wins 38/38 (100%); extended + not-top-third wins 5/106 (4.7%); the other two cells 53% and 63%. A two-feature rule selecting the first cell achieves a 100% win rate on 38 trades; the model achieves 55.6% on 54. A fair card says "model captured ~20% of the available lift".
   - The "ranked by gap" table ranks **0.22 (points on a 0–6 scale)** above **0.16 and 0.08 (proportions)** — incomparable units sorted together (`demo.js:70-76`). Use standardised effect size (Cohen's d / AUC) per answer.
   - The planted-edge reveal is pushed through `CheckList` as "50 of 100" with an **amber warning icon on every row including the controls** (`-6-report.png`), which reads as five failures. Needs its own widget.
   - The setup × outcome table is rendered by ConfusionMatrix with the header "Planted ↓ · Called →" and warm heat on every cell; it is not a confusion matrix.
   - The distribution bar is all grey and its legend shows count · share, hiding the win rate per bucket (25.0% / 33.7% / 49.7% / 55.6%) which is the one monotone, persuasive result in the report.
   - Charts that fit: (a) **win rate by entry-quality bucket** as a column chart with Wilson intervals and the 44.3% base as a reference line; (b) a **dumbbell / lollipop "gap" chart**: one row per feature (two planted, three controls, three model answers), x = win-rate gap in points, planted rows revealed last with an animation; (c) a 2×2 heat tile of the planted cells with the model's take-rate overlaid per cell — this shows exactly where the model did and did not find the edge; (d) ROC curve for `would_take_again` probability.

5. **Bespoke Present screen.**
   - Beat 1 — "Read blind": TF-237 (breakout, quality 4.3, not extended). Chart ends at the entry bar, locked outcome chip; answers animate in.
   - Beat 2 — "Same setup label, different entry": TF-001 (breakout, 1.92% from MA, close location 0.03, quality 1.7). Side by side with TF-237, MA line and close gauge highlighted.
   - Beat 3 — "Reveal": chips flip — TF-237 WIN, TF-001 LOSS; then the bucket chart fills: 25% → 34% → 50% → 56%.
   - Beat 4 — "What did not matter": controls lollipops at 1, 6 and 4 points; then the two planted edges slide in at 50 and 40.
   - Close: **44.3% → 55.6%** with the interval printed under it, and an honest sub-line "a two-feature rule would reach 100% on this synthetic set; the model found about a fifth of it".

6. **Re-runnable model test.** Record: take-rate, selected n, lift with 95% CI, AUC for quality and for would-take, win rate per quality bucket (monotonicity gate), extended-entry accuracy/precision/recall against the label, control-feature gaps in the *model's selections* (gate: the model's take-rate must not differ by weekday/symbol/round number by more than noise), oracle ceiling and share of ceiling captured, bootstrap over items. Dataset: soften the planted edge to something probabilistic (e.g. 65/35 rather than 100/5) so the oracle is not trivially perfect; raise n to ≥ 1,000 or report CIs prominently; remove the echo; supply or remove news evidence; sign the MA distance; ensure the trader's setup label is consistent with the real bars; hold out a second seed.

7. **Bugs and defects seen.** Amber warning icons on informational reveal rows; "of 100" suffix on percentage-point values; wrong matrix header; grey distribution bar with link-styled legend; price-axis label collides with stop tag (`-3-stage-scored.png`); `findings` is empty so the report opens without any sentence of interpretation; "Confidence" mislabelled.

8. **Top 5 actions.**
   1. Build a "reveal" report widget: bucket win-rate columns with base line + feature-gap lollipops with staged reveal; stop abusing CheckList. [M] [shared-runtime widget, demo-only data]
   2. Add CI, AUC, oracle ceiling and extended-entry accuracy to the KPIs; fix the mixed-unit ranking. [S] [demo-only]
   3. Draw MA line, close-location gauge and the locked-outcome chip on the stage. [M] [shared CandleChart extension]
   4. Remove/repair the echo and the unanswerable NEWS_DAY option; re-record. [S] [demo-only]
   5. Regenerate with a probabilistic edge and larger n; publish the seed pair. [M] [demo-only]

---

### 153 · Execution quality (`execution-quality`)

**Scores (0–10):** Story clarity 5 · Item stage 2 · Answers-to-decision legibility 4 · Report and charts 4 · Presenter readiness 2 · Evaluation rigour 4 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "Rank a day's fills by damage and name why each one slipped, without anyone computing a basis point — the 65 worst-graded fills all really cost money." First paint: an MSFT chart with a "Decision" flag and ten bars after it. No intended price, no fill, no slippage. The item title says "$52K", which is size, not cost.

2. **Item stage review.** The chart carries **neither of the two prices the demo is about** (`execution-quality-3-stage-scored.png`); `item.chart` has no `trade` and no level data.
   - Needed: a zoomed chart of ~6 bars around the signal with (a) a horizontal "intended 288.76" level from the signal bar, (b) a fill marker at the fill bar/price, (c) a filled **slippage bracket** between the two labelled in bps and dollars ("+136 bps · $234K"), (d) for gap fills, the overnight gap shaded between prior close and open so the intended level is visibly *inside the gap* (the PRP's first video beat), (e) for chase fills, bar-count ticks "signal … +4 bars".
   - Fact strip: Order type · Session (open/middle/close) · Bars late · Size · **% of ADV** (the only evidence for SIZE) · Slippage bps · Slippage $.
   - Rename "Decision" to "Signal". Hide the ten post-signal bars behind the fill bar unless they matter; today they dominate the picture.

3. **Answers and evaluation strip.**
   - `cause` is well-formed. `fix` is graded against a rigid one-to-one key (`RIGHT_FIX`, `demo.js:141`) that is debatable: every GAP fill is a market-on-open order one bar after the signal, so "send the order earlier" (chosen 38/40) is a defensible fix; every SPREAD fill got "limit order" (30/30), which also genuinely fixes spread cost. The headline "fix matches cause 37 of 130" is therefore mostly a disagreement with the answer key. Allow a set of acceptable fixes per cause.
   - **`SMALLER_SIZE` and `AVOID_SESSION` are never chosen** (0 of 260). Two of five options are dead.
   - Internal incoherence not reported: 56 of 130 fills called `CLEAN` were still given the fix `LIMIT_ORDER`, and 76 of 130 clean fills were called "avoidable". A coherence check (cause CLEAN ⇒ fix NONE ⇒ not avoidable) belongs in the report.
   - `worth_chasing` is asked on all 260 fills but is only meaningful on the 35 chased ones; 26 yes answers all fall on non-chase fills. Make it conditional or drop it; the finding "0 of the 35 chased fills were judged worth having" is rendered as an info finding with no ground truth to judge it by.
   - `avoidable` is yes on 130/130 costly fills including all 40 gaps — by the question's own "no" criterion ("the market moved and no order would have done better") gaps are the one unavoidable class. Uncalibrated.
   - Verdict card: `Cost 136 bps · $234K` / `Cause called GAP — planted SIZE ✗` / `Fix: earlier order (acceptable for: chase, gap)` / `Grade 1.2/6`.

4. **Report, charts and metrics.**
   - **Dollar-weighted attribution is 23%.** Of $2.83M total slippage, $2.61M (92%) sits in the 25 SIZE fills, of which 4 are recognised. Count-based accuracy is 217/260 = 83.5% (87/130 = 67% on costly fills), but only $0.65M of $2.83M is attributed to the right cause (recomputed). The headline KPI "Slippage paid $3M" sits beside "Cause named exactly 217 of 260" without connecting them.
   - Consequently the "Worth opening" list (sorted by dollars) is ten SIZE fills, eight of them misattributed to gap/chase — the list showcases the failure. The notes admit SIZE is unsupportable (0.02–1.1% of ADV); the demo should either drop the class or use thin instruments. As built, a **class the state cannot support owns 92% of the money**.
   - Grade quality is really arithmetic: Spearman between grade and bps is −0.94; clean fills are 0–9 bps and the cheapest costly fill is 15 bps, so the "65 of 65" KPI is guaranteed by the generator's gap between classes. Show grade-vs-bps as a scatter and add borderline fills (8–20 bps) to make it meaningful.
   - **Leakage / rules baseline:** `order_type = MARKET_ON_OPEN` ⇔ GAP for 40/40; `session ∈ {open, close}` ∧ MARKET ⇔ SPREAD; `bars ≥ 2` ⇔ CHASE; ADV% separates SIZE. A four-line rule scores 260/260. The model still misses 21 of 40 gaps, calling them chase because `bars_between_signal_and_fill = 1`. Report the baseline.
   - Contradictory copy: the check says clean fills are "within a basis point" (`demo.js:155`), notes say 0–9 bps; the KPI context says 252 fills were worse than the signal price, i.e. 122 "clean" fills also paid.
   - "$3M" via compact notation hides $2,827,402; KPI "65 really cost something" breaks mid-word ("somethi/ng") in `-6-report.png`.
   - Missing versus spec: slippage by cause, by session/hour and by instrument; "fixes ranked by money saved" summing to avoidable cost. These are the practitioner's actual report.
   - Charts that fit: (a) **stacked slippage waterfall by cause** in dollars, planted vs called side by side — shows the $2.6M of size cost being filed under gap/chase; (b) scatter x = slippage bps (log), y = grade, colour = planted cause; (c) heat table instrument × session in bps; (d) "fix ledger": one bar per fix with dollars it would have saved.

5. **Bespoke Present screen.**
   - Beat 1 — "Where a fill should be": FL-0001 (MSFT, 0 bps) — intended line and fill dot coincide; grade 5.2/6, cause clean.
   - Beat 2 — "The gap": **FL-0258** (NVDA buy, market-on-open, 630 bps, grade 0.7) — shaded overnight gap with the intended level inside it.
   - Beat 3 — "The chase": **FL-0063** (XLE, four bars late, 148 bps, grade 1.4) — bar ticks between signal and fill.
   - Beat 4 — "The honest miss": **FL-0169** (WMT, $17.2M, 0.78% of ADV, 136 bps, $234K, called gap, planted size) with the ADV gauge showing why nothing in the record says "too big".
   - Close: the grade sorted 260 fills with **65 of 65** worst truly costly — then the counterweight "but only 23% of the dollars were filed under the right cause".

6. **Re-runnable model test.** Record: cause accuracy (count-weighted and dollar-weighted), per-cause precision/recall, clean false-cause rate (gate 0–2/130), fix acceptability rate with a many-to-one key, answer-coherence rate, Spearman grade vs bps, precision@k of grade ranking, dead-option count, rules-baseline score, deltas vs previous run. Dataset: real thin-instrument candles for SIZE (≥ 5–20% ADV) or remove the class; borderline-cost fills; gap fills with 0 and 1 bars, chase fills with 1 bar to break the bars⇔cause identity; limit orders that slipped; mixed causes with a primary; size dollars normalised so one class does not own 92% of the money.

7. **Bugs and defects seen.** No intended/fill markers (`-3-stage-scored.png`); "Decision" mislabel; KPI mid-word wrap (`-6-report.png`); cost shown as bare "0" and "2" without units in the strip ("Cost Usd 2", `-5-evaluation.png`); `bps()` helper at `demo.js:12` is defined with inverted sign logic and unused; clean-fill definition contradicts data; info findings rendered for a neutral statistic.

8. **Top 5 actions.**
   1. Draw intended level, fill marker, slippage bracket and gap shading; zoom the window. [M] [shared CandleChart + demo data]
   2. Add dollar-weighted attribution, slippage-by-cause waterfall (planted vs called) and the fix ledger. [M] [demo-only + one widget]
   3. Resolve SIZE: thin instruments or remove; rebalance dollars. [M] [demo-only]
   4. Replace the rigid fix key with acceptable sets; add coherence check; make `worth_chasing` conditional; tighten `avoidable`. Re-record. [S] [demo-only]
   5. Add borderline fills and break field⇔label identities; show the rules baseline. [M] [demo-only]

---

### 154 · Trader behaviour (`trader-behaviour`)

**Scores (0–10):** Story clarity 7 · Item stage 6 · Answers-to-decision legibility 5 · Report and charts 6 · Presenter readiness 3 · Evaluation rigour 4 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "Four habits cost this trader $22,680 in six months — without them a −$16.8K half-year would have been about +$5.9K — and a big losing day on its own is never called a habit." First paint opens on TB-001, a three-trade, +$187 disciplined day: the least interesting item in the set. The stage is the most bespoke in the domain, but the first item tells no story.

2. **Item stage review.** `SessionCurveView` is a real session view (equity line, size-scaled markers, trade table) and is the best stage here. Gaps:
   - **Timezone bug:** `SessionCurveView.jsx:2` formats `enteredAt` with `toLocaleTimeString` and no `timeZone`, so New York timestamps (`09:35-05:00`) render in the viewer's zone — the screenshot shows US equity trades at "4:35 PM–5:06 PM" (`trader-behaviour-3-stage-scored.png`). Format in `America/New_York` and say "ET".
   - X-axis is trade *sequence*, which hides the defining feature of revenge trading: minutes. Use a time axis 09:30–16:00 so a loss at 10:52 and triple size at 10:58 sit visibly close together.
   - Marker radius is clamped `min(8, 3 + size/median)` so 1× = 4px and 3× = 6px: tripled size is barely visible. Replace with a **size bar lane** under the equity line: one bar per trade, height = size ÷ 30-day median, a dashed line at 1×, red fill above 1.5×, and the ratio printed ("2.7×").
   - Norm comparisons belong in the facts row as *this day vs norm*: "Trades 5 vs 3.9", "Max size 2.7× median", "Shortest winner hold 12m vs 42m norm", not just the norms.
   - Table: add a "× norm" column; colour Result; tint rows where `minutesAfterPreviousExit ≤ 10` after a loss; "At normal hold" should read "+$X left on the table".
   - Day result should be in the title tone (profit/loss) and the prior-day result signed.

3. **Answers and evaluation strip.**
   - `pattern` options are crisp and mirror the generator exactly — which is the problem (see 4).
   - **`stop_trading_advised` is dead: 0 of 120 yes**, maximum probability 0.49, even on averaging-down days at severity 3.9 and revenge days that lost over $1,000. The question either needs a stated process rule in the state ("stop after two consecutive losses at >1.5× size") or removal. A KPI tile is spent on displaying "0".
   - `triggered_by_loss` (11/11 revenge, 6/6 averaging down, 0 elsewhere) and `size_discipline` (0/17 on those, 96/96 elsewhere) are perfectly redundant with each other and with `pattern` on this dataset.
   - `severity` is never compared with the computed cost; `labels.costEstimate` exists but is unused. Correlate them.
   - Verdict card: `REVENGE (99%) ✓ agrees with planted` / `Cost of the habit today: $571 of a −$1,553 day` / `Trigger: −$325 at 10:52 → 3.2× size at 10:58` / `Stop for the day: no (0.45)`.

4. **Report, charts and metrics.**
   - 116/120 = 96.7% is inflated by an easy majority: 87 disciplined days. On the 33 habit days recall is 29/33 = 88%; always-"disciplined" scores 72.5%. **Planted features are perfectly separable** (recomputed): max size ÷ norm is 2.5–3.2 on revenge, exactly 2.05 on averaging down, ≤ 1.18 everywhere else; trade count ÷ norm is 2.9–3.3 on overtrading, ≤ 1.35 elsewhere; `additional_profit_available_at_normal_hold_usd` is non-zero on the 7 early-exit days and **zero on all 113 others** — a label leak sitting in the state. A four-threshold rule scores 120/120.
   - The 8 "good-but-lossy" controls lose only $343–$442 on a $100K account (0.4%) — not the "big loss" the PRP describes; a 0/8 false-alarm rate on such mild controls proves little. Make them −$1,500 to −$3,000 days with normal sizing.
   - The only real confusion — averaging down read as revenge on 4 of 6 (TB-097: probabilities 0.46 vs 0.45) — is a genuine taxonomy overlap: same-symbol, same-side adds after losses with rising size fit both definitions. Worth a finding sentence; `findings` is currently empty.
   - KPI tone: "116 of 120" is shown as *warn* because it is not perfect (`demo.js:72`); unhelpful.
   - **SizeScatter is unreadable** (`trader-behaviour-6-report.png`): x = the day's rolling median, which only ranges ~$4.5–4.9K, on an axis from zero, so 594 points collapse into a single vertical stripe. Replace with x = date, y = size ÷ norm (log), reference line at 1×, flagged days coloured.
   - EquityCurve is good and is the right hero chart; it needs y-axis values, month ticks, colour by pattern (not one amber), and a **counterfactual "without the four habits" line** ending about $22.7K higher — that gap is the story.
   - CostBars is right; add cost per day and the model's recall beside each habit; all bars are one crimson — colour by habit consistently with the equity markers.
   - Missing: per-habit precision/recall table, severity-vs-cost scatter, calibration.
   - `demo.js:2` imports `estimateHabitCost` from `scripts/generate/trader-behaviour.js`, pulling generator code (and whatever it imports) into the browser bundle; move the cost function to a shared lib.

5. **Bespoke Present screen.**
   - Beat 1 — six-month equity curve draws itself, ending down $16.8K; caption "What happened here?"
   - Beat 2 — **TB-026** revenge day on a time axis: NVDA −$182, −$325, then 6 minutes later $12.3K size (3.2× norm) −$571, then $10.3K AAPL 9 minutes after that −$301. Size lane turns red; verdict "Revenge · triggered by loss".
   - Beat 3 — **TB-053** (−$442, worst control): normal count, normal size, normal holds → "Disciplined. A loss is not a habit."
   - Beat 4 — habit cost bars: overtrading $8,681 · revenge $5,167 · early exit $4,671 · averaging down $4,161; flagged dots light up on the curve and the counterfactual line lifts away.
   - Close: **$22,680** — "the difference between −$16.8K and +$5.9K".

6. **Re-runnable model test.** Record: habit-day recall and precision per pattern, macro-F1, control false-alarm rate (gate 0/8 with *severe* controls), severity–cost Spearman, stop-advice rate against a rule-derived label, revenge↔averaging-down confusion count, rules-baseline score, drift vs prior run. Dataset: remove or blur `missedAtNormHoldUsd` (give it to all winners with realistic non-zero values); overlap the distributions (revenge at 1.4–2×, busy-but-fine days at 2× count, single oversized trade without a preceding loss); mixed-habit days with a primary; several traders with different norms; raise habit days to ~40% of 300; severe lossy controls; second seed.

7. **Bugs and defects seen.** Times in the viewer's timezone (`-3-stage-scored.png`); size scatter collapsed to a stripe (`-6-report.png`); equity chart without y ticks; trade ids repeat the date ("2026-01-05-T01") and eat a column; KPI "Stop-day recommendations 0" is a dead tile; "116 of 120" amber; distribution bar all grey; generator imported into the client (`demo.js:2`).

8. **Top 5 actions.**
   1. Fix the timezone; move to a time axis with a size-vs-norm lane; add "× norm" and trigger highlighting. [M] [demo-only view]
   2. Add the counterfactual equity line and pattern-coloured markers; replace the scatter with size-ratio-over-time. [M] [shared widgets used only here]
   3. Remove the early-exit leak, overlap the planted distributions, strengthen the controls; show the rules baseline; re-record. [M] [demo-only]
   4. Give `stop_trading_advised` a written rule and a derived label, or drop it; correlate severity with cost. [S] [demo-only]
   5. Default the first item to a hero day (TB-026) and move the cost function out of `scripts/`. [S] [demo-only]

---

### 155 · Journal versus reality (`journal-vs-reality`)

**Scores (0–10):** Story clarity 7 · Item stage 1 · Answers-to-decision legibility 4 · Report and charts 4 · Presenter readiness 1 · Evaluation rigour 3 · Re-run/benchmark readiness 3

1. **The one-sentence value.** "What you wrote against what you did: all 74 notes that misdescribe their trade were caught." The concept is the most emotionally legible in the domain and needs no finance knowledge. First paint is a fifteen-row key/value table in which the journal note — the hero — is the **last row**, in the same 15px type as "Id" (`journal-vs-reality-3-stage-scored.png`, and identically in `-7-present.png`).

2. **Item stage review.** `view: 'table'` (`demo.js:217`), against a PRP that says "keep the side-by-side layout tight and readable". This is the largest gap between intent and delivery in the domain. Build a `journal` view:
   - **Left — the notebook page:** the note in a serif or handwriting-adjacent face at ~22px on a paper-toned card, dated, with "written the same evening" as a small stamp. Claim phrases are highlighted as chips: "Small starter position", "in at 469.41", "Out at 450.63".
   - **Right — the blotter:** a broker-style ticket: JPM · breakout · filled "at the level in the plan" · 469.41 → 450.63 · stop hit · **$40,000 = FULL position** · −4%.
   - **Between them — connectors:** each claim chip links to the matching record field; green tick where they agree (entry price, exit price), red strike where they do not ("small starter" ↔ "$40,000 · full (4× a starter)"). After scoring, the model's `drift_type` lights the contradicted pair.
   - **Below — the trader's four rules** as a checklist, with the broken one struck.
   - Hide `id`; format `resultPercent` as "−4.0%"; format size as "$40,000 (full)"; fold `filledAt` into an "Entry" sentence.
   - Data realism: prices are invented on real tickers (JPM 469, JNJ 405, GLD 131 in 2026) and results are whole percentages; either use fictional tickers or plausible levels.

3. **Answers and evaluation strip.**
   - `note_matches_trade` + `drift_type` are the right pair, but they **disagree with each other on 30 items** (matches = yes while a drift is named), and the report hides it: honest notes "doubted" are counted only through the yes/no (13/126) while the choice question names a drift on **43 of 126 honest notes** (24 exit, 18 rationalisation, 1 entry). Precision of the EXIT call is 14/47 = 30%; of RATIONALISATION 0/18.
   - **`written_after_the_fact` is close to all-yes: 134 of 200**, including 85 of 126 honest notes whose state says `note_written: "the same evening"`. The KPI "Written after the outcome 9 of 9" is recall only; precision is 9/134 = 6.7%. JR-0001, the first item, is a same-evening note flagged as after-the-fact. This is the most misleading tile in the domain.
   - Conversely the 9 rationalisations are the only items with `note_written: "two days later"` — a pure field-level leak — and the model still never names RATIONALISATION for them (0/9) while naming it 18 times for honest notes.
   - `rule_followed` has no label; 56/126 on honest notes. Several "honest" notes describe rule breaks (JR-0010: "Sized full because the stop is wide" breaks rule 1), so a label is derivable — derive it and grade it.
   - Strip: "Matches: No" with a green tick, "Rule Followed: No" green tick, "After The Fact: Yes" amber (`-5-evaluation.png`) — polarity wrong on all three.
   - Verdict card: `The note does not match the record ✓ (planted: SIZE drift)` / `Says "small starter" — record: $40,000, a full position, 4× a starter` / `Honesty 2.0/6 · Rule 1 broken`.

4. **Report, charts and metrics.**
   - Headline should be a proper detection table: recall 74/74 = 100%, **precision 74/87 = 85%**, false-doubt rate 13/126 = 10.3%, F1 0.92; then drift-type accuracy 65/74 on drifting notes and **148/200 = 74% over all notes** including the 43 honest notes given a type. The report shows only the flattering halves.
   - Coverage by honesty score (from the dump): ≤ 1 → 19 reviewed / 19 real; ≤ 2 → 56 / 53; ≤ 3 → 92 / 74 (all drift caught at 80% precision). That is a usable operating curve; give it ticks and a threshold marker.
   - "Drift among losing trades 35.5% (33 of 93)" is presented as a finding-like KPI but the base rate is 74/200 = 37% — there is **no clustering**; the tile needs the baseline or should go. The PRP's "drift clusters after the worst drawdown" beat is not in the data: monthly drift share is flat (7/17, 10/19, 12/35, 10/22, 6/28, 10/27, 10/25, 9/27).
   - **Template leakage:** all 18 ENTRY-drift notes are one sentence template; SIZE 6, EXIT 6, INSTRUMENT 5, RATIONALISATION 4 templates, against 57 for honest notes. Record fields are prose that states the contradiction outright ("the breakout, without waiting"; "closed by hand well before the target"). A keyword matcher would reach near 100%. The PRP's contract test (grep for planted phrases) should be extended to template diversity.
   - Charts that fit: (a) drift-type bars with precision and recall paired per type; (b) a calendar strip / timeline of the year with drifting notes marked and the equity curve beneath, if clustering is actually planted; (c) honesty-score histogram split honest vs drifting (two overlaid distributions — currently means 3.6 vs 0.7–2.1, a nice separation never drawn); (d) "side-by-side worst ten" cards showing both texts, as the PRP asked, instead of a link list.

5. **Bespoke Present screen.**
   - Beat 1 — the notebook page alone: **JR-0008** "Waited for the pullback on MSFT… Patience paid, no chasing today."
   - Beat 2 — the blotter slides in: "Filled at the breakout, without waiting · stopped out −3%". "Waited for the pullback" is struck through; rule 2 ("I do not chase") breaks.
   - Beat 3 — **JR-0001** size drift: "Small starter position" ↔ $40,000 full position.
   - Beat 4 — **JR-0023** rationalisation: stamp "written two days later" pulses; after-the-fact = yes; honest caption that the drift was filed under "exit".
   - Beat 5 — the cost side: **JR-0010**, an honest note doubted (0.41), with "13 of 126 honest notes questioned".
   - Close: **74 of 74** drifting notes caught, with "at 85% precision" beneath.

6. **Re-runnable model test.** Record: detection precision/recall/F1, false-doubt rate (gate ≤ 5%), drift-type accuracy over all 200, per-type precision/recall, after-the-fact precision and recall (gate precision ≥ 50%), answer-coherence rate between the two questions, rule-followed accuracy against a derived label, honesty-score AUC, drift vs previous run. Dataset: ≥ 10 paraphrase templates per drift type, generated with varied voice; numeric record fields instead of prose verdicts (fill price vs breakout level vs pullback level; timestamps instead of "two days later"); subtle drifts (half called starter; exit 0.5R short called "near target"); honest notes that mention post-hoc-sounding words; multi-drift notes; after-the-fact independent of drift type; plausible prices.

7. **Bugs and defects seen.** Raw key dump as the stage, note last (`-3`, `-7`); numbers right-aligned far from labels across a 1,100px row; "Size Usd 40,000" no currency; "Result Percent −4" no unit; item title "JR-0001 · JPM · full · -4%" is cryptic; badge polarity (`-5`); legend link styling; matrix last row ("None: 1 · 24 · 18 · 83") is the key result and is squeezed to one line by the broken layout (`-6-report.png`).

8. **Top 5 actions.**
   1. Build the two-pane journal view with claim chips, connectors and rule checklist. [L] [demo-only view; reusable for other text-vs-record demos]
   2. Report precision alongside recall everywhere; replace "9 of 9" with a precision/recall pair; add the coherence check and all-notes drift accuracy. [S] [demo-only]
   3. Fix `written_after_the_fact` (criteria anchored to the timestamp and to knowledge of later prices) and re-record; derive and grade `rule_followed`. [S] [demo-only]
   4. Regenerate with diverse templates, numeric record fields and subtle drifts; plant real post-drawdown clustering if the beat is wanted. [M] [demo-only]
   5. Replace "Worth opening" with side-by-side note/record cards for the ten least accurate notes. [M] [shared-runtime option]

---

### 156 · Missed trades (`missed-trades`)

**Scores (0–10):** Story clarity 6 · Item stage 3 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 2 · Evaluation rigour 3 · Re-run/benchmark readiness 3

1. **The one-sentence value.** "Your own rule fired 240 times; you skipped 130 — the 100 skips with no good reason made more than the 110 trades you took ($10.7K vs $5.4K)." First paint: a PG chart ending at a "Decision" flag with the title "MT-001 · PG · 2023-11-20 · not taken". It hints at the idea but shows no rule, no account state, no calendar, and the first item happens to be a *justified* skip.

2. **Item stage review.** The chart shows candles only (`missed-trades-3-stage-scored.png`). The rule is a 20-day-MA pullback and the MA is not drawn.
   - Draw the rising 20-day MA, the ±1% touch band, and mark the setup bar "Rule fired" (not "Decision").
   - **Rule checklist** beside the chart: ✓ rising average · ✓ touched within 1% · ✓ held pullback floor · ✓ ordinary range (the four `conditions`), with the rule function one click away (the PRP calls it the best code moment in the series).
   - **Context chips** — the actual evidence for the skip reason: "Monday" · "Last three: −$143 −$134 +$83" · "Open risk 1.07% of 2.0%" (as a gauge) · "Earnings tomorrow" (calendar icon) · "Gap −0.57%" · "Trades today: 2".
   - **Trade-log stamp:** TAKEN / NOT TAKEN.
   - After scoring, and only then, reveal the next ten real sessions greyed to the right of the setup bar with the outcome ("−2.34% · −$234 avoided"), mirroring how `InsiderCandlesView` already gates its outcome window (`CandlesView.jsx:13,47`). `LabCandlesView` has no such mechanism; labels would need to carry the forward bars.

3. **Answers and evaluation strip.**
   - **`qualified` has no negative class**: every item comes from the rule and all four `conditions` are `true` in the state. 240/240 is an echo, and it occupies a KPI tile. Add near-miss bars that fail one condition (or withhold `rule_conditions` and make the model check the bars).
   - **`rule_needs_clarifying` is all-yes: 230 of 240.** The only cases that expose ambiguity are the ten gap skips. It is presented in the check list with an amber icon and "230 of 240" — the most visibly broken number in the report. The risk-policy sentence in the state ("…until the written rule clarifies gaps") primes it on every item.
   - `skip_reason`: `NOT_SKIPPED` is echoed from `trade_log.setupWasTaken` (110/110). For the 100 avoidable misses there is **no ground-truth reason at all** (labels carry `goodReason` only for the 30 justified skips), and `account.recentState: "AFTER_LOSSES"` is sent in the state as an enum, so RECENT_LOSSES is a lookup. Remove the enum from the state; label intended reasons.
   - `setup_quality` has no signal: mean 4.30 on setups that went on to gain vs 4.31 on those that lost (recomputed). Unreported. Fine to be honest about — say it.
   - `should_have_been_taken`: yes on 100/100 avoidable and 110/110 taken; the only variance is on the 30 justified skips, so this is effectively a 30-item test.
   - Verdict card: `Qualified ✓ · Not taken · Reason: earnings tomorrow · Skip honoured ✓ (planted: good reason)` / `Next ten sessions: −2.34% (−$234 avoided)`.

4. **Report, charts and metrics.**
   - **Label/policy contradiction — the headline accuracy number is wrong.** The state's policy says a bar "with a gap above 2.5% may be skipped" (`scripts/generate/missed-trades.js:40`), but the ten `GAP_RULE_SPIRIT` good-reason labels are simply the ten largest gaps (`:83`), which range from **1.73% to 2.42% — none exceeds 2.5%**. The model said "should take" on 9 of those 10, which is correct under the written policy. "Good-reason skips honoured 21 of 30 (70%)" should be read as 20/20 on earnings and risk limit, and 9–10 correct out of 10 on gaps. Lower the threshold in the policy text or pick gaps above it, then re-record.
   - **Headline KPI overstates cost.** "Avoidable miss cost $23,260" sums positive outcomes only; the same report's comparison table shows the net of the same 100 setups as **$10,732** (40 of them lost a combined $12,528). Lead with the net, show gross as context, and show the honest comparison: avoidable misses averaged +1.07% with 60% positive vs +0.49% and 49% for taken trades.
   - **Planted pattern is a caricature:** miss rate is exactly 100.0% on Mondays (52/52) and 100.0% after losses (88/88) vs 41.5% / 27.6% otherwise. The PRP says "cluster"; this is deterministic, and the two findings read as bugs. Aim for ~70% vs ~35%.
   - No confusion matrix, no curve, no agreement metric at all — the report is descriptive statistics of the *labels* (weekday table, outcome table), to which the model contributes nothing. The only model-graded number is the 21/30. The model's contribution needs to be explicit: reason attribution accuracy against planted reasons; honoured-skip precision/recall; near-miss qualification accuracy.
   - BreakdownTable and ComparisonTable render cleanly (the two best-looking tables in the domain), but the "Missed outcome" column mixes justified and avoidable misses without saying so.
   - Charts that fit: (a) **paired cumulative P&L lines** over three years — "trades you took" vs "setups you skipped without a reason" — ending at $5.4K and $10.7K; (b) weekday × recent-state heat grid of miss rate; (c) diverging bars of ten-session outcomes for each avoidable miss, sorted, so the 40 losers are visible next to the 60 winners; (d) reason attribution matrix once labelled.

5. **Bespoke Present screen.**
   - Beat 1 — "The rule": the under-30-line rule function beside one chart with MA, band and four ticks. "It fired 240 times in three years."
   - Beat 2 — "A skip that should not have happened": **MT-225** (JNJ, Monday 22 Jun 2026, last three −$301 −$156 +$65, nothing on the calendar, risk available). Verdict "should have been taken — recent losses". Reveal: next ten sessions +15.54%, $1,554.
   - Beat 3 — "A skip that was right": **MT-001** (PG, earnings next day). Verdict "honour the skip"; reveal −2.34%.
   - Beat 4 — "The pattern": weekday × loss-state grid fills in; Monday-after-losses cell glows.
   - Beat 5 — the two cumulative lines draw. Close on **$10,732 vs $5,432** — "the setups skipped for no reason earned twice what the taken ones did."

6. **Re-runnable model test.** Record: honoured-skip accuracy per reason (earnings / risk / gap) with policy-consistent labels, avoidable-miss "should take" rate, reason attribution accuracy vs planted reasons, qualification accuracy on a near-miss set (gate ≥ 95%), all-yes detector on `rule_needs_clarifying` (gate: yes-rate within ±10 pts of the true ambiguous share), setup-quality AUC vs outcome (reported, not gated), deltas vs prior run. Money figures are properties of the dataset, not of the model — keep them on the card as context only. Dataset: near-miss negatives; gaps straddling the stated threshold; remove `recentState` enum; probabilistic clustering; label intended reasons for all 130 skips; include cases with two valid reasons; risk at 1.9% vs 2.0% borderlines; a second seed for the trade log over the same real candles.

7. **Bugs and defects seen.** "Rule clarification recommended 230 of 240" with warning icon and a wall of ids (`-6-report.png`); findings "Miss rate was 100.0%" ×2; KPI "240 of 240" wraps; headline KPI contradicts the table beneath it; distribution bar all grey with link-styled legend; "Decision" flag on a bar where, for 130 items, no decision was taken; no MA on a moving-average demo (`-3-stage-scored.png`); "Worth opening" labels say "take · Recent losses" without the outcome percentage or date.

8. **Top 5 actions.**
   1. Reconcile the gap threshold between policy text and labels; re-record; restate the honoured-skip KPI per reason. [S] [demo-only]
   2. Lead with net ($10,732) not positive-only ($23,260); add the paired cumulative P&L chart. [M] [demo-only + one line-chart widget]
   3. Stage: MA + band, rule checklist, context chips, post-score outcome reveal. [M] [shared CandleChart extension + demo view wrapper]
   4. Add near-miss negatives, remove `recentState`, label reasons, soften the 100% clustering. [M] [demo-only]
   5. Suppress or reframe all-yes answers (`qualified`, `rule_needs_clarifying`) with an automatic "no variance" notice. [S] [shared-runtime]

---

## Domain summary

**Cross-demo patterns**

1. **The stage never shows the thing the demo is about.** Four demos share the lab candle chart and three of them pass it nothing but bars: 151 has no plan levels (the component supports them; the data omits `chart.trade`), 153 has no intended price or fill, 156 has no moving average, rule or context. All four label the marker "Decision" regardless of whether it is an entry, a signal or a skipped setup. 155 falls back to a key/value dump with the journal note as the last row. Only 154 has a bespoke stage, and it has a timezone bug and an under-scaled size encoding. One investment — an annotation layer on `CandleChart` (levels, pins, brackets, shaded bands, MA line, gated outcome window) driven by a declarative `chart.annotations` array — fixes 151, 152, 153 and 156 together.
2. **Every classification task here is solvable by a handful of thresholds on fields already in the state**, and none of the reports shows that baseline: 151 rules = 220/220 (model 198), 153 = 260/260 (model 217), 154 = 120/120 (model 116), 152 extended-entry rule = 300/300 (model 210). Several fields are outright leaks: `exitReason: "closed by hand, no reason recorded"`, `filledAt: "the breakout, without waiting"`, `noteWrittenAt: "two days later"`, `recentState: "AFTER_LOSSES"`, `missedAtNormHoldUsd` non-zero only on early-exit days, `order_type: MARKET_ON_OPEN` ⇔ gap. A regression harness built on these sets measures whether the model still reads obvious fields, not judgement. Overlapping distributions and a printed rules baseline are prerequisites for the "re-run it again and again" pitch.
3. **Label and instruction defects that currently charge the model for the dataset's mistakes:** 151 `planComplete:false` on 28 complete plans, a "twenty-sixth bar" instruction pointing at the wrong bar, and 54 items with a post-exit bar in the state; 156 gap good-reason labels that sit *below* the policy's own 2.5% threshold; 153 a SIZE class the notes admit the state cannot support yet which holds 92% of the dollars; 153 a one-to-one fix key that rejects defensible fixes.
4. **Dead, echo and all-yes questions are common and unflagged:** 152 `setup_type` (300/300 echo), 152 `NEWS_DAY` never chosen, 153 `SMALLER_SIZE`/`AVOID_SESSION` never chosen, 154 `stop_trading_advised` 0/120, 155 `written_after_the_fact` 134/200 yes, 156 `qualified` 240/240 and `rule_needs_clarifying` 230/240. A shared "answer variance" check in the report (flag any option never chosen, any yes-rate above 90% or below 10% without a matching label rate) would surface these automatically.
5. **Recall is reported, precision is not.** "90 of 90 left alone" (but 22 faults also called clean), "74 of 74 caught" (precision 85%), "9 of 9 written after the fact" (precision 6.7%), "130 of 130 clean". Cross-question coherence is never checked (153: CLEAN with a fix on 56 items; 155: matches-yes with a drift named on 30).
6. **Money is either absent or mis-framed.** 151 has no dollar figure at all; 153's dollars are dominated by one broken class; 156 headlines a positive-only sum that its own table contradicts. 154 is the only demo whose money number ($22,680) is sound, derived from the trades and tied to a visible chart.
7. **The first item is rarely the right first item.** 151 opens on a miss that looks like a hit, 154 on a dull +$187 day, 156 on a justified skip, 153 on a zero-bps fill. Each demo should name a `heroItem`.

**Numbers to treat with suspicion:** 151 plan-completeness 87.3% (label error); 152 +11.2-point lift (z ≈ 1.66, AUC 0.60, oracle = 100%); 153 "fix matches 37 of 130" (answer key) and "$3M" (92% from an unsupportable class; 23% dollar-weighted attribution); 154 96.7% (72.5% majority baseline, 100% rules baseline, controls lose only 0.4%); 155 "9 of 9" (precision 6.7%) and "13 of 126 doubted" (43 of 126 given a drift type); 156 "$23,260" (net $10,732), "21 of 30" (9 disputed labels contradict the policy), 100.0% miss rates, 230/240 clarifications.

**Flagship for the homepage: 154 · Trader behaviour.** It is the only demo in the domain with a bespoke stage, report widgets that already render (cost bars, six-month equity curve with flagged days), a headline in real dollars computed from the data rather than from the model, a human story that needs no market knowledge ("a loss is not a habit"), and a control group that makes the evaluation argument in one sentence. Its defects are cheap: a timezone fix, a time axis with a size-versus-norm lane, a counterfactual equity line, and a harder dataset. Runner-up is 155, which has the stronger emotional hook but needs a full view built before it can be shown. 151 should be third once the overlay exists — "4.7 on winners, 4.6 on losers" is the best single evaluation line in the domain.

**Signature visual for the domain: the annotated trade tape.** One horizontal time axis carrying price (or session equity) with a consistent annotation grammar used by every demo: a solid pin for *what was intended* (signal, plan level, rule fired, note claim), a hollow pin for *what actually happened* (fill, exit, skip, record), and a filled bracket between them labelled with the gap in the demo's own unit — R, basis points, dollars, minutes, or a struck-through phrase. Plan vs execution (151), signal vs fill (153), norm vs today (154), note vs record (155), rule vs log (156), entry read vs revealed outcome (152): the domain is six versions of "intended versus actual", and the bracket between the two pins is the picture that says so.
