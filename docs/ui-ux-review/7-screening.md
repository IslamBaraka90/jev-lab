# Domain review 7 · Screening and fundamentals (demos 161–166)

Scope: `goal-screening`, `fundamental-read`, `sharia-screen`, `dividend-safety`, `accounting-flags`, `peer-valuation`. Read-only review. Numbers are quoted from the computed report dumps, from `demos/<id>/fixtures.json` (recorded answers) and, for 165, from `data/synthetic/accounting-flags.labels.json`. Where a number below does not appear in the shipped report, it was recomputed from the recorded answers and is marked "(recomputed)". The global findings in the brief (no report on first paint, broken confusion matrix, snake_case headings, amber `true`, generic presenter mode, no threshold slider, undefined CSS variables) are assumed and not repeated unless they bite harder here.

Five of these six demos have no labels. That is the right call for the subject, and the notes are unusually honest about it. But "no labels" has been allowed to mean "soft metrics with tiny denominators and hand-set thresholds", and in three of the five the soft metric as coded is either trivially passed, arbitrary, or measures the cross-check's weakness rather than the model's. The strongest single finding in the domain is in the one labelled demo: **165 reports a failure (58 of 73 clean years accused) that the recorded probabilities do not support — the same answers separate planted from clean at AUC 0.986 (recomputed). The default decision rule fails, not the reading.** That is exactly the story a threshold slider and a benchmark card exist to tell.

---

### 161 · Screening for a goal (`goal-screening`)

**Scores (0–10):** Story clarity 6 · Item stage 2 · Answers-to-decision legibility 4 · Report and charts 3 · Presenter readiness 2 · Evaluation rigour 4 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "Write the brief in your own words; the same sixteen instruments re-sort themselves for each brief, and every rejection names a reason you can check against the file." First paint (`goal-screening-1-landing.png`) does not land it: the visitor sees "NVDA · income-now" and a key/value dump starting with `Id`, `Symbol`, `Goal Id`. The goal brief — the only human sentence in the demo and the whole premise — is row four of a table, in body text. Nothing on the first screen says that the same company will be read six ways.

2. **Item stage review.** View is the fallback `table` (`demos/goal-screening/demo.js:244`).
   - **Defect that guts the stage:** every numeric row is blank (`goal-screening-3-stage-scored.png`, `-7-present.png`): Statement Years, Revenue, all margins, debt, cash, price, returns, volatility, volume show nothing. Cause: the `annualStatements` row prints a very long unbroken JSON string (`web/src/demo/views/TableView.jsx:10`), which stretches the table far beyond the scroll container; numeric cells are right-aligned (`className="num"`), so their values sit off-screen to the right. In 163, which has no nested field, the same view shows its numbers. The practitioner therefore sees a goal and *no evidence at all*. (Same defect: `Years On File` in 165.)
   - What a screener needs: the brief as a pull-quote; an instrument header (symbol, sector, price as of date); a compact "fact strip" of the six numbers a brief can turn on — dividend yield (not in the state at all, see §3), payout, debt/assets, FCF margin, volatility, worst fall, average daily value traded; a 4-year sparkline row for revenue/FCF/dividends. Hide `id`, `goalId`, `sharesOutstanding`, raw `annualStatements`.
   - **Bespoke visual — the "brief × instrument" strip.** Left: the brief as a quote card. Right: a row of six small gauges, one per goal, for *this* symbol (fit 0–6), the current goal highlighted, so the viewer sees NVDA at 4.6 for "ten-years" and 1.4 for "income-now" without leaving the item. Below: the named disqualifier as a chip sitting *on* the number it cites (volatility 38.0% with the chip attached), green tick if the file supports it, hollow if it does not.

3. **Answers and evaluation strip.**
   - `shortlist` is redundant with `fit_to_goal`: at fit ≥ 3 there are 37 readings and 36 are shortlisted; below 3, one (report `curve.points[3]`). It is a threshold on the score, not a second judgement. Keep it only as a consistency probe and say so.
   - `data_sufficient` has the 165 disease in reverse. The KPI says "Missing statements admitted 24 of 24" with a green tone, and the notes call it "the single most reassuring number in this run". But **54 of the 72 readings that *do* have four years of statements also said the data was insufficient (recomputed)** — 78 of 96 "no" overall. A question that says no to nearly everything has no discrimination; 24 of 24 is what you would get by chance. This is precisely the LEFTOVERS item ("`investigate`-style questions need bars in their criteria"): state what "enough" means (e.g. "at least three annual statements with revenue and cash-flow lines") and report both sides as a 2×2.
   - `disqualifier` offers VALUATION and LIQUIDITY but the state gives no earnings per share, no market cap (shares outstanding is in the item but not in `buildState`, `demo.js:22-57`) and no dividend yield. Unsurprisingly VALUATION, LEVERAGE and LIQUIDITY were chosen 0 times; the distribution is volatility 48 / none 40 / earnings quality 8. An "income-now" brief judged with no yield in the state is judging from reputation. Add market cap, P/E, dividend yield and payout to the state, or drop the options.
   - Internal consistency is not reported and should be: **10 readings were shortlisted while naming a disqualifier, and 13 named NONE yet were not shortlisted (recomputed).**
   - `evidence_strength` (mean 2.7) has no use downstream. Either gate the shortlist on it or drop it.
   - Verdict card should read: "NVDA for *income now* — **Not shortlisted** (fit 1.4/6). Ruled out by volatility: 38.0% a year, worst fall −36.9% ✓ supported by the file. Pays out 1.0% of FCF as dividends." plus the six-goal mini-strip.

4. **Report, charts and metrics.**
   - "Companies read differently by goal 16 of 16" is a bar that cannot fail: spreads are 1.8–4.5 on a 0–6 scale against a 1.5 threshold (`demo.js:139`), and the briefs are as far apart as "income now", "preserve" and "ten years". Replace with a *directional* sensitivity test (below).
   - "Disqualifiers the numbers support 68.8%" is inflated: `SUPPORTED.NONE` and `SUPPORTED.VALUATION` return `true` unconditionally (`demo.js:134-135`), so all 40 NONE readings count as supported. **Of the 56 readings that actually name a disqualifier, 26 are supported — 46% (recomputed).** The KPI context should use that denominator. The volatility bar is absolute (25%) when the judgement is goal-relative: JPM at 22.1% ruled out for "preserve" is a sound call marked unsupported, while AAPL (25.07%), XOM (25.9%) and WMT (26.0%) sit on the line. Make the bar per goal (preserve: 15%; first-holding: 20%; ten-years: 35%).
   - The matrix is a shortlist grid rendered by `ConfusionMatrix`, so its header reads "Planted ↓ · Called →" (`goal-screening-6-report.png`) — wrong for a demo with nothing planted — and it is the widget most damaged by the `td.empty` collision (the grid is ~1300px tall and unreadable). This should be a purpose-built **16 × 6 heatmap**: rows = instruments grouped by type (growth, banks, energy, staples, funds/commodities), columns = goals, cell colour = fit 0–6 (sequential), a ring for "shortlisted", a small glyph for the disqualifier. That one chart *is* the demo.
   - The coverage curve (fit vs shortlisted) only proves the redundancy in §3; drop it.
   - Missing: per-goal shortlist size; rank agreement between goals (Spearman of fit between "income-now" and "dividend-growth" should be high, between "income-now" and "ten-years" low — a free sanity check); share of shortlist decisions within ±0.1 of 0.5 (**21 of 96**, recomputed — a fifth of the grid could flip on a re-run).
   - Findings line "0 of 24 readings … still said the data was sufficient" is fine but see §3.

5. **Bespoke Present screen (4 beats).**
   1. *The brief.* Full-screen quote: "I need income now…" Nothing else.
   2. *One company, six briefs.* NVDA's six fits animate in as a strip: `NVDA-ten-years` 4.6 shortlisted, `NVDA-income-now` 1.4, `NVDA-preserve` 1.8 — "volatility 38%" chip lands on the number.
   3. *One brief, sixteen instruments.* The heatmap column for income-now lights: `KO-income-now` 5.3, `PG-income-now` 5.0, `JNJ-income-now` 5.0 on top; `BTC-USD-preserve` 0.4 at the bottom of its own column.
   4. *The honest gap.* `GLD-inflation` fit 4.5 shortlisted with `data_sufficient` 0.10: "it said yes, and said it could not check". Closing number: **26 of 56 stated reasons clear a strict numeric bar** — shown as the thing the next model version must beat.

6. **Re-runnable model test.** No labels, so the benchmark card records invariants, not accuracy:
   - *Monotonicity probes (new items):* for each brief, a matched pair differing in one number (same company, volatility halved; dividends zeroed; debt doubled). Pass = fit moves the right way in ≥ 90% of pairs. This is ground truth without anyone labelling taste.
   - *Reason support* on the non-NONE denominator with per-goal bars; *self-consistency* (shortlist ⇔ fit ≥ 3 and disqualifier NONE); *sufficiency 2×2*; *flip-risk* (share within ±0.1 of 0.5); *stability* across 3 re-runs (mean |Δfit|, shortlist flips); *name-blind delta*: rerun with symbols replaced by "Company A" — the difference is how much is reading and how much is remembering NVDA.
   - Gates: monotonicity ≥ 90%, self-consistency ≥ 95%, flips ≤ 5%. Slices: by goal, by instrument type. Dataset: 16 × 6 is adequate for a grid; add 12 probe pairs and an anonymised twin.

7. **Bugs and defects.** All numeric stage rows blank (`-3-stage-scored.png`, `-7-present.png`). Raw JSON statements row. Matrix header "Planted ↓ · Called →" on an unlabelled demo. `Data Sufficient: Yes` and would-be-good values in amber (`-5-evaluation.png`). Evaluation strip repeats `Symbol nvda` (lower-cased) and `Goal Id`. `revenueGrowthPercent: 100` for NVDA is a 3-year CAGR labelled "a year" with no period stated, beside a latest-year change of 65.5% in 162's view — two demos, two growth definitions, neither labelled.

8. **Top 5 actions.**
   1. Fix the wide-JSON-row defect so numbers render; render nested arrays as a mini table [S][shared-runtime].
   2. Replace the matrix with the 16 × 6 fit heatmap and make it the first thing on the page [M][demo-only widget].
   3. Re-base "supported" on the 56 non-NONE readings with per-goal bars; add self-consistency and the sufficiency 2×2 [S][demo-only].
   4. Put yield, payout, market cap and P/E in the state; give `data_sufficient` a stated bar; re-record [M][demo-only].
   5. Add monotonicity probe pairs and the name-blind twin as the benchmark core [M][demo-only].

---

### 162 · Fundamental read (`fundamental-read`)

**Scores (0–10):** Story clarity 6 · Item stage 7 · Answers-to-decision legibility 5 · Report and charts 6 · Presenter readiness 4 · Evaluation rigour 5 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "It reads four years of raw statement lines — no ratios supplied — and its reading of earnings quality, leverage and direction is checked against ratios computed independently on the page." The statements view makes first paint far better than 161, but the page still opens on a table of NVDA's numbers with no hint that a cross-check exists; the payoff ("7 of 9, and here are the three it disagreed on") is 4000px down and absent until Play all.

2. **Item stage review.** `StatementsView.jsx` is the best stage in the domain: compact currency, year columns, year-on-year deltas.
   - **Sign bug in the deltas.** For lines stored as negatives the arrow and colour invert: capex −$3.2B → −$6B shows "↓ 86.7%" in red and dividends −$395M → −$834M shows "↓ 111.1%" in red (`fundamental-read-3-stage-scored.png`) — a doubled dividend reads as a collapse. `StatementsView.jsx:12` computes `(current − prior)/|prior|` on signed values. Use magnitudes for outflow lines and do not colour capex at all (more capex is not "bad").
   - Promote derived rows a practitioner looks for first, *visually separated and labelled "computed here, not sent to the model"*: gross/operating/net margin, OCF ÷ net income, FCF, net debt, debt ÷ equity. Today the ratios appear only in the report, so the item never shows what the answer is being checked against.
   - Show interest expense/income and total liabilities (they are in the state, absent from `LINES`).
   - The four no-statement instruments show an empty card. Better: a single "No issuer statements — expected answer: SHORT_HISTORY" stage so the item has a point.
   - **Bespoke visual:** a two-band layout — top band, four small-multiple bar charts (revenue, operating margin, OCF vs net income paired bars, net debt); bottom band, the statement table collapsed by default. The paired OCF/NI bars are the earnings-quality question drawn.

3. **Answers and evaluation strip.**
   - `statement_gap` is a lookup: the criteria restate the rule verbatim and `statement_coverage.annualYears` is in the state. 14 of 16 is therefore not impressive, and the two misses (JPM, BAC — missing cash-flow lines called NONE) are the interesting part: the model did not check nulls. Keep, but label it a data-hygiene check.
   - The four no-statement instruments are scored `quality` 0.2–0.3 ("Very poor") and `earnings_quality` MIXED, `direction` STABLE. Absence of data is being scored as bad quality; the distribution bar's "0/6 · very poor 4 · 25%" is SPY, GLD, XLE and BTC. Short-circuit these in `evaluate`/report (N/A) or add an explicit "cannot say" option.
   - `capex_discipline` is a double-barrelled question (covers capex *and* latest burden not excessive).
   - Per-item verdict card: "NVDA — Quality 6.0 · Leverage 1.0 · Improving. Cross-check: direction ✓ leverage ✓ capex ✓ · earnings quality ✗ (Jev: cash-backed; computed OCF/NI 0.88 → mixed, threshold 0.90 — borderline)". The word *borderline* matters: see §4.

4. **Report, charts and metrics.**
   - Headline KPIs are agreement counts on **n = 9** (7/9, 8/9, 8/9, 8/9). One flip moves a KPI by 11 points. No interval is shown and none of the KPIs says "n = 9" in the value. With n = 9 the 95% interval on 7/9 is roughly 40–97%.
   - Two of the three "disagreements" are threshold artefacts: NVDA's cash conversion is 0.88 against a 0.90 cut (`src/services/ratios.js:25`), JNJ's is 0.99 (computed CASH_BACKED, Jev MIXED — a genuine disagreement). Report **distance to the cut-off** and count "agree, or within 5% of the boundary" separately: that makes earnings-quality 8 of 9.
   - `ebitdaProxy = operatingIncome + |capex| × 0.4` (`ratios.js:19`) is an unusual stand-in for D&A and will misstate leverage for asset-light firms; name it in the UI or pull D&A.
   - Direction uses first-vs-last year only, so PG (margin dip inside a 3-point band) is scored a disagreement on a definition, not a reading.
   - The quality/leverage grid is the right chart form, but: the four N/A instruments are plotted as a pile at (0.8, 0.3) with overlapping labels ("SPY/XLE/BTC-USD" unreadable, `fundamental-read-6-report.png`); plot should show **Jev leverage against computed leverage band** (agreement scatter with the ±1.25 band drawn) — that is the evaluation; quality vs leverage is only a description.
   - Missing: a per-question agreement bar with n and interval; rank correlation between Jev quality and a transparent composite (ROE, margin, FCF margin); stability across re-runs.
   - `ratioRows` order follows the data file (NVDA, JPM, XOM, BTC…): sort computable first, disagreements on top.

5. **Bespoke Present screen (4 beats).**
   1. *Raw lines only.* `FR-NVDA` table; caption "No ratios were sent."
   2. *The reading.* Quality 6.0, leverage 1.0, improving — animated beside the OCF-vs-NI paired bars.
   3. *The cross-check draws itself.* Computed ratios fade in under each answer with ✓/✗: `FR-JNJ` (Jev mixed, computed 0.99 cash-backed) as the honest miss; `FR-JPM` as "four years on file, cash-flow lines null, called complete".
   4. Closing number: **31 of 36 checkable readings agree with arithmetic the model never saw** (7+8+8+8 over 4×9), with "n = 9 companies" printed under it.

6. **Re-runnable model test.** Sixteen items, nine computable, is a smoke test, not a benchmark. To make it one:
   - Grow to ~60 issuers across 11 sectors × 2 fiscal vintages (the cache already fetches statements; include deliberately weak names — negative FCF, rising leverage, shrinking revenue — because today 12 of 12 operating companies are mega-cap quality names and "Deteriorating" appears twice).
   - Add **synthetic perturbation twins**: take a real statement, scale OCF down 40% → earnings quality must not improve; double debt → leverage must rise. Pass rate of directional twins is a hard metric with no labels.
   - Card: agreement per question with Wilson interval, boundary-adjusted agreement, null-handling accuracy (JPM/BAC type), perturbation pass rate, re-run stability (category flips of 16), drift vs last model. Gates: perturbation ≥ 90%, null-handling 100%, flips ≤ 1 in 16.
   - Name-blind run as in 161.

7. **Bugs and defects.** Inverted delta arrows on negative lines (`-3-stage-scored.png`). Stage `h2` clipped under the sticky nav in the scored capture and title duplicated. N/A instruments scored "Very poor". Overlapping point labels at the origin of the grid (`-6-report.png`). `Capex Disciplined ⚠ Yes` in amber (`-5-evaluation.png`). Distribution legend reads "0/6 · very poor" lower-cased after a title-cased source. KPI tone "warn" for 8 of 9.

8. **Top 5 actions.**
   1. Fix outflow-line delta signs/colours in `StatementsView` [S][shared-runtime view].
   2. Add a "computed here" ratio band to the item and ✓/✗ per answer on the verdict card (needs `evaluate` to call `computedRatios`) [S][demo-only].
   3. Treat no-statement instruments as N/A throughout [S][demo-only].
   4. Boundary-aware agreement + n and interval on every KPI; replace the grid with Jev-vs-computed leverage scatter [M][demo-only].
   5. Expand to ~60 issuers with weak names and perturbation twins [L][demo-only].

---

### 163 · Sharia screening, three rule sets (`sharia-screen`)

**Scores (0–10):** Story clarity 8 · Item stage 4 · Answers-to-decision legibility 4 · Report and charts 6 · Presenter readiness 3 · Evaluation rigour 8 · Re-run/benchmark readiness 7

1. **The one-sentence value.** "Same company, three published-style rule sets, three verdicts — and every ratio call is checked against the same sum done on the page." This is the clearest premise in the domain and the only unlabelled demo whose ground truth is real (arithmetic). First paint shows "NVDA · market-cap" and a key/value table; neither the three rule sets nor the ratio-vs-limit idea is visible.

2. **Item stage review.** Generic `table` view. Numbers do render here (no nested field), which confirms the 161 defect's cause. But the screen a Sharia analyst expects is a **ratio ladder**, and it is missing:
   - Three horizontal bars — debt, cash & interest-bearing securities, receivables — each drawn as value ÷ denominator with the **limit as a vertical tick** (33 / 33 / 49 for market-cap), coloured pass/fail, with the model's yes/no pinned to the right and ✓/✗ for agreement. A fourth bar for interest income ÷ revenue against the 5% limit with the 3% and 5% bands shaded.
   - Above it: the business description as a sentence with the activity answer; the denominator named in words ("÷ market capitalisation $5.37T").
   - A **three-column switcher** (market-cap | total assets | house) showing the same company's ladder under each standard side by side. Items are currently 48 separate rows; the comparison that *is* the demo requires clicking between `KO-market-cap`, `KO-total-assets`, `KO-house` and remembering.
   - Format: raw 13-digit integers (`5,367,153,690,000`) should be compact currency; `Price`, `Price As Of`, `Standard Id`, `Id` hidden; "Denominator Name" is a 20-word sentence in a cell.

3. **Answers and evaluation strip.**
   - The three ratio questions fold "missing line" into "no" ("…at or above the limit, *or the lines needed … are not on file*"). That makes "Missing lines admitted 37 of 39" indistinguishable from "defaults to no". Split into a three-way choice (INSIDE / OUTSIDE / NOT_ON_FILE).
   - `impure_income_band`'s limit (`impure_income_limit_percent`) is sent but never used to grade the verdict.
   - **The evaluation strip drops the most important output.** `evaluate` returns `said`, `ratios`, `agrees` as objects and the strip shows only Activity / Band / Verdict / Confidence / Consistent (`sharia-screen-5-evaluation.png`). The "two numbers side by side" promise in the demo's own header comment is not rendered anywhere per item.
   - Verdict card: "NVDA under *market-cap*: **PASS** — debt 0.2% < 33 ✓ · liquid 1.2% < 33 ✓ · receivables 0.7% < 49 ✓ · interest income 1.1% (<3) ✓ · activity: compliant. Under *house*: liquid 30.3% ≥ 25 → arithmetic says FAIL, model said pass ✗."

4. **Report, charts and metrics.**
   - Good headline: "98 of 105 ratio calls match the arithmetic" (93.3%). Add the baseline: always-"inside" and always-"outside" agreement rates, because most ratios for mega-caps on a market-cap denominator are trivially inside. Report **accuracy on calls within ±5 points of the limit** separately — that is the real test (JNJ 24.06% vs 25% is one; the three liquid-assets misses at 30.3/25, 36.9/33, 59.3/33 are not near the limit and are all false passes, a directional bias worth its own KPI: "false passes 3, false fails 4").
   - **Missing the obvious metric: an expected verdict.** Where activity is known (`ACTIVITY` true/false, `demo.js:134`) and all lines exist, the correct verdict is fully determined by arithmetic. The report grades only internal consistency (98%), not whether the verdict is right. Add "Verdict matches arithmetic: x of y determinable screenings" and a true confusion matrix (expected PASS/FAIL/REVIEW × given). The current "matrix" is a verdict-by-standard count table drawn with the confusion-matrix widget and its "Planted ↓ · Called →" header.
   - **The confidence curve shows inverse calibration and the chart hides it.** From the report JSON: calls from screenings with verdict confidence ≥ 0.5 match 94.4% (51/54); ≥ 0.7, 87.5% (21/24); ≥ 0.9, **75.0% (9/12)**. The more confident the verdict, the *less* accurate its ratio calls — driven by confident FAILs on the banks, where the ratio errors live. The generic CoverageCurve plots x = count, so the dashed line appears to rise left-to-right (`sharia-screen-6-report.png`) and reads as healthy. Draw a reliability chart: x = confidence bin, y = share matching, with the diagonal. Note the mismatch too: verdict confidence is being used as a proxy for ratio-call confidence; use each noul's distance from 0.5 instead.
   - Best chart for this use case and absent: a **16 × 3 verdict grid** (instrument × standard, P/F/R cells, a ✗ overlay where arithmetic disagrees). KO, PEP, PG, JNJ flipping across columns is the demo's headline finding and is currently a sentence.
   - "Conventional banks refused 5 of 6" and "Same business, same activity answer 14 of 16" are excellent invariance checks (JPM and SPY change activity answer with the ratio standard). Keep and promote.
   - Top items show "debt 53.8%" for `JPM-market-cap` but the finding is about JPM *liquid* 36.9%; the value column should show the binding ratio.

5. **Bespoke Present screen (5 beats).**
   1. *One balance sheet.* KO's five filed lines, large.
   2. *Three rulers.* The ladder under market-cap: all bars inside → PASS (`KO-market-cap`).
   3. *Change the ruler.* Denominator switches to total assets; the debt bar (43.4% of assets) crosses the 33 tick → FAIL (`KO-total-assets`). Same company, same afternoon.
   4. *Checked, not trusted.* `NVDA-house`: model says liquid assets inside; the page's sum says 30.3% against 25 — red ✗. Then `JPM-house`: model fails debt at 11.3%, page says pass, caption "a bank's deposits are not in this line — the model may be right and the sum wrong".
   5. Closing number: **98 of 105 ratio calls match arithmetic; 4 of 16 companies change verdict with the rule set.**

6. **Re-runnable model test.** Closest to benchmark-ready in the domain because truth is computable.
   - Card: ratio-call accuracy overall / near-limit / by ratio / by standard; false-pass vs false-fail; verdict-vs-arithmetic accuracy; activity invariance (16/16 required); banks refused (6/6 required); verdict self-consistency; reliability (ECE) on nouls; drift.
   - Gates: false passes = 0 (a compliance screen's costly error), invariance 16/16, near-limit accuracy ≥ 85%.
   - Dataset: 105 gradeable calls but only ~10 near a limit. Add **synthetic boundary items**: real balance sheets with one line scaled so the ratio lands at limit ±0.5, ±2, ±5 points (120 more calls, truth free). Average the market-cap denominator over 12 months as the real standards do. Add a wrong-denominator trap slice (the PEP/PG errors suggest the model sometimes uses the other standard's pair).

7. **Bugs and defects.** Per-item ratios not rendered (objects dropped from the strip, `-5-evaluation.png`). "Planted ↓ · Called →" header on a non-confusion table; cell shading in that table is arbitrary amber (`-6-report.png`). `Activity Compliant ⚠ Yes`, `Consistent ⚠ Yes` in amber. Seven KPIs wrap to a second row with one orphan tile. Curve direction misleading (above). 13-digit unformatted integers on the stage.

8. **Top 5 actions.**
   1. Build the ratio-ladder item view with limit ticks and the three-standard switcher [M][demo-only view].
   2. Add expected-verdict grading and the 16 × 3 verdict grid [S–M][demo-only].
   3. Replace the curve with a reliability chart and surface the inverse-calibration finding [S][shared widget].
   4. Split "missing" from "outside" in the ratio questions; re-record [M][demo-only].
   5. Add boundary-scaled synthetic items and a zero-false-pass gate [M][demo-only].

---

### 164 · Dividend safety (`dividend-safety`)

**Scores (0–10):** Story clarity 6 · Item stage 6 · Answers-to-decision legibility 4 · Report and charts 4 · Presenter readiness 3 · Evaluation rigour 3 · Re-run/benchmark readiness 2

1. **The one-sentence value.** "High yield is only good if it survives a bad year: the model grades payout safety from raw cash-flow lines, and the page plots that against a yield the model never saw." First paint shows NVDA's full statements — a company yielding 0.02% — as the opening case for a dividend demo. The hero should be a payer under strain (KO, PEP or CVX).

2. **Item stage review.** Shares `StatementsView`, so inherits the inverted delta bug on exactly the line that matters here (dividends paid rising shows red ↓). For this job the generic twelve-line table is the wrong emphasis:
   - Promote a **cover waterfall** per year: net income → OCF → minus capex = FCF → minus dividends = surplus/shortfall, four years side by side. KO's latest year (payout 166% of FCF) would show a red shortfall bar immediately.
   - Add payout ÷ earnings and payout ÷ FCF lines with 100% marked; debt trend under it (is the gap being borrowed?).
   - `share_count_history` and `debt_maturities` are sent **empty** (notes confirm), yet `first_to_break` offers SHARE_BUYBACKS and DEBT_MATURITIES. Either source them (buybacks are a standard cash-flow line) or remove the options.

3. **Answers and evaluation strip.**
   - `first_to_break` and `cut_risk_12m` have **no criteria** — option text is just the title-cased key (`demo.js:26-27`). "Moderate" against what base rate? This is the LEFTOVERS problem again: uncalibrated bands. Anchor them ("HIGH: more likely than not to be cut within twelve months").
   - `first_to_break` presupposes something breaks; the cross-check formula returns NONE for 6 of 10 companies and can never return SHARE_BUYBACKS, while Jev chose SHARE_BUYBACKS for NVDA, AAPL and PG. **"First pressure agreement 2 of 10" is a vocabulary mismatch between question and cross-check, not a model result.**
   - Safety and cut-risk disagree with each other and nobody checks: KO safety 2.3 ("Weak") with cut risk LOW; PEP 2.8 with LOW. Add a consistency check.
   - No-statement instruments get safety 0.2–0.8 and **"Very high cut risk"** — SPY listed as "Very high cut risk" in "Worth opening" (`dividend-safety-6-report.png`) is simply false and embarrassing on camera. Make them N/A.
   - JPM: `payout_funded_by_debt` 0.60 (yes) with no cash-flow lines on file — a confident answer from missing data that the report excludes instead of flagging.
   - Verdict card: "KO — Safety 2.3/6 · Low cut risk (inconsistent). Dividends $8.8B vs FCF $5.3B: cover 0.60×. Formula: 2/6, cash cover breaks first ✓ agrees."

4. **Report, charts and metrics.**
   - "Safety-band agreement 4 of 10" undersells the result because the formula is top-coded: six of ten companies score exactly 6, and Jev's 4.3–5.1 ("Strong/Very strong") misses the ±1.25 band for MSFT, PG, JNJ, WMT. Ranking tells a different story: **the four lowest by Jev (KO 2.3, CVX 2.5, XOM 2.7, PEP 2.8) are exactly the four lowest by formula (2, 4, 5, 3) (recomputed).** Replace band agreement with Spearman rank correlation and "bottom-quartile overlap".
   - **Rounding bug:** cover is computed as `1 / ratio.payoutOnEarnings` from a payout already rounded to two decimals (`demo.js:68`, `ratios.js:68`). NVDA shows earnings cover **100.00×** and cash cover **100.00×**; the true values are 123× and 99×. XOM shows 1.67× from a rounded 0.60. Compute cover from raw lines.
   - `historicalCuts` is computed and never rendered (no widget for the key) — currently empty, so harmless, but it is the section the demo most needs (see §6).
   - The scatter is the right form (x = computed yield, y = Jev safety) but lacks: a shaded "yield trap" quadrant (yield ≥ 3%, safety < 3), x tick values, point size by payout/FCF, and label collision handling (MSFT/WMT overlap). Only CVX and PEP fall in the quadrant — say so in the chart, not in a sentence.
   - Missing: payout/FCF vs Jev safety scatter (the direct evidence check), debt-funding 2×2, n and interval on everything (n = 10, 9).

5. **Bespoke Present screen (4 beats).**
   1. *The temptation.* A ranked list by yield: PEP 4.3%, CVX 3.1%, PG 3.0%…
   2. *Open the top one.* `DS-PEP` cover waterfall: dividends = 100% of FCF, 93% of earnings. Jev safety 2.8.
   3. *The one that looks fine and is not.* `DS-KO`: yield 2.3%, payout 166% of FCF, debt rising — formula 2/6, Jev 2.3/6, both say cash cover breaks first.
   4. *The map.* Scatter with the yield-trap quadrant shaded; `DS-PG` (3.0% yield, safety 4.3) as the counter-example. Closing number: **the four weakest payers by formula are the four weakest by the model — from raw lines, no price, no ratios.**

6. **Re-runnable model test.** This demo has *real ground truth available and does not use it*: dividend cuts are public facts. The cache holds four recent years of mega-caps that never cut, so the honest KPI is "Historical cuts in cache: 0" — an evaluation with no positives.
   - Rebuild as a **point-in-time backtest**: ~80–120 issuer-years drawn from known cutters (energy and financials 2020, industrials and retailers 2019–2020, telecoms and consumer names 2022–2024) and matched non-cutters; state = four years of statements *ending the year before*; label = cut within the next 12 months. Hide the symbol (name-blind) to stop recall of famous cuts.
   - Card: AUC of safety score vs cut; recall of cuts at safety < 3; precision; calibration of `cut_risk_12m` bands vs realised cut frequency; comparison to the payout-cover formula as the **baseline to beat**; stability across re-runs. Gates: AUC ≥ formula AUC + 0.05; VERY_LOW band realised cut rate ≤ 2%.
   - Until then, label the present 10-company comparison "illustration, n = 10".

7. **Bugs and defects.** 100.00× cover from rounded payout (table inside `DividendSafetyScatter`). SPY/XLE/GLD/BTC shown as "Very high cut risk". Inverted dividend delta arrows on the stage. Scatter has no x ticks; labels collide. `Growth Sustainable ⚠ Yes` amber (`-5-evaluation.png`). KPI "Historical cuts in cache 0" occupies a headline tile to announce an absence. Unrounded `1.6666666666666667` in report JSON.

8. **Top 5 actions.**
   1. Rebuild the dataset as a point-in-time cut backtest with real outcomes [L][demo-only].
   2. Anchor `cut_risk_12m`/`first_to_break` criteria; align the option list with what the state contains; N/A for non-issuers; re-record [M][demo-only].
   3. Replace band agreement with rank correlation and bottom-quartile overlap; fix the cover rounding [S][demo-only].
   4. Cover-waterfall item view; open on KO, not NVDA [M][demo-only view].
   5. Yield-trap quadrant, ticks and collision handling on the scatter [S][shared widget].

---

### 165 · Accounting red flags (`accounting-flags`)

**Scores (0–10):** Story clarity 7 · Item stage 1 · Answers-to-decision legibility 3 · Report and charts 5 · Presenter readiness 2 · Evaluation rigour 7 · Re-run/benchmark readiness 7

1. **The one-sentence value.** "A reviewer's queue of 120 company-years, ordered so the 47 with a real pattern come first — and the ones the notes already explain are told apart." The page cannot land it: first paint is a key/value table whose `Statements` row is three lines of raw JSON and whose `Notes` row is a JSON array cut off mid-sentence (`accounting-flags-7-present.png`). The notes are *the entire point of the decoys* and they are unreadable.

2. **Item stage review.** Uses `table` even though a statements view exists in the same domain. Needed:
   - A three-year statement table (reuse `StatementsView` with this demo's keys: `tradeReceivables`, `inventory`, `costsCapitalised`, `tradePayables`) with **growth-gap highlighting**: receivables growth next to revenue growth, inventory vs sales, OCF vs net income, capitalised costs vs opex, each as "+60% vs +8%" chips. The PRP's first video beat ("Receivables up 60% on revenue up 8%, flagged") has no screen that can show it.
   - Sector norms (they are in the state) as a faint reference band on days-receivable / days-inventory.
   - Notes as a readable list, with the sentence that explains a pattern highlighted *after* scoring for decoys; auditor history as a small timeline (the restatement signal lives only there — and 3 of 5 restatements were missed).
   - After scoring: the planted label and decoy status (global finding 3, but here it is the whole lesson).

3. **Answers and evaluation strip.**
   - `investigate` has been through the fix LEFTOVERS describes (73/73 → 51/73 after a standard was added to the state). It is still mis-thresholded rather than undiscriminating: **at noul ≥ 0.5, 96 held (36 of 37 real, 51 clean); at ≥ 0.7, 52 held (34 of 37 real, 9 clean) (recomputed).** The noul is informative; 0.5 is simply the wrong operating point. This demo is the best argument in the suite for the threshold slider.
   - `flag` has the same property, more dramatically. Argmax names a pattern on 105 of 120 (58 clean years "accused", every one of them as RECEIVABLES, mean P(NONE) 0.22). But ranking by 1 − P(NONE) gives **AUC 0.986; flagging at P(NONE) < 0.05 selects 46 years of which 45 are planted — precision 98%, recall 96% (recomputed, in-sample).** The report's headline "Clean years accused 58 of 73" and the notes' "reads statements well and decides about them badly" are both true of the argmax and both hide that the probabilities are nearly perfect. All 58 false accusations landing on the *first-listed* option also suggests position bias: re-record with shuffled option order as a control.
   - `second_flag` is malformed: in **88 of 120 items the second flag equals the first (recomputed)** — the option texts ("Receivables are *also* running ahead…") invite restating the primary. "Second pattern found 9 of 14" is not interpretable. Exclude the primary choice or reword as "a *different* pattern".
   - `severity` does not track planted seriousness (correlation 0.06 across the 47, recomputed; label field `seriousness` is unused by the report). It separates planted from clean (AUC 0.895) but does not grade.
   - `business_explanation_exists` sits at 0.46–0.73 on all ten decoys — "7 of 10 found" is three coin-edges away from 4 or 10.
   - Verdict card: "AF-0018 · Receivables +111% vs revenue +14% — **named correctly** · decoy: note 1 explains it (move to two distributors on 90-day terms, settled after year end) · model found the note (0.65) **and held it anyway (0.82)** ✗ · severity 3.7".

4. **Report, charts and metrics.**
   - Missing baselines that change the reading: exact-match accuracy is **48 of 120 (40%) against always-NONE 73 of 120 (61%) (recomputed)**. The report never states overall accuracy or a baseline — it should, and then immediately show the ranked view that beats it.
   - Missing: precision/recall/F1 per flag; a PR curve or, better for this use case, a **review-budget curve** (x = years reviewed in rank order, y = real patterns caught, with the random diagonal and the perfect curve) drawn for three rankers — severity, `investigate` noul, 1 − P(NONE). The existing coverage curve uses integer severity bands only (58 reviewed → 35 of 37 caught) and carries the generic "Lines opened / Problems caught" table labels. `of: planted.length` (47) is used as the curve's denominator while `caught` counts only non-decoy patterns (max 37) — the curve can never reach its own ceiling.
   - Confidence is not informative for naming: correct share by confidence bin is 10/27 (<0.5), 13/37, **5/29 (0.7–0.9)**, 20/27 (≥0.9) (recomputed) — a reliability chart would show the dip.
   - KPI pair is confusing: "Decoys let through 0 of 10" vs check "Explained patterns sent on anyway 9 of 10" (the tenth, AF-0044, was signed off without its explanation being found, so it counts in neither). Present one 2×2: explanation found × held.
   - "Real patterns sent on 36 of 37" is shown without its cost; pair it with precision (36 of 96 held = 37.5%).
   - Confusion matrix (from JSON): receivables 10/12, inventory 7/9, revenue timing 3/8 (4 → receivables), capitalised 6/7, related party 5/6, restatement 2/5, none 15/73 (58 → receivables). A cost-weighted view matters here: a missed restatement is not equal to a mislabelled inventory build.
   - Nine KPI tiles; the two that matter (ranking works; decision does not) are tiles 4 and 3.

5. **Bespoke Present screen (5 beats).**
   1. *The pattern.* `AF-0027` (Beacon Holdings): inventory up while sales fall, growth-gap chips light; named correctly, severity 4.5.
   2. *The decoy.* `AF-0018`: same arithmetic; the explaining note highlights. Model found it (0.65) — and held the year anyway (0.82). Honest caption: "read, not believed".
   3. *The miss.* `AF-0085`: restatement planted in the auditor history, called capitalised costs at 0.93 confidence.
   4. *The slider.* Threshold on `investigate` drags 0.5 → 0.7: held 96 → 52, clean years held 51 → 9, real patterns caught 36 → 34. The KPI tiles update live.
   5. Closing number: **review 52 of 120 and catch 34 of 37 real patterns** (or, if the P(NONE) ranker is adopted: 46 reviewed, 45 planted).

6. **Re-runnable model test.** Already the domain's only labelled benchmark; seeded generator, three documented recordings. To make it fair and repeatable:
   - Card per run: AUC (any pattern; real-vs-rest) for each ranker; recall at fixed review budget (25%, 40%); precision/recall at the **declared** operating threshold (choose it on a dev split, report on a held-out split — every number above is in-sample); per-flag F1; decoy 2×2; restatement recall (text-only slice); second-flag accuracy once the question is fixed; severity-vs-seriousness correlation; option-order control delta; drift vs previous model.
   - Gates: AUC ≥ 0.95, recall@40% ≥ 0.90, clean-held ≤ 15% at the declared threshold, decoys excused ≥ 5 of 10.
   - Dataset: 5–8 positives per class is too few for per-class claims (restatement n = 5, related party n = 6) — raise to ≥ 20 per class and 30 decoys, 300–400 items, two seeds (dev/test). Add graded subtlety (the `seriousness` field exists; use it for a difficulty slice). Randomise option order per item.

7. **Bugs and defects.** Raw JSON for statements, notes and auditor history; notes truncated off-screen (`-3-stage-scored.png`, `-7-present.png`). `Years On File` blank (same wide-row defect as 161). Title repeats id and sector. Confusion matrix unusable with 7 × 7 and the `td.empty` collision (`-6-report.png`: "58" and "15" land under Receivables and Revenue timing instead of Receivables and None). Distribution legend wraps to two lines with every non-NONE class the same amber. Curve ceiling mismatch (47 vs 37). Notes file says "all 110 graded items" in one place; the dataset is 120.

8. **Top 5 actions.**
   1. Add rank metrics (AUC, recall at budget) and the always-NONE baseline; make the review-budget curve with a live threshold the hero [M][shared-runtime slider + demo-only metrics].
   2. Statement + growth-gap + notes item view; reveal planted label and decoy note after scoring [M][demo-only view].
   3. Fix `second_flag` wording, randomise option order, re-record [M][demo-only].
   4. Dev/test split with a declared threshold; grow to ≥ 20 per class [L][demo-only].
   5. Collapse nine KPIs to four: recall@budget, clean years held at threshold, decoys excused, restatement recall [S][demo-only].

---

### 166 · Peer valuation (`peer-valuation`)

**Scores (0–10):** Story clarity 5 · Item stage 5 · Answers-to-decision legibility 3 · Report and charts 4 · Presenter readiness 3 · Evaluation rigour 2 · Re-run/benchmark readiness 1

1. **The one-sentence value.** "Cheapest on a multiple is not best value: the model picks inside a peer group from raw prices and statements, says whether the premium name earns it, and refuses to rank a set that is not comparable." First paint shows a twelve-column table of raw billions with no multiples ("appear after the replay in the report") — so the item view cannot show cheap from expensive, which is the subject.

2. **Item stage review.** `PeerGridView` shows latest-year raw lines per peer. A valuation analyst's comp sheet is multiples plus quality, and the viewer needs it *on the item* (clearly badged "computed here, not sent"):
   - **Bespoke visual — the comp strip.** One row per peer; columns P/E, P/B, P/FCF drawn as horizontal dot-plots on a shared axis per multiple (cheapest left), then operating margin and growth as small bars. Jev's pick gets a ring; the multiple-cheapest gets a tag. Below: the pick probabilities as a bar (GOOGL 39%, NVDA 26%, MSFT 18%, AAPL 16% — a near-flat distribution the current UI reports as a single winner).
   - Format: price "$222.3" (compact notation drops cents); title repeated three times (stage h2, eyebrow, h3 — `peer-valuation-7-present.png`); choice options rendered "Nvda".
   - Four years of statements are sent; only the latest is shown. Add margin trend sparklines (the PRP beat "premium peer … with the margin trend beside it" has nothing to show).

3. **Answers and evaluation strip.**
   - `best_value` offers all 17 symbols for every set; "choose only a symbol present" is an instruction, and "Picks inside set 4 of 4" is a KPI about obeying it. Options should be per-item.
   - `premium_justified` and `discount_reason` refer to "the most expensive operating peer" and "the cheapest credible operating peer" without saying which those are or by which multiple; the answers cannot be attributed to a company. Staples shows the problem: pick = WMT (P/E 38.7×, P/FCF 56.7×, margin 4.2% — the *most* expensive name) with discount reason "No discount". Ask "which peer is most expensive?" as its own choice first, then the follow-ups.
   - Confidence is low everywhere (1.7–2.9 of 6) and pick probabilities are flat (0.39, 0.49, 0.62, 0.44) — the honest reading is "no strong view", which the card should say.
   - Verdict card: "Defensive staples — Jev: WMT (44%), then PG 23%, JNJ 19%. Cheapest on all three multiples: PG. Jev rejects the set as not comparable (0.42). Confidence 2.9/6 — weak view."

4. **Report, charts and metrics.**
   - **"Plurality-cheapest" is arbitrary in two of four sets.** `computedBest` takes the mode of three minima and breaks ties by member order (`demo.js:51`). Energy: cheapest P/E = COP, P/B = CVX, P/FCF = SLB — three different names, one vote each; tie broken to **CVX, which has the highest P/E in the set (33.4×)**. Banks: P/E → WFC, P/B → C, P/FCF unavailable — 1–1, broken to WFC. The findings then assert "the plurality … points to CVX/WFC". Only TECH and STAPLES have a real (unanimous) reference; agreement where defined is **1 of 2**, not 1 of 4. Replace with a mean-rank composite across available multiples and report "no clear cheapest" on ties.
   - **"Loose set rejected: Yes" (green) hides that the model rejected 3 of 4 sets** — technology (0.42) and staples (0.42) as well as energy (0.18). Comparability accuracy is 2 of 4: one true rejection, two false rejections. "Worth opening" then labels TECH and STAPLES "Loose set" as if that were the design. Report it as a 2×2 (designed loose × called loose).
   - "4y revenue change" 700.5% for NVDA beside 5.5% for AAPL is a total change over three intervals, not annualised; label or annualise. XOM's EV/FCF is "–" because its debt lines are missing, silently.
   - n = 4. Every KPI is a fraction of four; "Average confidence 2.5 / 6" is a mean of four. No chart — the report is four tables. The right chart is the comp dot-plot above, plus a **value map**: x = composite cheapness rank, y = quality (margin, growth, leverage), pick ringed — it shows at a glance whether the model buys cheap, quality, or fame.

5. **Bespoke Present screen (4 beats).**
   1. *Cheap on paper.* `PV-TECH` comp strip: GOOGL leftmost on all three multiples (15.5× / 4.9× / 28.0×) against NVDA 44.7×.
   2. *The pick and its weight.* GOOGL at 39% — ring lands; the near-flat probability bar stays on screen.
   3. *The premium.* `PV-STAPLES`: WMT at 38.7× earnings on a 4.2% margin, picked over PG at 21.2× — shown as the disagreement, with the reason the model gave. Do not soften it.
   4. *The refusal.* `PV-ENERGY`: comparability 0.18, confidence 1.7 — "it declined to rank producers against an oilfield-services company". Closing number, honestly framed: **1 designed trap, caught; 2 sound sets also refused** — the next version's target.

6. **Re-runnable model test.** Four items cannot be a test. Minimum viable benchmark:
   - **Scale:** ~40 peer sets (11 sectors × 3–4 sets) × 2–3 as-of dates ≈ 100 items, with ~25% designed-loose sets of several kinds (mixed business models, mixed currencies/accounting, holding company among operators).
   - **Truth without labels:** (a) *price-perturbation monotonicity* — duplicate a set with one peer's price cut 30%; P(best = that peer) must rise; (b) *order invariance* — shuffle peer order, pick must not change (tests position bias; the 17-option list makes this likely); (c) *name-blind twin* — tickers replaced by letters; pick agreement with the named run measures reputation leakage (every company here is one the model has read about); (d) *dominance items* — a peer cheaper on every multiple *and* better on margin, growth and leverage must win.
   - **Noisy real truth:** for older as-of dates, forward 12-month relative return of the pick vs the set median — reported as a hit rate with a wide interval, never as a gate.
   - Card: dominance accuracy, monotonicity pass rate, order-invariance rate, name-blind agreement, loose-set precision/recall, mean pick probability (decisiveness), stability across re-runs. Gates: dominance ≥ 95%, monotonicity ≥ 90%, order invariance ≥ 90%.

7. **Bugs and defects.** Arbitrary tie-break presented as "plurality" (findings text, `-6-report.png`). Green "Yes" on loose-set KPI with 3/4 rejections. "Loose set" label applied to TECH/STAPLES in Worth opening. Triple title. Twelve-column grid loses Debt/Cash/Equity off the right edge at 1108px (`-3-stage-scored.png`). Tickers title-cased in the answer list ("Nvda"). `best_value` heading raw snake_case. 700.5% unlabelled multi-year growth.

8. **Top 5 actions.**
   1. Replace the plurality/tie-break with a composite rank and fix the comparability KPI to a 2×2 [S][demo-only].
   2. Put computed multiples on the item as a comp dot-plot with pick probabilities [M][demo-only view].
   3. Restructure questions: identify most-expensive and cheapest first; per-item options; re-record [M][demo-only + small runtime support for per-item options].
   4. Build the ~100-item set with dominance, perturbation, order-shuffle and name-blind twins [L][demo-only].
   5. Until then, badge the page "illustration · 4 peer sets" and remove fraction-of-four KPIs from the headline [S][demo-only].

---

## Domain summary

**Cross-demo patterns**

1. **Unlabelled does not have to mean soft, and currently it does.** Only 163 uses hard truth (arithmetic). The others use hand-set thresholds with tiny n: 162 agreement on n = 9; 164 on n = 10 against a top-coded formula; 166 on n = 4 with an arbitrary tie-break; 161 with a bar that cannot fail (16 of 16) and one inflated by auto-true options (68.8% → 46%). A common toolkit would lift all five: **perturbation/monotonicity twins, order- and name-invariance twins, self-consistency checks between questions, boundary-distance-aware agreement, rank correlation instead of band agreement, re-run stability, and n with an interval on every tile.**
2. **Un-anchored yes/no and band questions, in both directions.** LEFTOVERS names `investigate` in 165 (all-yes). The same disease appears as all-no in 161's `data_sufficient` (78 of 96 no; 54 of 72 with full statements), as criteria-free bands in 164 (`cut_risk_12m`, `first_to_break`), and as unattributable referents in 166. Every noul needs a stated bar, and every report needs the 2×2 rather than one flattering cell.
3. **Argmax hides the model's real signal.** 165's probabilities rank almost perfectly (AUC 0.986) while the argmax report reads as failure; 163's confidence is *inversely* related to correctness and the curve hides it; 166's picks are 39–62% and shown as certainties. This domain, more than any other, needs the threshold slider, a reliability chart and probability bars on the verdict card.
4. **"No data" is scored as "bad".** Funds, gold and bitcoin appear as "Very poor quality" (162), "Very high cut risk" (164) and drag every distribution. N/A must be a first-class outcome.
5. **Reputation leakage.** Twelve of sixteen instruments are the most-written-about companies on earth, repeated across five demos. A name-blind twin run is cheap and would be a genuinely novel, quotable result.
6. **The stage never shows the evidence next to the answer.** Computed ratios exist only in reports; 163 computes per-item ratios and drops them; 161 and 165 show blank numbers or raw JSON. One shared "computed here, not sent to the model" band on the item view would fix four demos.
7. **Shared sample, shared blind spots.** The same 16 tickers mean banks (null cash-flow lines), XOM (null debt) and four non-issuers recur as gaps in every demo; effective n is 9–10 everywhere.

**Flagship pick: 163 · Sharia screening.** It has the clearest ten-second premise (same company, three rule sets, three verdicts), real checkable truth with a meaningful n (105 ratio calls), genuinely interesting errors (wrong denominator; false passes on banks; JPM's activity answer changing with the ratio standard), a distinctive audience that few model demos serve, and the most natural signature visual. It needs an item view and an expected-verdict grade, not a new dataset. Runner-up: 165, once the rank metrics and slider exist — "review 52 of 120, catch 34 of 37" is the best closing number in the domain and the best proof of the re-runnable-benchmark idea.

**Signature visual for the domain: the ruled ladder.** Horizontal bars with a limit tick — value against a stated bar, the model's call pinned at the end, ✓/✗ against arithmetic done on the page. It generalises across the domain: ratio vs Sharia limit (163), payout vs 100% cover (164), receivables growth vs revenue growth (165), multiple vs peer median (166), cash conversion vs 0.9 (162), volatility vs the goal's tolerance (161). One component, six demos, and it makes the domain's claim visible in a single glance: *every judgement sits next to a number you can check.*
