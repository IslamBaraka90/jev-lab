# Domain 9 · Strategy research — demo-by-demo review

Demos: 181 golden-cross-review · 182 setup-timing · 183 regime-classification · 184 overfit-review · 185 strategy-correlation.

Method: read each `demo.js`, `notes.md`, the generator where relevant, the computed report dump, the screenshots, and re-derived a number of statistics directly from `data.json` + `fixtures.json`. Global findings 1–10 from the brief are assumed fixed and are not repeated except where they interact with something specific here.

The domain is unusual: three of the five demos have no labels and grade against realised forward returns. That makes two things matter more than anywhere else in the suite: (a) whether anything after the decision point reaches the model **or the gate that applies its answer**, and (b) whether the report's sentences are supported by the sample. On (a) there is one real look-ahead defect (183) and one label-by-shape leak (184). On (b) almost every headline sentence in 181–183 is a statement about noise.

---

### 181 · Golden cross review (`golden-cross-review`)

**Scores (0–10):** Story clarity 7 · Item stage 5 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 3 · Evaluation rigour 4 · Re-run/benchmark readiness 4

**1. The one-sentence value.** "The rule finds the cross; the model decides whether *this* cross deserves the trade — and the next twenty sessions say who was right." The first paint half-lands it: the title line is good and a candle chart is on screen (`golden-cross-review-1-landing.png`). But two things undercut it immediately: the chart has **no 50-day or 200-day average drawn**, so a "golden cross" demo shows no cross; and the 20 outcome bars are **already visible to the right of the "Decision" line before anything is run**, so the reveal that the whole page depends on is spoiled at 0 answered.

**2. Item stage review.**
- `LabCandlesView` passes `revealed={candles.length - markIndex}` unconditionally (`web/src/demo/views/CandlesView.jsx:117`), so all 20 forward bars are always drawn. The sibling `InsiderCandlesView` in the same file gates on `result` and prints "Outcome hidden until scored" (`:13`, `:68`). The lab variant needs the same gate. The model is not leaked to (state slices at `markIndex + 1`, `demo.js:41`), but the viewer is.
- Nothing the model was given is on the stage: `fastMa`, `slowMa`, `gapPercent`, both slopes, `priceAboveSlowPercent`, `sixtyDayRangePercent`, ATR %, volume vs average, `barsSinceLastCross`, and the three candidate stop levels. A trader needs exactly those.
- The chart shows 90 bars before the cross; a 200-day average cannot be recomputed from 90 bars, so the generator must ship the two MA series (or the view must be given them) to draw them.
- Bespoke stage: candle chart with the 50 (amber) and 200 (blue) lines and a ring on the crossing point; three dashed horizontal stop lines labelled "below 200d", "swing low", "2×ATR" with the chosen one solid; a right-hand "at the cross" card with six numbers formatted as a trader reads them ("Price vs 200d −1.7%", "50d slope +1.1% / 20 bars", "Gap 0.04%", "ATR 1.0%", "Volume 0.81× avg", "First cross on file"). After scoring, the outcome region slides in with an entry→exit arrow and a P&L pill ("+0.03% after 20 sessions, net of 0.1%").
- Data defect visible once stops are drawn: in **9 of 71 items `stopLevels.belowSlowMa` is at or above the entry close** (e.g. GX-0001: close 168.65, "stop" 171.50). A long stop above entry is not a stop. The model chose `BELOW_SLOW_MA` in 64 of 71 items, including these.

**3. Answers and evaluation strip.**
- Five questions, two of them redundant by the model's own behaviour: `valid_signal` and `decision` agree in 66 of 71 items, and `context` collapses to three of five options (54 established trend / 7 chop / 10 reversal risk; `POST_GAP` and `RANGE_BREAK` never used).
- `stop_placement` is malformed for skips: all 22 skips named a stop (check "stop-on-skip" 22 of 22). This is a question-design fault (acknowledged in notes), and it means the check is permanently red for a reason that is not the model's judgement. Make the stop question conditional, or drop `NONE` and grade it only on takes.
- `signal_quality` spans only 1.67–4.51 of 0–6. The "midpoint 3" threshold is therefore not the midpoint of the *used* scale.
- The strip (`golden-cross-review-5-evaluation.png`) shows "Valid ✓ No", "Take ✓ No" in green, "atr based", "0.47". After scoring it should say: **SKIP · quality 2.2/6 · called "reversal risk" → next 20 sessions +0.03% → skip cost nothing**, with a small badge "agreed with price / disagreed with price". Since there is no label, the per-item ground truth is the realised return and it is available in the item — `evaluate` just is not given it.

**4. Report, charts and metrics.**
What is right: the comparison is structurally the correct one (always-take baseline vs filtered, same bars, same cost), the threshold was not fitted, and the notes are candid.

What is statistically wrong or misleading:
- **Every sentence in the findings is about noise.** Per-trade outcome: mean +0.21%, SD 7.10%, so the standard error of the mean over 71 trades is **0.84%**. "Kept +0.10% vs all +0.21%" is a difference of 0.11 against an SE several times larger. "Score ≥ 3: +0.50% vs +0.10% … the score knew something the decision threw away" has **t ≈ 0.45** (44 trades at +0.50, 27 at −0.28).
- **The score finding is five Bitcoin trades.** BTC-USD's 5 crosses sum to **+41.75** points of the book's +14.77 total. Excluding BTC: all crosses −0.41% per trade, score ≥ 3 −0.50% (39 trades), kept −0.84% (44 trades). With BTC removed the score filter is *worse* than taking everything. The report should never print the second finding without an instrument-level breakdown; as written it is the exact error the page says it is warning about.
- The report's own curve contradicts the finding: win rate at quality ≥ 3 is 22/44 = **50.0%**, below the unfiltered 38/71 = 53.5% (`curve.points`). The average is higher only because of outliers.
- "+14.77%" is a **sum of per-trade percentages**, not a return; and the equity curve compounds 71 trades **sequentially** although they come from 16 instruments and overlap in time. Neither is a portfolio result. Either label it "sum of trade returns" or run a proper equal-weight book by date.
- KPI "What the filter was worth −10.04%" compares sums over different trade counts; the fair number is the per-trade one, which is already there as KPI 4. Lead with per-trade and a confidence interval.
- The "chop" finding reads against the model (chop +0.52% vs rest +0.17%, n = 7) and is printed without saying so.
- Real tickers and real dates are sent in the state (`instrument`, `cross_date`). A model whose training data covers 2021–2025 can *remember* what AAPL did after 2024-06-13. This is outcome leakage through memorisation and cannot be ruled out with these fixtures. Anonymise ("Instrument A", dates as bar offsets, prices rebased to 100) or at least run an anonymised variant and report both.

Right headline KPIs: per-trade edge of kept vs all with a bootstrap 95% interval; hit rate kept vs all; **random-skip baseline** (skip 22 of 71 at random, 10,000 draws — where does the model's filter fall in that distribution?); rank correlation of quality with outcome (Spearman with p-value); worst-trade avoidance (took 11 of 15 crosses that fell > 4%, skipped 6 of 18 that rose > 4% — i.e. recall of losers 27%, which is *below* the 31% skip rate: no skill).

Right charts: (i) **quality vs outcome scatter** — x quality 0–6, y 20-session return, colour take/skip, BTC marked, with a LOESS or decile mean line; this is the single honest picture. (ii) Equity curves kept, but with a grey **fan of 1,000 random-skip curves** behind them so the viewer sees the filter sits inside the fan. (iii) The "context × outcome" matrix is not a confusion matrix (header says "Planted ↓ · Called →" with nothing planted) — replace with a small table: context, n, mean outcome, hit rate, interval.
- EquityCurve has no y-axis values at all (`widgets.jsx:326-348`); a money chart with no scale.

**5. Bespoke Present screen.**
1. *"The rule is the easy part."* Full-bleed AAPL chart with 50/200 lines converging, the ring lands on 2024-06-13 (GX-0042). Caption: "71 of these in six years across 16 instruments."
2. *"Would you take this one?"* Outcome hidden. The five answers type in: real · established trend · 4.5/6 · TAKE · stop below 200d. Reveal: +9.31%.
3. *"And this one?"* GX-0001 GLD 2021-07-08: skip, 2.2/6, reversal risk → reveal +0.03%. Then a hard one the model got wrong: a taken cross that fell (GX-0009 from the "bad" check) and a skipped one that ran (BAC 2022-12-28).
4. *"All 71."* The scatter fills in dot by dot, then the two equity curves draw over the random-skip fan.
5. Closing number, stated honestly: **"Filter edge: −0.11% a trade, ± 1.7. Not distinguishable from chance — and the page says so."** The value of the demo is that the harness tells you when the model adds nothing.

**6. Re-runnable model test.** Benchmark card: n, skip rate, per-trade edge kept−all with bootstrap CI, percentile of the filter inside the random-skip distribution, Spearman(quality, outcome), Brier score of `valid_signal` against "outcome > 0", loser-avoidance recall, consistency checks (stop-on-skip, stop-above-entry chosen), all broken down by instrument and by year, and **ex-crypto**. Gates: "PASS if filter percentile ≥ 90 on ≥ 200 events; otherwise INCONCLUSIVE" — a three-state gate is essential here. Dataset changes: 71 events cannot separate models; extend history to ten years (LEFTOVERS already notes this) and widen to 50+ instruments to reach ≥ 300; anonymise instrument/date; fix the nine stop-above-entry levels; report ex-BTC or vol-normalise outcomes (return / ATR) so one asset cannot own the result.

**7. Bugs and defects.**
- Forward bars visible before scoring (`-1-landing.png`, `-7-present.png`); `CandlesView.jsx:117`.
- No moving averages, no stop levels on a moving-average demo (`-3-stage-scored.png`).
- "Valid ✓ No" and "Take ✓ No" rendered as green ticks (`-5-evaluation.png`).
- KPI values wrap mid-number: "+14.77 / %", "+22.21 / %" (`-6-report.png`).
- Matrix header "Planted ↓ · Called →" although nothing is planted.
- Equity chart has no y-axis; curve chart has no tick values.
- `stopLevels.belowSlowMa` ≥ close in 9 items (data).
- "Worth opening" sorts by model quality but shows the outcome as the value with no hint that the two are being compared.

**8. Top 5 actions.**
1. Gate the outcome bars on `result` in `LabCandlesView` and draw the 50/200 lines + stop lines. [M] [shared-runtime — also fixes 183]
2. Rewrite findings/KPIs around per-trade edge with a bootstrap interval, a random-skip baseline and an ex-BTC line; delete "the score knew something". [M] [demo-only]
3. Replace the pseudo-confusion matrix with a quality-vs-outcome scatter and a context table. [M] [demo-only + one new widget]
4. Anonymise instrument and date in `buildState` (or add an anonymised variant and publish both). [S] [demo-only, needs re-record]
5. Fix the stop question (conditional / graded on takes only) and the nine invalid stop levels in the generator. [S] [demo-only]

---

### 182 · Setup timing (`setup-timing`)

**Scores (0–10):** Story clarity 3 · Item stage 2 · Answers-to-decision legibility 3 · Report and charts 2 · Presenter readiness 1 · Evaluation rigour 3 · Re-run/benchmark readiness 3

**1. The one-sentence value.** Intended: "Does *when* a setup fires — weekday, month phase — change whether it works, and can the model tell?" What the visitor sees: a title, then a 15-row OHLC **table** of Bitcoin prices with 11-digit volumes (`setup-timing-7-present.png`). No chart, no calendar, nothing that says "timing". The report's first finding is that the question cannot be answered at all. The honest sentence the demo currently supports is "six years of daily data cannot support a weekday × month-phase claim" — which is a fine lesson, but the page is not designed to teach it.

**2. Item stage review.**
- `TimingGridView.jsx` is one 1-line component: four facts, the rule as a sentence, and the last 15 bars as a table. The view is called "timingGrid" and contains no grid.
- Practitioner needs: a candle chart of the 60 bars with the setup bar marked and the trigger level drawn (`prior20High` 11102.67 line for a range break; the 50-day line for a pullback); a **mini calendar heat strip** (Mon–Sun × start/middle/end) with this item's cell highlighted and the *prior-only* slot mean and **its n** written in it.
- Promote: `direction` as a big LONG/SHORT pill, `conditions` as drawn levels. Hide: the OHLC table (move behind a disclosure). Format: volume as "22.9B"; weekday/month phase capitalised; "Prior-only typical slot return 0.922%" must show n — for ST-0001 the history is 22 bars, so that "typical" return is the mean of **two** Saturdays.
- The sticky site nav overlaps the facts row in the stage screenshot (`setup-timing-3-stage-scored.png`: "Weekday / Month phase" are hidden under the nav bar; same in `overfit-review-3-stage-scored.png`).

**3. Answers and evaluation strip.**
- `best_slot` ("Which calendar slot is most favourable for this setup?") cannot be answered from one instance, and the answers show it: **in all 323 items where the model named a slot, it named the item's own slot**; the other 157 said `NO_PREFERENCE`. It is an echo, it is never graded, and it should be removed.
- `direction_bias` is never graded either.
- `timing_favourable` is driven by one supplied number: it agrees with `sign(typicalPastSlotReturn × direction)` in **388 of 480 (81%)**. The model is reading back a noisy statistic (often n < 10) that the state labels "typical". That is a leading input.
- `expected_hold`: the model answered `TWO_TO_THREE` 410 times and `FOUR_TO_FIVE` 70 times; never the other two. The realised "best hold" label is an argmax over four noisy returns (distribution 134 / 78 / 111 / 157) and `TWO_TO_THREE` is the *rarest* class. The label is not a property of the setup; it is noise, and the question has no gradeable truth.
- Verdict card should read: "Called FAVOURABLE (0.62) for LONG → next 5 bars +1.76% → agreed", plus the slot's prior n.

**4. Report, charts and metrics.**
- **"Favourable-call accuracy 52.1%" is below a trivial baseline.** Long setups were up 134/240, short setups (signed) up 105/240. The rule "favourable if long, unfavourable if short" scores **56.0%**. The model called favourable on 66% of longs and 13% of shorts — it has mostly learned that rule, slightly worse. Against a coin, 52.1% on n = 480 has SE 2.3 points: not distinguishable from 50%. The KPI is shown in neutral tone with no baseline.
- **"Hold-window agreement 17.3%" is below chance** (25% for four classes; majority-class baseline 32.7%). It should not be a KPI; the target is ill-posed.
- **"Sufficient grid cells 0 of 127" is guaranteed by construction.** 480 instances over 4 symbols × 2 directions × up to 7 weekdays × 3 phases = 127 occupied cells, mean 3.8 per cell. To reach 20 per cell the dataset would need ~2,500+ instances. The generator caps at 480 (`scripts/generate/setup-timing.js:6`) out of `candidateCount` candidates. The "finding" is an artefact of the design, not of the market.
- Selection bias: round-robin takes the *earliest* 30 of each of 16 buckets, so **344 of 480 instances are from 2020–2022** and only 39 from 2024 onward. One regime dominates.
- There is a real signal the report never shows: favourable-called setups averaged **+0.68%** over five bars (n = 191) vs **−0.12%** for the rest (n = 289). With SD 5.9% that is t ≈ 1.5 — suggestive, not significant, but it is the only gradeable quantity with economic meaning and it is absent. Quality quartiles are non-monotonic (−0.27, +0.71, −0.42, +0.77): the score carries nothing.
- `topItems` is sorted by realised return (all BTC, 21–23%) — that is a list of outcomes, not of model calls worth opening.
- Report height: the 127-row table, then two checks whose `items` arrays are **not sliced** (230 and 397 ids, `demo.js:76-77`; other demos `.slice(0, 20)`), then 30 top items. That is most of the 7,582px.

**The right visual form.** A real heatmap, as small multiples:
- One panel per instrument × direction (4 × 2 = 8 panels, laid out 4 across). Each panel: columns Mon–Fri (+Sat/Sun for BTC), rows start / middle / end.
- Cell fill: diverging colour on mean realised 5-bar signed return (clamped ±3%); **cell opacity or a hatch encodes n** so under-sampled cells are visibly untrustworthy rather than merely greyed; n printed in the cell; a small corner triangle filled proportionally to "Jev favourable" rate so call and outcome sit in one glyph. Hover gives the items; click filters the rail.
- Above it, a **marginal** version that *is* supportable: weekday alone (5–7 cells, n ≈ 70–110 each) and month phase alone (3 cells, n ≈ 160), each with a 95% interval whisker. This is where any honest timing claim lives.
- Apply a multiple-comparisons note on the panel: with 127 cells at α = 0.05 about six would look "significant" by chance; show Benjamini–Hochberg-adjusted markers only.
That takes the section from ~4,500px to ~600px and makes "insufficient" a visible texture instead of 127 repeated strings.

**5. Bespoke Present screen.**
1. *"Everyone has a Monday theory."* The empty 8-panel heatmap frame.
2. One setup: ST-0059 (BTC range break long, quality 4.5, +22.0%) — chart, trigger line, the model's call, reveal.
3. The grid fills as 480 instances stream in; cells stay hatched because n is 1–9. Counter: "cells with 20+ instances: 0 of 127".
4. Collapse to marginals: weekday bars with interval whiskers all crossing zero.
5. Closing number: **"52.1% — a long-only rule gets 56.0%."** The message: the harness tells you there is no timing edge here and that the model did not invent one; if the owner wants a positive story instead, this demo is the wrong place for it.

**6. Re-runnable model test.** Card: favourable-call accuracy **with both baselines printed beside it** (coin 50%, direction rule 56.0%); mean return favourable vs not with CI; Brier/ECE of the noul against "5-bar return > 0"; echo rate of `best_slot`; dependence on the supplied slot statistic (the 81% figure — a regression test for "is the model just reading the hint"); per-instrument and per-year slices. Gate: INCONCLUSIVE unless the accuracy CI excludes the direction-rule baseline. Dataset: sample uniformly over time rather than earliest-first; either raise to all candidates or coarsen the grid to cells that can reach n ≥ 30; send n with the slot statistic or drop it; remove the hold-window target or replace it with a regression target (e.g. MFE timing); anonymise symbol/date as in 181.

**7. Bugs and defects.**
- Stage is a table, no chart (`-3`, `-7`).
- Sticky nav covers the Weekday/Month-phase facts in the full-page capture (`-3-stage-scored.png`).
- Step rail wraps under the title at this title length (`-3`).
- "Realised 5-bar return" printed to three decimals with n = 1–9; "Insufficient (<20)" repeated 127 times (`-6-report.png`).
- Unsliced check item lists (230 + 397 chips).
- KPI "Daily only · No intraday" is a disclaimer occupying a KPI tile.
- `notes.md` says each state carries sixty candles; 19 items carry fewer (ST-0001 has 22) — harmless but the claim is inexact.
- Weekday list includes Saturday/Sunday for BTC while `best_slot` options have no weekend slot.

**8. Top 5 actions.**
1. Replace `TimingGridReport` with the small-multiples heatmap + marginal interval bars; slice check lists. [M] [demo-only widget]
2. Put baselines next to both accuracy KPIs; drop the hold-window KPI; add "favourable vs not" mean return with CI. [S] [demo-only]
3. Replace the stage table with a candle chart + trigger level + calendar strip. [M] [demo-only; reuses the candle chart]
4. Remove `best_slot` and `expected_hold` (ungradeable), and send n with — or remove — the slot statistic; re-record. [M] [demo-only]
5. Resample the dataset uniformly through time and decide the grid granularity from the sample size, not the other way round. [M] [demo-only]

---

### 183 · Regime classification (`regime-classification`)

**Scores (0–10):** Story clarity 6 · Item stage 4 · Answers-to-decision legibility 5 · Report and charts 4 · Presenter readiness 3 · Evaluation rigour 2 · Re-run/benchmark readiness 3

**1. The one-sentence value.** "Name the market each week, and let that decide which strategy is allowed to trade — same signals, same bars, gate on vs gate off." A strong, legible idea, and the gated-vs-ungated equity chart is the right hero. First paint shows 20 candles with a "Decision" flag and nothing about regimes or strategies.

**2. Item stage review.**
- The candles view is reused with `markIndex` at the **week's first bar**, so the shaded "after the decision" region is the week being judged — bars the model *did* see. In 181 the identical shading means "the model did not see this". Same visual, opposite meaning (`regime-classification-3-stage-scored.png`).
- The viewer sees 20 daily bars; the model received 45 daily bars plus 39 weekly summaries and the long-run volatility. The evidence for a *regime* call is the weekly history, and it is not shown.
- Bespoke stage: top, a 39-week strip chart (weekly change bars, range as whiskers, gap count as dots) with a **regime ribbon** underneath coloured by the model's previous calls for this instrument, the current week outlined. Below, the 45-bar candle chart with the week bracketed (not shaded as "future"). Right: a "gate panel" — three strategy rows (pullback / range break / golden cross) each with a lock icon open or shut by this week's `strategy_fit`, the size answer as a 0 / ½ / 1 / 1½ dial, and any trade that actually fired in this week listed with its later result once scored.

**3. Answers and evaluation strip.**
- `regime_clarity` is effectively constant: **min 3.57, max 4.16** over 312 weeks. The clarity curve is flat at 19.2% for every threshold up to 0.5 because no week scores below 3; "Worth opening" sorts on it and is therefore arbitrary (ten SPY weeks at "4.1–4.2 of 6").
- `strategy_fit` is nearly a deterministic function of `regime`: TREND_UP→TREND_FOLLOWING 69/90, RANGE→MEAN_REVERSION 64/69; `BREAKOUT` chosen **2 of 312** times. The criterion text for BREAKOUT ("buys a level being taken out") is a moment, not a week-long regime, so a weekly question will almost never select it. That is a question-design flaw, not only "a fact about the book".
- `risk_scaling` never says INCREASED (168 half / 139 normal / 5 none): the check "size raised in a volatile week 0 of 35" can never fail.
- Verdict card: "TREND UP · clear-ish 3.8 · allows TREND FOLLOWING at 1× → this week: range-break long on Tue **refused**, later +4.2%".

**4. Report, charts and metrics — three substantive defects.**

**(a) The gate sees the future of the trades it gates.** `weekEndFor` (`demo.js:171-176`) matches a trade to the week **containing its entry bar**, and the call for that week is made from "daily bars to the end of this week" (`demo.js:36`). A trade entered on Monday is therefore allowed or refused by an answer that saw Tuesday–Friday. Measured on the recorded data: of the 76 in-window trades, **59 are gated by a call that saw 1–4 sessions after the entry** (0 bars: 17, 1: 12, 2: 16, 3: 15, 4: 16). The header comment says the state stops at the end of the week and that tests assert it — true, and beside the point: the leak is in how the answer is *applied*. The gate must use the previous week's call. Re-run with a one-week lag: **gated +2.94% (9 trades allowed) instead of +16.74% (14)**; pullback falls from +13.25% to +1.97%. So the published gated figure is flattered by look-ahead and still loses.

**(b) 42 of the 104 "refused" trades were never judged.** The daily series start 2024-03-08 (635 bars) but the judged weeks start 2025-03-24. `runBoth` runs the strategies over the whole series; a trade with no matching week gets `allowed = false`, `size = 0` (`demo.js:153-158`) and is counted as "gate shut". 118 trades total, **only 76 inside judged weeks**; the other 42 (worth +8.38%) are attributed to the gate. Like-for-like: always-on **+86.86% over 76 trades**, not +95.25% over 118. The long flat purple stretch at the left of the equity chart (`-6-report.png`) is this artefact, not the model staying out.

**(c) The "arithmetic reading" is degenerate, so everything graded against it is meaningless.** `measured()` calls EVENT_DRIVEN when there are ≥ 4 gaps over 1% in 13 weeks (`demo.js:107-111`) — which is almost always. True matrix row totals from the report JSON: Trend up 36, Trend down 1, Range 33, High volatility 35, **Event driven 207 (66%)**. Agreement 60/312 = 19.2% is below the 20% chance rate for five classes because the reference is broken, not because the model is. The KPI "Agrees with the demo's own reading", the matrix, the clarity curve and the "disagrees 252 of 312" check all inherit this. Either fix the reference (rank-based thresholds per instrument so each class has reasonable support; gaps measured against that instrument's own distribution) or remove the four artefacts.

Other points:
- "What the gate was worth −78.51%" mixes three effects: never-judged trades (−8.38), gating (refused in-window trades), and half-sizing (allowed trades were worth +26.05 unscaled, +16.74 scaled → −9.31 from sizing). Report them separately.
- The finding renders as "The gate cost **+78.51%**" — sign formatting bug (`percent()` of a positive difference inside a "cost" sentence, `demo.js:266`).
- Sums of percentages presented as returns; sequentially compounded equity over overlapping trades in four instruments (same issue as 181).
- Missing baselines: **random gate with the same pass rate** (allow 14 of 76 at random, 10,000 draws), always-half-size, and a simple rules gate (e.g. 13-week drift sign). Without them −78 has no scale.
- n: golden cross fires 3 times; pullback 26. Only the range break (89) has a sample, and it was allowed 0 times.
- The family mapping issue in LEFTOVERS (range break = 75% of trades; BREAKOUT named twice) is real and correctly disclosed. A fairer test lets the model choose **per strategy** ("may the 20-day range break trade this week? yes/no") instead of via a family taxonomy the model must guess.

Right charts: (i) the two equity curves restricted to the judged window, with the random-gate fan; (ii) a **regime ribbon timeline** — four rows (SPY, NVDA, GLD, XOM), 78 weeks each, coloured by called regime, with trade markers above each row (filled = allowed, hollow = refused, green/red = result). This is the domain's most informative single picture and replaces the distribution bar; (iii) a per-strategy waterfall: always-on → never judged → refused → size scaling → gated.

**5. Bespoke Present screen.**
1. *"Same rules, same bars, one switch."* Three strategy cards with their one-line rules.
2. One week: RG-0001 GLD to 2025-03-28 → TREND UP, trend following, 1×; the three locks animate.
3. A refused winner from the check list (RG-0075) and the one allowed loser (RG-0201): the trade appears on the chart, the lock is shut/open, the result reveals.
4. The ribbon timeline draws across 78 weeks × 4 instruments; trades pop on it.
5. The two equity curves, judged window only, over the random-gate fan. Closing number, after the fixes: **"Gate: +2.9% vs always-on +86.9% — it refused 67 of 76 trades, and BREAKOUT was named in 2 weeks of 312."** The story is "a regime gate is only as good as the vocabulary you give it", which is a genuinely useful lesson for a quant audience.

**6. Re-runnable model test.** Card: gate value on in-window trades with **lagged** application; percentile vs random-gate distribution; pass rate; refused-winner and allowed-loser rates vs the base rates (27/32 refused winners is *worse* than the 88% overall refusal rate only marginally — i.e. no selection skill; show that comparison explicitly); regime distribution and week-to-week persistence (flip rate); fit-given-regime table; clarity spread (a collapsed 3.57–4.16 range should itself raise a warning); per-instrument slices; tokens and cost per run (1.15M input tokens is a legitimate benchmark line). Gates: FAIL if any trade is gated by a call dated on/after its entry (a structural assertion that belongs in the tests); INCONCLUSIVE if allowed trades < 30. Dataset: start the strategy run where the judged weeks start; balance the book (LEFTOVERS) or move to per-strategy permission questions; lengthen beyond 18 months; anonymise.

**7. Bugs and defects.**
- Look-ahead in gate application (`demo.js:153`, `171-176`).
- Un-judged trades counted as refused (`demo.js:149-158`).
- Degenerate reference classifier (`demo.js:107-111`).
- "The gate cost +78.51%" sign (`-6-report.png`, first finding).
- Shaded region semantic inverted vs 181 (`-3-stage-scored.png`).
- KPI wraps: "+95.25 / %", "75% / from / one rule" over three lines (`-6-report.png`).
- Curve is a flat line with identical points for thresholds 0–0.5; no tick values.
- "Worth opening" is ten near-identical SPY weeks.

**8. Top 5 actions.**
1. Apply the previous week's call to each trade and restrict both runs to the judged window; add a test that fails on any same-week gating. [S] [demo-only] — changes the headline numbers; update notes.
2. Add the random-gate baseline and split the gate value into never-judged / refused / sizing. [M] [demo-only]
3. Remove or repair the arithmetic reference and everything graded against it (KPI, matrix, curve, check). [S–M] [demo-only]
4. Build the regime ribbon timeline with trade markers; make it the report hero and the presenter's beat 4. [M] [demo-only widget]
5. Re-ask permission per strategy rather than per family (or balance the book) and re-record. [L] [demo-only]

---

### 184 · Overfit review (`overfit-review`)

**Scores (0–10):** Story clarity 8 · Item stage 7 · Answers-to-decision legibility 5 · Report and charts 5 · Presenter readiness 4 · Evaluation rigour 2 · Re-run/benchmark readiness 3

**1. The one-sentence value.** "Hand it a backtest report and it tells you, like a sceptical research lead, what is wrong with it and how much to believe." This is the most immediately legible proposition in the domain and the stage comes closest to landing it: equity curve, parameter grid with the selected cell outlined, trade distribution, costs, universe, fill timing (`overfit-review-3-stage-scored.png`). It is the only bespoke stage in the domain that shows what the model was given.

**2. Item stage review.**
- Good bones. Improvements: render the 5×5 sensitivity grid as a **true heatmap** (fill by total return or Sharpe on a sequential scale, selected cell outlined) — a parameter cliff is a *visual* phenomenon (one bright cell in a dark field) and is currently 25 cells of grey text at three lines each. Put Sharpe and DD in the tooltip, not in the cell.
- Equity curve: add y-axis values, a drawdown underlay, and headline stats a reviewer looks for first (CAGR, Sharpe, max DD, trades per year). For FEW_TRADES items draw the curve as steps with a marker per trade.
- The trade distribution is a table; make it a five-bar histogram.
- After scoring, highlight the evidence that supports the named symptom (outline the "Fill lag 0 bars" fact in red for LOOK_AHEAD, the cost line for COSTS_OMITTED, the lone cell for PARAMETER_CLIFF). That is the "answers-to-decision" link the page lacks.
- The sticky nav overlaps the grid mid-stage in the capture.

**3. Answers and evaluation strip.**
- Two questions are **all-yes**: `worth_forward_testing` is yes for **140 of 140**, and `curve_too_smooth` is yes for **137 of 140 — including 63 of the 66 honest, deliberately noisy controls** (honest curves have a quarterly information ratio ≈ 0.36; look-ahead curves ≈ 7.8). These carry no information and one of them is simply wrong for the honest set. The LEFTOVERS note about yes/no questions needing a stated bar applies squarely: give the criteria a standard ("fewer than two losing quarters in ten years", "Sharpe above 3 for a daily equity strategy").
- The strip renders both as amber warning badges (`-5-evaluation.png`: "Forward ⚠ Yes", "Too Smooth ⚠ Yes" on an honest report rated `none`) — a contradiction on the very first item.
- `trust` and `overfit_risk` are compressed and close to mirror images: honest trust 2.71–3.29, flawed 1.22–2.33; honest mean *risk* 3.36 ("moderate–high") for clean, held-out, costed backtests. The model is a blanket sceptic whose *ranking* is perfect but whose absolute level is miscalibrated.
- Symptom confidence on honest items averages **0.30** (vs 0.62–0.95 on flawed): `NONE` wins narrowly. Worth surfacing — it is the fragile part of the result.
- Verdict card: "LOOK-AHEAD · trust 1.8/6 · planted: look-ahead ✓ — evidence: signal and fill on the same close".

**4. Report, charts and metrics.**
- **98.6% is a dataset-too-easy number, and the state leaks the label by shape.** `buildState` adds `untouched_validation_as_stated` only when `item.validation` exists (`demo.js:21`); in the data that field is present for **66 of 66 honest items and 0 of 74 flawed**. Key presence alone separates honest from flawed perfectly.
- Every flaw is also a single explicit field: `lagBars: 0` (14/14 look-ahead, and nowhere else), `commissionBasisPoints: 0` with the note "No commissions… applied" (9/9), `pointInTime: false` with "constituents observed at the end of 2025" (11/11), `tradeCount` 5–14 vs ≥ 84 everywhere else (18/18). A six-line if/else over those fields scores **140 of 140** — better than the model's 138. There is no case where the statement is clean and the evidence is in the numbers (e.g. costs stated but returns only consistent with zero cost; a curve too smooth for its trade count; a plateau that is really a cliff one step outside the grid), no combined flaws, no near-misses, no red herrings.
- The notes disclose that the generator was **corrected twice after the honest controls were re-run through the model**. Tuning the dataset until the model's errors on controls disappear is test-set fitting — the precise error this demo teaches. The benchmark set has to be frozen before any model sees it.
- Two KPIs are vacuous given the score compression: "Flawed reports over-trusted 0.0%" requires trust ≥ 4 and the **maximum trust anywhere is 3.29**; the false-doubt rule's "trust < 2 or risk ≥ 5" arms are likewise unreachable, so "false doubt" reduces to the two symptom errors (OR-0044, OR-0101, both honest → parameter cliff at confidence 0.36 / 0.23).
- What is genuinely good and unreported: trust separates the classes with **no overlap** (max flawed 2.33 < min honest 2.71, AUC 1.0). Show that as a strip plot, with the caveat above about why it is easy.
- Missing: per-class precision/recall/F1 (trivial now, essential once the set is hard), macro-F1, majority baseline (always NONE = 47.1%), the rules baseline (100%), calibration of symptom confidence, trust-vs-planted AUC.

**The right visual form for the 140-card gallery (6,803px).** The gallery's sparklines are each scaled to their own min–max (`widgets.jsx:431-434`), so a +33% curve and a +205% curve look identical in height; only smoothness is visible, and the caption repeats "parameter cliff · planted parameter cliff" 22 times. Replace with:
- **Primary: a trust strip / beeswarm.** x = trust 0–6 (full scale, so the compression is visible), one dot per report, six rows by planted class, dot fill by named symptom (mismatch = ring). Threshold line draggable. 140 reports in ~260px; the two errors are the only ringed dots. Click a dot to open the item.
- **Secondary: class-grouped small multiples** — six panels, all curves of a class overlaid at 15% opacity on a **shared log y-axis** rebased to 100, class median in bold. The viewer sees at a glance that look-ahead curves are ruler-straight, few-trades curves are staircases and honest ones wander. ~300px.
- Keep the card grid behind a "Browse all 140" disclosure, 8 per row, shared scale, mismatch cards first.

**5. Bespoke Present screen.**
1. *"This backtest made 205% with a Sharpe of 3."* A LOOK_AHEAD item full screen (OR-0005): ruler-straight curve.
2. The model's read types in: "Look-ahead · trust 1.7/6 · risk 4.4". The "Fill lag 0 bars — filled at the same close" fact pulses.
3. Contrast: OR-0122 (parameter cliff, lowest trust 1.2) — the heatmap shows one bright cell in a dark field; then OR-0001 (honest) — a uniform plateau and a 0.86 → 0.72 holdout.
4. The miss: OR-0044, an honest report called a parameter cliff at 0.36 confidence — show the grid and let the audience judge.
5. The beeswarm assembles: 74 flawed left, 66 honest right, no overlap. Closing number: **"138 of 140 — and the two misses were the cautious kind."** (Only defensible once the dataset is hardened; until then add "on a set a rules engine also solves".)

**6. Re-runnable model test.** Card: accuracy, macro-F1, per-class P/R/F1, honest false-doubt rate, trust AUC (honest vs flawed), trust/risk range used (compression alarm), all-yes detectors per boolean question (yes-rate; warn above 95%), confidence on NONE, the **rules-engine baseline** and majority baseline beside the model, drift vs previous model version, and a list of flipped items. Gates: macro-F1 ≥ rules baseline on the *hard* tier; false-doubt ≤ 10%. Dataset: (1) always include the validation block — for flawed items make it absent-by-statement, contaminated ("holdout was used to pick the threshold") or collapsed (dev Sharpe 2.1 → holdout 0.1); (2) add a hard tier where the statement is clean and the numbers betray it, plus two-flaw items and honest-but-ugly items; (3) at least 30 per class; (4) freeze the seed and the generator *before* recording and keep a second unseen seed as a holdout the model has never been run on; (5) publish results per tier (easy / hard).

**7. Bugs and defects.**
- Label leak via conditional key (`demo.js:21`).
- All-yes questions shown as amber warnings on an honest item (`-5-evaluation.png`).
- Gallery sparklines individually normalised; captions redundant; 6,803px (`-6-report.png`).
- Sensitivity grid is text, not a heatmap; cells wrap to three lines (`-3-stage-scored.png`).
- Sticky nav overlays the grid mid-stage (`-3`).
- Distribution legend "none 64 · 46%" next to five amber segments reads as though 54% of reports were "warnings" — they are the planted mix, not a model failing.
- "Worth opening" lists the 14 lowest-trust items, all correct parameter cliffs; the two errors — the only items actually worth opening — are not in it.

**8. Top 5 actions.**
1. Remove the shape leak and add a hard tier + contaminated-validation variants; freeze and re-record; publish a rules-engine baseline beside the model. [L] [demo-only]
2. Replace the gallery with the trust beeswarm + class-overlaid small multiples; card grid behind a disclosure. [M] [demo-only widget]
3. Turn the sensitivity grid into a real heatmap and highlight the evidence field for the named symptom after scoring. [M] [demo-only view]
4. Fix or drop the two all-yes questions (state a bar in the criteria); add an all-yes detector to the report. [S] [demo-only; the detector is shared-runtime-worthy]
5. Replace vacuous KPIs (over-trusted ≥ 4) with thresholds relative to the used range, plus per-class P/R/F1 and AUC. [S] [demo-only]

---

### 185 · Strategy correlation (`strategy-correlation`)

**Scores (0–10):** Story clarity 8 · Item stage 6 · Answers-to-decision legibility 5 · Report and charts 5 · Presenter readiness 4 · Evaluation rigour 5 · Re-run/benchmark readiness 5

**1. The one-sentence value.** "Is a book of twelve strategies really twelve bets — or four?" The tagline is the best in the domain, and "effective number of bets 3.92 of 12" is a closing number people remember. First paint shows two cumulative curves for one pair with a grey band; it does not show a *book*.

**2. Item stage review.**
- `PairCurvesView` is a sensible bespoke stage: two cumulative weekly curves, stress window shaded, the two rules underneath (`strategy-correlation-3-stage-scored.png`). The y-axis has only a max and min (1246 / −82) and no x ticks.
- The stress band is drawn from `curves.stressFromWeek/ToWeek`, which is *not* in the state; the state says only "one stress window … roughly two thirds of the way through". So the viewer is told where to look and the model is not. Either show the band only after scoring, or say so.
- What a PM needs beside the curves: a **daily-return scatter** (strategy one vs strategy two, stress-window days in a second colour — this is where a stress-only pair becomes visible: a round cloud with a tight diagonal streak) and a **rolling 60-day correlation** line with the band. After scoring, print the computed full-period / calm / stress correlations next to the model's overlap score. Promote `instruments`, `averageHoldSessions`, `trades` into two compact strategy cards — they are the "words" the model appears to have relied on.
- A persistent **12 × 12 mini-matrix** in the corner with the current pair's cell highlighted would give every item its place in the book.

**3. Answers and evaluation strip.**
- `same_underlying_bet`'s options (SAME_FACTOR / SAME_INSTRUMENT / SAME_TIMING / DIFFERENT) do not map onto the planted relations (SAME_PARAMETERS / SAME_FACTOR / STRESS_ONLY / INDEPENDENT / ORDINARY), so the matrix is answer × correlation band, not a confusion matrix. `SAME_TIMING` is never chosen. Twelve pairs under 0.2 were called SAME_FACTOR.
- `allocation_change`: REDUCE in **40 of 60** (notes concede it is a default); KEEP once. INCREASE 14 times is never graded.
- `diversifying` for the three stress pairs is **0.55, 0.50, 0.55** — the headline "0 of 3 caught" hangs on a 0.5 cut applied to answers sitting exactly on it. The honest reading is "undecided", and n = 3.
- Overlap is compressed (0.78–4.86) but ranks very well: Pearson r = **0.82** with the computed correlation; at overlap ≥ 3, 7 of 7 are truly correlated (precision 100%, recall 7/8). The KPI uses ≥ 4 and reports "2 of 8" in amber. A threshold-free metric (AUC, Spearman) is the fair headline; the ≥ 4 bar punishes a calibration offset, not a ranking failure.
- The strongest finding is the contrast the notes identify: same-instrument pairs average overlap **4.60**, different-instrument pairs **1.80**; all five pairs above 0.7 with different instruments were graded below 4. "Where the description and the data disagree, the description won."
- Verdict card: "Overlap 3.8/6 · called SAME FACTOR · DROP ONE — computed 0.791 (calm 0.78 / stress 0.88) → agreed".

**4. Report, charts and metrics.**
- **Internal inconsistency on the "words" result:** the finding says "0 of 5 pairs that correlate above 0.7 while trading different instruments were graded as overlapping"; the check says "5 of 7"; `notes.md` says "Seven pairs … trading different instruments … five of the seven". The check's denominator counts all seven pairs ≥ 0.7 including the two same-instrument ones (`demo.js:156`), and the notes copied it. Correct statement: 7 pairs ≥ 0.7; 2 same-instrument (both graded ≥ 4); 5 different-instrument, **all 5 missed**.
- The report note accounts for 18 of 60 pairs (4 + 5 + 3 + 6); the other **42 are labelled ORDINARY** and never mentioned.
- "Effective number of bets 3.92 of 12" is a property of the **dataset**, not of the model — it will be identical on every run and should not sit among model KPIs without the model's counterpart. The valuable version: compute effective bets from the *model's* overlap scores (mapped to implied correlation) and show "book says 12 · arithmetic says 3.9 · model thinks N". Also: only 60 of the 66 pairs exist (missing S08/S09, S08/S10, S08/S12, S09/S11, S10/S11, S10/S12), so the mean correlation behind 3.92 is over an incomplete matrix.
- **The scatter is mislabelled.** `SizeScatter` hard-codes "Rolling median size →" and "Actual size ↑", a tooltip "norm … actual …" and an aria-label about "trades" (`widgets.jsx:368-375`); here it plots computed correlation vs overlap. It is visibly wrong in `-6-report.png`. The diagonal "norm line" also implies overlap/6 should equal correlation, which no rubric promised.
- The baseline problem is conceptual: Pearson correlation is one line of code and is exact. The demo asks a language model to estimate it by eye from 1,512 numbers, then marks it against the arithmetic. As a product story the fair design is the reverse — compute full-period, rolling and stress correlations, give them to the model, and test the *judgement*: shared driver from descriptions, stress-conditional dependence, what to cut. Run both arms and report "series only" vs "series + statistics"; the delta is the value statement.
- Missing metrics: AUC of overlap for corr ≥ 0.6; Spearman; per-relation table (mean overlap, n); calibration of `diversifying`; decision quality of DROP_ONE (5 of 5 correct — precision 100%, recall 5/8).

Right charts: (i) a **12 × 12 paired heatmap** — lower triangle computed correlation, upper triangle model overlap, same colour scale, stress pairs ringed, the six missing pairs hatched. This is the book in one picture and the natural homepage visual for the domain. (ii) Properly labelled scatter: x computed correlation (−0.1–1), y overlap (0–6), colour by relation, marker shape by same/different instrument, stress pairs drawn twice (calm and stress correlation joined by a horizontal line — the line *is* the story). (iii) Coverage curve kept, with tick values.

**5. Bespoke Present screen.**
1. *"Twelve strategies. How many bets?"* Twelve name tiles; counter "12".
2. An obvious pair: SC-0001 (S01/S02, momentum 20 vs 40, 0.815): curves overlay, model says 4.3/6 · drop one. Counter ticks to 11.
3. A hidden pair: SC-0052 (S07/S08 short volatility vs credit spread, **0.942**, different instruments): model says 3.8 · "drop one" but below the bar; then SC-0002 (S01/S03, 0.784) read as 3.5 · reduce. "Different words, same bet."
4. The trap: SC-0056 (S07/S12): flat for three years, the band lights, rolling correlation jumps −0.01 → **0.81**; model: diversifying 0.50.
5. The 12 × 12 heatmap fills; tiles merge into four clusters. Closing number: **"3.9 bets, not 12."** with the model line beneath: "ranked every correlated pair above every uncorrelated one but one; saw none of the three that only correlate in a crisis."

**6. Re-runnable model test.** Card: Spearman and AUC of overlap vs computed correlation; recall at precision 100%; the description-dependence gap (mean overlap same-instrument vs different-instrument at matched correlation — a regression metric for "reads words, not numbers"); stress-pair detection reported as a probability margin, not a 0.5 cut; default-answer rate (REDUCE share); model-implied effective bets vs computed; per-relation slice table; both arms (with/without supplied statistics). Gates: AUC ≥ 0.95; stress detection INCONCLUSIVE below n = 15. Dataset: raise stress-only pairs from 3 to ≥ 15 (several books, several seeds); complete the 66-pair matrix; add adversarial pairs both ways (same instruments, uncorrelated results; different descriptions, 0.9 correlation) in equal numbers so the description gap is measurable; vary series length and noise; keep ORDINARY pairs but name them in the note.

**7. Bugs and defects.**
- Scatter axis labels, tooltip and aria text belong to another demo (`-6-report.png`; `widgets.jsx:374`).
- "0 of 5" (finding) vs "5 of 7" (check) vs "five of seven" (notes) for the same fact.
- Report note omits the 42 ORDINARY pairs.
- KPI context for "Effective number of bets" is a 35-word formula that makes that tile three times the height of its neighbours (`-6-report.png`).
- Matrix header "Planted ↓ · Called →" over correlation bands; diagonal highlighting on two arbitrary cells.
- Stage y-axis shows only min/max; no x ticks; stress band shown pre-answer though withheld from the model (`-3`).
- Six pairs missing from the book matrix.

**8. Top 5 actions.**
1. Build the 12 × 12 paired heatmap (computed vs model) and make it the report hero and presenter finale. [M] [demo-only widget]
2. Give `SizeScatter` configurable axis/tooltip/aria labels and an optional diagonal; relabel here. [S] [shared-runtime]
3. Fix the 0-of-5 / 5-of-7 inconsistency in the check denominator and the notes; mention ORDINARY pairs. [S] [demo-only]
4. Replace the ≥ 4 headline with AUC/Spearman + the same-vs-different-instrument gap; move "effective bets" to a dataset line and add the model-implied figure. [S–M] [demo-only]
5. Add the "with statistics" arm and enlarge the stress-only set to ≥ 15; re-record. [L] [demo-only]

---

## Domain summary

**Cross-demo patterns**

1. **The grading leaks more than the state does.** All five `buildState` functions are clean at the bar level (181 slices at `markIndex + 1`; 182 sends only `candleWindowThroughSetup`; 183 slices at `lastBarIndex`). The leaks are elsewhere: 183 applies an end-of-week answer to trades entered earlier that week (59 of 76 in-window trades); 184 reveals the honest class through a conditional key; 181–183 send real tickers and real dates, which a model can remember. Add to the shared test suite: "no decision may be applied to an event dated on or before the last bar in its state", and "state key sets must not differ by label".
2. **No demo in the domain prints a baseline, and in every case the baseline is the story.** 181: a random-skip filter and ex-BTC (the headline finding disappears without five Bitcoin trades). 182: a long-only rule scores 56.0% against the model's 52.1%; hold-window agreement is 17.3% against 25% chance. 183: no random gate; 42 un-judged trades counted as refusals. 184: a six-line rules engine scores 140/140 against 138. 185: Pearson correlation is exact. A shared `baselines: [{label, value}]` slot on every KPI would fix the pattern once.
3. **Sample size is acknowledged in notes and ignored in findings.** Per-trade SD is 6–7% in 181/182, so with 71–480 trades, differences of 0.1–0.8% are inside one standard error — yet the generated findings say "the score knew something the decision threw away". Findings need an interval or a three-state verdict (better / worse / cannot tell). 182's 127-cell grid at n = 480 can never reach its own 20-instance minimum.
4. **Score compression is universal.** Quality 1.67–4.51, clarity **3.57–4.16**, trust 1.22–3.29, overlap 0.78–4.86, all on 0–6. Fixed absolute thresholds (≥ 4 = "high", trust ≥ 4 = "over-trusted") therefore produce vacuous or unfair KPIs, while rank metrics show the model is actually good (184 AUC 1.0; 185 r = 0.82). Report rank metrics first and add a "range used" alarm.
5. **Default and echo answers.** `worth_forward_testing` 140/140 yes; `curve_too_smooth` 137/140 yes; `best_slot` echoes the item's own slot in 323/323 named answers; `expected_hold` = TWO_TO_THREE 410/480; `allocation_change` = REDUCE 40/60; `BREAKOUT` 2/312; `INCREASED` 0/312; stop = BELOW_SLOW_MA 64/71. An automatic "answer entropy" check per question belongs in the shared report.
6. **Sums of percentages are presented as returns, and overlapping trades are compounded sequentially** (181, 183). Label as "sum of trade returns" or build a dated equal-weight book.
7. **Stages under-show the evidence.** 181 shows no moving averages; 182 shows a table; 183 shows 20 of the 45 bars and none of the weekly history; only 184 shows what the model saw. The shaded region of the shared candle chart means "unseen future" in 181 and "the week being judged" in 183.
8. **The two oversized reports have the same cause:** a per-row/per-card dump where the structure is a matrix. 182 → small-multiples calendar heatmap with n encoded as opacity plus marginal interval bars (≈ 600px instead of ≈ 4,500). 184 → trust beeswarm by planted class plus class-overlaid curves on a shared log axis (≈ 560px instead of ≈ 5,000). 182 additionally dumps 230 + 397 un-sliced item chips.

**Numbers that look wrong**
- 183: +95.25% "always on" over 118 trades includes 42 trades outside the judged window; like-for-like is +86.86% over 76. Gated +16.74% uses same-week (look-ahead) calls; lagged it is +2.94%. "The gate cost **+**78.51%". Arithmetic reference calls 207 of 312 weeks EVENT_DRIVEN; agreement 19.2% is below five-class chance.
- 181: +22.21% / "+0.50% a trade" for score ≥ 3 is driven by BTC (+41.75 of the book's +14.77); ex-BTC the score filter is −0.50% vs −0.41% for all. Win rate at score ≥ 3 is 50.0% vs 53.5% unfiltered. Nine stop levels are above the entry price.
- 182: 52.1% < 56.0% direction-rule baseline; 17.3% < 25% chance; 0 of 127 is guaranteed by design; 344 of 480 instances from 2020–2022.
- 184: 98.6% with a perfect shape leak and a 100% rules baseline; "0% over-trusted" is unreachable (max trust 3.29); 63 of 66 honest curves called "implausibly smooth".
- 185: "0 of 5" vs "5 of 7" vs notes' "five of seven"; 3.92 is a dataset constant over 60 of 66 pairs; stress "0 of 3" rests on nouls of 0.55 / 0.50 / 0.55.

**Flagship pick: 185 · Strategy correlation**, with 184 as runner-up. Reasons: it has the best one-line hook and the best closing number in the domain ("12 strategies, 3.9 bets"); it has labels, so it can carry precision/recall and a proper benchmark card without the noise problems of the realised-return demos; its central finding — the model reads descriptions over data, and misses crisis-only correlation — is interesting, honest and specific; its fixes are mostly [S]/[M]; and it owns the domain's most striking possible visual. 184 has the better stage today but its result is not credible until the dataset is hardened, and leading the homepage with "98.6%" on a set a rules engine solves would invite exactly the criticism the demo is about. 181 is "the demo people ask for by name" and should be the second card, but only after its findings are rewritten — at present its headline claim does not survive removing one instrument.

**Signature visual for the domain: the paired matrix / heatmap, "claimed versus realised".** Every demo here reduces to the same picture — a grid whose one half is what the model said and whose other half is what the arithmetic or the market later showed: 185's 12 × 12 book (computed correlation below the diagonal, model overlap above); 182's weekday × month-phase calendar (favourable rate glyph over realised-return fill, opacity = n); 184's 5 × 5 parameter heatmap where a cliff is one bright cell; 183's instrument × week regime ribbon with allowed/refused trade markers; 181's context × outcome table. One diverging colour scale for realised outcome, one sequential scale for model score, **sample size always encoded as opacity or hatching**, and a baseline fan (random-skip / random-gate) behind every equity curve. That last element — the grey fan that shows where chance lives — is what would make this domain look unlike every other backtest dashboard and is the visual expression of its real message: the harness tells you when the model is adding nothing.
