# Domain review 4 · Crypto and on-chain

Demos covered: 131 wallet-risk · 132 wallet-profiling · 133 mixer-tracing · 134 token-screening · 135 sybil-clusters.

Method: read each `demo.js`, `notes.md`, PRP, the label files, the computed report dumps and screenshots 1/3/5/6/7; then re-joined `fixtures.json` answers with the labels in a throw-away script (outside the repo) to compute numbers the reports do not show (per-cohort decisions, AUC, calibration bins, rule baselines, threshold sweeps). Every number quoted below that is not in the report JSON comes from that re-join and is reproducible from `demos/<id>/fixtures.json` + `data/synthetic/<id>.labels.json`. Global findings 1–10 from the brief are not repeated.

---

### 131 · Wallet risk scoring (`wallet-risk`)

**Scores (0–10):** Story clarity 6 · Item stage 2 · Answers-to-decision legibility 4 · Report and charts 4 · Presenter readiness 2 · Evaluation rigour 3 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "Before the deposit lands, the model tells you which wallets are dirty, why, and how much money that holds back — and it does not punish a market maker for being big." First paint (`wallet-risk-1-landing.png`) shows a title, a recorded-answers banner, and a two-column key/value dump of W-0001 (Address, Age Days, Total Received 15,200 …). No risk, no counterparty mix, no money-at-stake lane. It does not land.

2. **Item stage review.** The PRP's step 1 is "a wallet opens with its counterparty mix". The mix is the one thing the stage never shows: `QueueView.jsx:10-11` keeps only simple values and `slice(0, 12)`, so the `counterpartyMix` array is dropped and facts 13–14 (`transactionsLast30Days`, `receivedLast30Days`) are cut. What survives is a flat list where `Hops To Flagged Entity 2` has the same weight as `Address`. Money is unformatted (`38,081.51`, `15,200`, no currency).
   - Promote: deposit offered (hero number, USD), counterparty mix, hops to nearest flagged entity + which entity, age, 30-day activity vs lifetime.
   - Hide/demote: full address (truncate to `0xDEMO…645c`), largestCounterparty (redundant with the mix).
   - Bespoke visual — "deposit slip + exposure strip": left, a deposit card (`$38,082 · Ethereum · wallet 2y 11m old · 294 tx`). Centre, a single 100% stacked horizontal bar of the counterparty mix with fixed semantic colours (exchange = neutral blue, bridge = teal, unknown = grey, gambling = amber, mixer/sanctioned = red) and share labels in-bar. Under it a "hop ruler": five dots from the wallet to the nearest flagged entity, the flagged entity's dot red, with `2 hops · SANCTIONED_ENTITY_B`. Right, after scoring: a 0–6 risk gauge with the desk's bar at 3.6 drawn on it, the driver chip, and a lane stamp ACCEPT / REVIEW / REJECT. The PRP's "three lanes with the amount at stake in each" should exist as a persistent three-column strip above the stage (count + $ per lane, filling as items play).

3. **Answers and evaluation strip.**
   - `risk` is well formed but uncalibrated against its own rubric: planted-high wallets score 3.80–5.28, medium 2.65–3.42, low 1.94–3.36. 198 of 200 low wallets land in the "medium" band.
   - `main_exposure` has a structural flaw: the state always names `nearestFlaggedEntity` even at 5–7 hops, and the model echoes it. On the 186 everyday wallets the driver named was SANCTIONED_ENTITY 63, MIXER 32, GAMBLING 8, EXCHANGE 71, NONE 12 — i.e. **103 of 186 ordinary wallets (55%) were given a bad-actor driver**. The report only grades the driver on the 18 high wallets ("18 of 18"), so this is invisible. Either drop the entity name beyond 3 hops or grade driver = NONE/EXCHANGE on the clean cohort.
   - `exposure_direct` duplicates `hopsToFlaggedEntity ≤ 1` (answers: yes on exactly the 12 mixer/sanctions wallets, no on everything else). It is a lookup, not a judgement. `activity_consistent` said "no" on the 12 mixer/sanctioned wallets and 14 everyday ones and "yes" on all 14 decoys — useful, but never used in the report.
   - `evaluate()` emits `accepted` and `rejected` as separate booleans next to `decision` (`demo.js:89-90`) so the strip shows "Accepted ✓ No · Rejected ✓ No" beside "Decision review" — three renderings of one fact (`wallet-risk-5-evaluation.png`), and "Consistent ⚠ Yes" is amber although yes is the good answer.
   - The verdict card should read: `REVIEW · $38,082 held · driver: sanctioned entity at 2 hops · risk 3.29 (below the 3.6 bar) · label: medium — agrees`.

4. **Report, charts and metrics.**
   - **The most important number is missing and the report text contradicts the data.** Re-joining answers and labels: low-band wallets were held for REVIEW 70 of 200 times, **$6,313,578** of ordinary deposits delayed. Of the 14 "looks bad, is not" decoys, **11 were held for review and only 3 accepted ($4,593,399 of $8,227,064 held)**, including two of the five market makers (W-0032 $1,975,736, W-0222 $376,528), all five bridge relayers and all four dormant-then-active wallets. `notes.md` says "the market makers and bridge relayers went straight through" and the checks show "Big, busy, ordinary wallets refused 0 of 14" — true only because the check counts REJECT, not REVIEW (`demo.js:167-169`). The report's own "Worth opening" list exposes it: 8 of the 10 largest held deposits are labelled "low risk". A deposit desk measures friction; "held" is the cost. Add KPI "Ordinary deposits held: 70 of 200 · $6.3m" with warn tone, and change the decoy check to "held or refused".
   - "Band agrees with the label 15.4%" is a headline KPI with no tone that reads as catastrophic, sitting next to "A bar that splits the file 3.6 of 6" which says the opposite. Lead with separation: AUC high-vs-rest = 1.000; medium-vs-low AUC = 0.891 (the notes claim these "overlap almost completely" — they overlap in range but rank fairly well). Replace the band KPI with "Rank quality (AUC) 1.00 · rubric offset −1.1 points" and move the rubric mismatch into a calibration plot.
   - **Dataset too easy / rule baseline.** A three-line rule (`hops ≤ 1 or mixer/sanctioned in mix or gambling > 50% → high; hops = 2 or gambling ≥ 10% → medium`) scores 237 of 240 on the band label. The hop number plus the mix is the label. The PRP acceptance item "report shows how much of the decision hop distance explains" is unmet, and a baseline row is mandatory here.
   - The 3.6 bar is fitted on the same 240 wallets it is evaluated on (`split()`, `demo.js:140-154`); it is an in-sample threshold presented as a finding.
   - Decision confidence is poorly calibrated: 156 of 240 decisions have confidence < 0.5 (mean 0.34) yet are "right" 63% of the time; ECE ≈ 0.27.
   - Charts that fit: (a) a **strip/beeswarm of risk score by planted cohort** (x = 0–6 score, rows = high-mixer, high-sanctions, high-gambling, medium, decoy, everyday; draggable vertical bar; rubric words on the axis) — this single chart tells both the "bar at 3.6" and the "scale used in its middle" stories. (b) **Money by lane**: stacked bar of $ accepted / held / refused split by true cohort. (c) driver confusion over all 240, not only the 18. The current curve plots "caught" against "wallets held" with no ticks; its x axis runs from 240 down to 0 held, which reads backwards.
   - Data realism: 76 of 240 wallets offer a deposit larger than everything the wallet has ever received, 145 offer more than their balance (W-0001: balance 3,192, offering 38,081.51). A practitioner will spot that instantly.

5. **Bespoke Present screen.**
   - Beat 1 — "The deposit": W-0151 ($218,926, mixer 56% of flow, 0 hops). Exposure strip fills red, gauge lands 5.25, stamp REJECT, driver chip "mixer".
   - Beat 2 — "Big is not dirty": W-0033, a market maker with $68.5m received offering $1,854,483; mix all exchange, 5 hops; gauge 2.62, ACCEPT. Caption: "Size is not exposure."
   - Beat 3 — "The honest miss": W-0032 ($1,975,736 market maker) held for REVIEW at 2.78. Caption: "$4.6m of clean money waited for a human."
   - Beat 4 — "One bar": the cohort strip plot, bar sweeps to 3.6; 18 red dots right, 222 left.
   - Closing number: **"18 of 18 dirty deposits stopped — $938,805 — with one line at 3.6."** Sub-line: "$6.3m held for a second look."

6. **Re-runnable model test.** Benchmark card per run: AUC high-vs-rest; recall of high at the *frozen* bar (3.6, carried from the previous run, not re-fitted); $ and count of low-band wallets held and refused; decoy hold rate; driver accuracy on high **and** bad-driver rate on clean; rubric offset (mean score per band vs rubric midpoint); decision-confidence ECE; rules-baseline accuracy alongside. Gates: high accepted = 0 (hard fail); clean held ≤ 15%; decoys held ≤ 3 of 14; bad driver on clean ≤ 10%. Slices: by driver, by decoy look, by chain, by deposit size decile. Dataset changes: add high-risk wallets that the hop/mix rule misses (2-hop peel chains with large value, mixer share of 8–15%), and clean wallets at 1 hop (an exchange customer who once received from a since-listed address); stop naming the nearest entity when it is ≥ 4 hops away; fix deposit-vs-balance realism; hold out a second seed for the threshold.

7. **Bugs and defects.** Counterparty mix never rendered (`wallet-risk-3-stage-scored.png`); `Amount Offered 38,081.51` without currency while the title says `$38,082`; KPI "$5,649,8 / 95" wraps mid-number (`wallet-risk-6-report.png`); "Consistent ⚠ Yes" amber for a good answer; triple decision rendering; check label "Sanctioned entity exposure accepted 0 of 6" reads as a bad thing with a green tick; `findings` is empty although the largest finding (70 clean deposits held) exists; present mode is the same key/value dump (`wallet-risk-7-present.png`).

8. **Top 5 actions.**
   1. Count REVIEW as a cost: add "ordinary deposits held" KPI/finding, fix the decoy check and the `notes.md` claim. [S] [demo-only]
   2. Build the deposit-slip + exposure-strip + hop-ruler view; render `counterpartyMix`. [M] [demo-only, new view]
   3. Replace band-agreement KPI with cohort strip plot + frozen bar + rules-baseline row. [M] [shared-runtime widget, demo data]
   4. Grade the driver on all 240; stop leaking the entity name at distance. [S] [demo-only, needs re-record]
   5. Harden the dataset (rule-beating highs, 1-hop innocents, realistic balances). [L] [demo-only]

---

### 132 · Wallet behaviour profiling (`wallet-profiling`)

**Scores (0–10):** Story clarity 6 · Item stage 1 · Answers-to-decision legibility 4 · Report and charts 6 · Presenter readiness 2 · Evaluation rigour 3 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "From ninety days of behaviour alone — no labels, no names — the model says what kind of actor a wallet is, and admits when it can't." First paint (`wallet-profiling-1-landing.png`) is a generic table whose numeric cells are **blank**: Observation Days, Transactions, Inbound, Outbound, Counterparties show no value at 1440px. The fingerprint — the whole idea — is a wall of JSON below the fold.

2. **Item stage review.** `TableView` prints `hourOfDay` as `[{"hour":0,"count":9},…]` over four lines, `amountBuckets`, `gas`, `interactions`, `amounts`, `fundingSources` as raw JSON, and clips long ones at the right edge (`wallet-profiling-3-stage-scored.png`). This is the worst stage in the domain because the data is *made* to be drawn.
   - Bespoke visual — "the fingerprint card", a fixed 2×3 grid of small multiples so every wallet has the same silhouette: (1) **24-bar hour-of-day histogram** (UTC, shaded night band) — flat for a bot, evening hump for retail/scam collector (WPF-0001 peaks 119 at 18:00); (2) **in/out butterfly bar** (874 in vs 1 out is the scam-collector tell; 2,264 in vs 17,078 out is the exchange); (3) amount-bucket bars (under $100 … $10k+) with a round-amount share badge; (4) gas dial: multiple of network mean and replacement rate; (5) three horizontal meters — same-block share, paired in/out share, fixed-contract share; (6) funding-source age: fresh-under-7-days share as a filled ring (0.869 for the collector) with unique-source count. After scoring, overlay the **type's average fingerprint as a ghost outline** on each panel (the report already computes it in `fingerprintChart`) so the viewer sees *why* it was called a collector.
   - Hide: id row (duplicate), address (truncate), observationDays (constant 90).

3. **Answers and evaluation strip.**
   - `type_is_clear` is effectively a constant. Its probability runs 0.36–0.55 over the 190 unambiguous wallets and 0.39–0.44 over the 10 planted ambiguous ones. At the 0.5 cut the model called **163 of 190 clear-labelled wallets "unclear"** (every exchange, market maker, retail, bridge and 32 of 33 scam collectors). AUC of "unclear" for detecting the planted ambiguity is 0.666. The first item shows the absurdity: WPF-0001 is called scam collector with **confidence 1** and "ambiguous" in the same label (`wallet-profiling-5-evaluation.png`).
   - Consequently the headline "Ambiguity handled fairly 10 of 10" is vacuous: the grader passes any wallet marked unclear (`demo.js:74-77`), and everything is marked unclear. Three of the ten were named a type that is *neither* neighbour (WPF-0020 → bridge, WPF-0063 and WPF-0139 → market maker) and still pass. A better ambiguity signal already exists: the type confidence on the five retail/MEV boundary wallets is 0.10–0.29, versus ≥ 0.9 on 69 clear wallets. Grade ambiguity with choice entropy / top-two probabilities (is the planted neighbour in the top two?), and drop or re-word the noul.
   - `monitoring_level` is graded against `MONITORING_BY_TYPE` (`demo.js:6`), a mapping that is **not in the state**; the state's policy only defines the three levels. The model answered CONTINUOUS for 172 of 200 wallets and never NONE (retail: 28 PERIODIC, 5 CONTINUOUS, 0 NONE). "Monitoring agrees 50%" is therefore the share of types whose hidden mapping happens to be CONTINUOUS. Either put the type→level policy in the state or remove the metric.
   - `automation` labels are a constant per type (exchange 6, MEV 6, MM 5, bridge 5, collector 3, retail 1), so MAE 0.79 is a second type lookup; the scores are compressed to 3.3–5.2 for every non-retail type (exchange labelled 6 scores 4.54–4.90). Report rank correlation and per-type bias instead of one MAE.
   - Verdict card: `Scam collector · 100% · next best: retail 0% · automation 3.3/6 · monitor: continuous · label: scam collector — agrees`.

4. **Report, charts and metrics.**
   - 91.1% (173/190) is honest and the confusion matrix is the right centrepiece; the clickable cells are the best report feature in the domain. The real story is one cell: **14 of 34 market makers called exchange** (MM recall 58.8%; exchange precision 29/46 = 63%). The misread market makers have outbound ≈ 2× inbound (WPF-0007: 12,503 in / 26,157 out) — not the "balanced two-sided flow" the option text describes — and they were wrong *with higher confidence* (median 0.69) than the correct ones (median 0.39). That is either generator noise or a real blur; the report should show the two fingerprints side by side and say which.
   - Missing: per-class precision/recall/F1 table, macro-F1 (accuracy hides the MM collapse), always-majority baseline (17%), a nearest-centroid baseline on the six fingerprint metrics (it will be close to 100% — the types are separated by design: MEV same-block 80% vs ≤ 23% elsewhere), reliability diagram (type confidence bins: <0.5 → 79% right, 0.5–0.7 → 91%, 0.7–0.9 → 88%, ≥0.9 → 100%; ECE ≈ 0.16, under-confident at the low end).
   - "Clear wallet types correct 91.1%" is toned `warn` because tone is `good` only at 100% (`demo.js:84`) — a 91% headline rendered as a warning undermines it; use a gate (≥ 90% good).
   - Fingerprint table is good but belongs as a **radar or parallel-coordinates small multiple per type**, and "Gas premium" is clipped at the right edge (`wallet-profiling-6-report.png`). The distribution bar is six identical grey segments.
   - Data defect: 13 of 200 wallets have `p95Usd < medianUsd` (WPF-0004: median 1,423.87, p95 1,205.60) — impossible; fix the generator.

5. **Bespoke Present screen.**
   - Beat 1 — "A day in the life": WPF-0017 (MEV bot) hour histogram flat at ~750–890 per hour, same-block 73%, gas 3.2× network. Type chip lands "MEV bot · 100%".
   - Beat 2 — "The collector": WPF-0001 — butterfly bar 874 in / 1 out, 87% of funders younger than 7 days, 644 payments under $100. Chip: "Scam collector". Caption: "Nobody told it. It read the shape."
   - Beat 3 — "Six silhouettes": the six average fingerprints side by side; 200 wallets fly into their type column.
   - Beat 4 — "Where it blurs": matrix zooms to the market-maker → exchange cell (14), opens WPF-0007 next to WPF-0002 with differences highlighted (in/out ratio).
   - Closing number: **"173 of 190 named from behaviour alone — and the 17 misses are one confusion."**

6. **Re-runnable model test.** Card: accuracy, macro-F1, per-class P/R, the MM→exchange cell tracked by name, ambiguity score = share of planted-ambiguous wallets whose true pair is the model's top two *and* whose top-1 confidence < 0.6, false-ambiguity rate on clear wallets, ECE, monitoring agreement (only once the policy is in the state), centroid-baseline accuracy. Gates: macro-F1 ≥ 0.90; scam-collector recall = 100% (the costly miss); false-ambiguity ≤ 15%. Drift: per-cell delta of the confusion matrix versus the previous run. Dataset: 10 ambiguous wallets is too few for a stable rate — raise to ≥ 40 across all adjacent pairs (MM/MEV is in the PRP's video beat but not planted); vary the automation label within type; add adversarial collectors that drip funds out; fix the p95/median bug.

7. **Bugs and defects.** Numeric cells blank/clipped in the item table — "Turnover Usd" shows `2,44` cut at the edge (`wallet-profiling-1-landing.png`, `-3-stage-scored.png`); raw JSON in five rows, clipped without wrap for `interactions`; "Clear ✓ No" in green with title "ambiguous" and confidence 1 on the same card; "Mev bot" casing (should be "MEV bot"); fingerprint table last column clipped; matrix title includes an instruction in parentheses; ten "Worth opening" rows all read "(unclear)" giving away that the flag is constant.

8. **Top 5 actions.**
   1. Build the fingerprint card view (histogram, butterfly, buckets, meters, ghost overlay). [M] [demo-only, new view]
   2. Replace the vacuous ambiguity KPI: grade with top-two probabilities; report "clear wallets called unclear 163 of 190" until fixed. [S] [demo-only]
   3. Put the monitoring policy in the state or delete the 50% KPI. [S] [demo-only, re-record]
   4. Add per-class P/R/F1 + macro-F1 + centroid baseline; tone gates instead of 100%-or-warn. [S] [demo-only]; reliability diagram widget [M] [shared-runtime]
   5. Fix generator (p95 < median, MM in/out balance), enlarge the ambiguous set. [M] [demo-only]

---

### 133 · Tracing and mixer exposure (`mixer-tracing`)

**Scores (0–10):** Story clarity 8 · Item stage 4 · Answers-to-decision legibility 5 · Report and charts 5 · Presenter readiness 3 · Evaluation rigour 5 · Re-run/benchmark readiness 6

1. **The one-sentence value.** "Follow the money back hop by hop, apply the desk's own written rules, and say how close this wallet is to funds you cannot take." First paint shows a radial graph — the only demo in the domain with a drawn object — so it half lands; but the mixer node is the same grey circle as two anonymous wallets (`mixer-tracing-3-stage-scored.png`), there are no amounts or dates, and the rules the demo is about are nowhere on screen.

2. **Item stage review.**
   - `GraphView.jsx:21` caps hop distance at 2 and `RINGS` has three radii, so every wallet 3–5 hops back is placed on the same outer ring. **53 of 90 traces have a path longer than two hops.** The quantity being judged — distance — is exactly what the drawing flattens. The title also says "1 hops".
   - Nodes carry no entity styling: `MIXER_A`, `EXCHANGE_C`, `BRIDGE_D` and `SANCTIONED_ENTITY_B` all render as the default circle. Edge amounts live only in the collapsed "Transfers as a table".
   - Bespoke visual — "the trace board": left-to-right **lane diagram**, one lane per funding path, lane height ∝ share of funding (78% / 13% / 9% for TRC-001). Subject on the right edge; columns are hops 1…5 with a vertical dashed **"act within 3 hops" line** after column 3 (rule 1). Each hop is a pill with truncated address, amount and date; entity pills are iconified and coloured: mixer/sanctioned red, exchange green with a "KYC — breaks chain" shield and the lane rendered dashed/greyed to its left (rule 2), bridge teal with a "does not break" chain-link (rule 3). A hop that passes on more than it received gets a red "Δ +$…" badge on the link (rule 4). The four rules sit as a legend strip above the board and light up when the model's answer invokes them. This satisfies the PRP acceptance item "highlights the path from the subject to the labelled entity, hop by hop", which the current view does not.

3. **Answers and evaluation strip.**
   - Five questions, well chosen, and the rule-in-state design is the most gradeable idea in the domain. Problems:
   - `chain_broken_by_exchange` presupposes a source. On the 47 "nothing found" traces the model said yes on 25 — exactly the 25 that have an exchange somewhere on a path. It is answering "is there an exchange", which is reasonable for the wording. Add "there is no source on any path" semantics or grade only where a source exists.
   - `tainted_funds` at the 0.5 cut: 34/34 found, 24/56 false. But the probability ranks almost perfectly (AUC 0.995): clean "nothing found" traces sit at 0.32–0.64, tainted at 0.73–0.93. **At 0.7 it is 34 true, 4 false; at 0.8, 25 true, 0 false.** The notes conclude "act on the score and treat the yes/no as a first pass"; the better reading is that the noul has a +0.2 offset and needs a calibrated cut — which is precisely the argument for a threshold slider on nouls.
   - `action` is incoherent with the other answers and the report hides it: **72 of 90 frozen ($19.7m)** versus 34 truly tainted; 16 traces were called *clean* and frozen anyway; 2 were called tainted and cleared (the two CLEARs among the exchange-breaker traces, TRC-060 and TRC-069); `REPORT_INTERNALLY` was never chosen in 90 answers. "Funds held $19,701,890" is shown as a neutral KPI; it should be "Frozen: 72, of which 38 clean ($11.6m)" with warn tone, and the unused option flagged.
   - `hops_to_source`: FOUR_PLUS was never predicted (0 of 6; all called THREE) although rule 1 makes the three/four boundary the decision boundary. 5 clean traces were given hops = ONE.
   - Verdict card: `Tainted 0.82 · mixer at 1 hop · 78% of funding ($6,621) · no break · exposure 4.3/6 · FREEZE — label agrees`.

4. **Report, charts and metrics.**
   - **A finding is wrong.** "9 traces treated a bridge as if it broke the chain" (`demo.js:190`) counts any trace with `BRIDGE_D` seen and `brokenByExchange` = yes. Five of those nine are the planted exchange-breaker traces (TRC-004, -007, -021, -032, -042) where "yes" is the *correct* answer, and the other four (TRC-011, -057, -059, -079) contain both an exchange and a bridge. There is no evidence of a single bridge-as-break error. The check must test traces with a bridge and **no** exchange between subject and source.
   - **The proudest claim is unfalsifiable.** "8 of the 8 traces whose amounts do not add up were caught … the hardest to see." All eight of those traces also contain `MIXER_A` or `SANCTIONED_ENTITY_B` on the path, and their exposure scores (4.09–4.81) are indistinguishable from the ordinary 2–3-hop traces (4.06–5.10). They would be called tainted with the arithmetic ignored. Three are FOUR_PLUS hops — outside rule 1's action window — and still labelled tainted. To test rule 4, plant amount breaks on paths with **no** labelled entity (tainted only by arithmetic), and conversely mixers at 4+ hops that rule 1 says not to act on.
   - **The exchange rule is applied — by the score.** KPI "The exchange rule applied 0 of 9" is computed on the yes/no only. The nine breaker traces score 2.31–3.82 on exposure, all below the 4.0 bar, versus 4.06+ for unbroken paths. So the PRP's video beat ("the exchange in the middle, and the score dropping") is true in the data and the report presents it as a total failure. Show both: "rule applied by yes/no 0 of 9 · by exposure score 9 of 9".
   - Headline KPIs should be: recall 34/34, precision at 0.5 = 58.6% (34/58), precision at the exposure-4 bar = 100% (34/34, in-sample), hops exact 82.2%, clean money frozen. Missing: a no-model rules baseline (walk the path; tainted if a red entity is reached with no exchange before it) — it scores 100% on taint by construction, which must be stated so the demo's claim becomes "the model reads rules from prose", not "the model finds mixers".
   - Charts: replace the generic curve with a **two-row strip plot** (exposure score and noul probability) with cohort colours (1-hop, 2–3 hop, amounts-break, exchange-broken, nothing found) and the two bars; add a hops confusion matrix (exists; note `Four plus` column is empty) and a **rule scorecard** — four rows, one per desk rule, each "obeyed n of m" with example trace chips.
   - Hops confidence is under-confident: 45 of 90 answers below 0.5 confidence are right 71% of the time; ECE ≈ 0.26.

5. **Bespoke Present screen.**
   - Beat 1 — "Three hops": TRC-083 ($828,837, sanctioned entity at three hops). Lane board draws hop by hop right-to-left; the red pill appears at column 3, just inside the dashed line. Exposure 4.59, FREEZE.
   - Beat 2 — "The exchange in the way": TRC-069 ($539,414): same picture but a green KYC pill at hop 1; lane to its left greys out; exposure drops to 2.31, CLEAR. Rule 2 lights up.
   - Beat 3 — "The sum that doesn't work": TRC-002 ($577,474): hop 3 holds $375,100 and hop 2 passes on $669,821; red Δ badge pulses. Rule 4 lights up.
   - Beat 4 — "The line": strip plot of 90 exposure scores; bar lands at 4; 34 red right, 56 left.
   - Closing number: **"34 of 34 tainted traces, zero clean ones, at exposure 4 of 6."** Honest sub-line: "The yes/no alone would have frozen $5.7m of clean money."

6. **Re-runnable model test.** Card: taint recall; precision at the frozen noul cut and at the frozen exposure bar (both carried from the previous run); AUC for both; hops exact and ±1; **per-rule obedience** (rule 1 window, rule 2 exchange break by yes/no and by score, rule 3 bridge, rule 4 arithmetic — each on traces where only that rule decides); action coherence (share of actions consistent with the taint answer); option usage (flag any option never chosen); clean $ frozen. Gates: recall = 100%; clean frozen ≤ 10%; every rule ≥ 80% on its isolating slice. A/B slot: "rule stated once in a list" vs "rule repeated beside the evidence" — the notes already propose this and it is the perfect regression pair. Dataset: 90 items with cohorts of 8–14 is thin (one flip = 7–12 points); go to ≥ 300 with ≥ 30 per rule-isolating cohort; add the isolating cohorts above; 600-wallet graph and seed already make it repeatable.

7. **Bugs and defects.** Hops > 2 collapse onto one ring (`GraphView.jsx:21`); entity nodes unstyled (`mixer-tracing-3-stage-scored.png`, `-7-present.png`); "1 hops"; site header overlaps the top of the stage card and hides "Item 1 of 90" in `-3-stage-scored.png`; false bridge finding; "Worth opening" shows "tainted · none found · freeze" (TRC-058, a true tainted trace whose hop answer was NONE_FOUND — self-contradictory answer, worth its own check); label row "TRC-069 · tainted · two · clear · actually clean" is unreadable as a sentence; KPI "$19,701, / 890" wraps; present mode shows the graph with a large empty band above it and nothing else.

8. **Top 5 actions.**
   1. Fix the false bridge finding; report the exchange rule by score as well as by yes/no; surface "clean but frozen" and the unused REPORT_INTERNALLY. [S] [demo-only]
   2. Build the left-to-right trace board with entity pills, amounts, the 3-hop line and rule badges. [L] [demo-only, new view; GraphView hop cap is [S] shared-runtime]
   3. Plant rule-isolating cohorts (arithmetic-only taint, 4+-hop mixers, bridge-without-exchange) and re-record. [M] [demo-only]
   4. Noul threshold slider + two-row strip plot. [M] [shared-runtime]
   5. Rule scorecard widget + rules-engine baseline row. [M] [shared-runtime widget, demo data]

---

### 134 · Token screening (`token-screening`)

**Scores (0–10):** Story clarity 6 · Item stage 1 · Answers-to-decision legibility 5 · Report and charts 4 · Presenter readiness 2 · Evaluation rigour 3 · Re-run/benchmark readiness 3

1. **The one-sentence value.** "Before anyone buys, the model reads the contract, the pool, the holders and the tape, and calls the trap — without throwing out the scary-looking tokens that are fine." First paint (`token-screening-3-stage-scored.png`): nine table rows, four of which are single-line raw JSON clipped at the right edge (`{"mintAuthorityPresent":false,…"blac`). The honeypot signal (`failedSellAttempts`) is off-screen inside the clipped Trading row.

2. **Item stage review.**
   - Bespoke visual — "the token sheet", four quadrants mirroring the state: **Contract** as a checklist of switches with severity icons (mint authority ✕/✓, ownership renounced, proxy upgradeable, blacklist function) plus two tax dials (buy 2%, sell 4.4%) with a red zone above the 20% norm; **Liquidity** as a pool gauge ($1.04m) with a locked-share ring (98.1%), lock-expiry date and a "largest removal" bar; **Holders** as a single 100% bar segmented creator / verified vesting / burn / other top-10 / everyone else — the vesting segment hatched with a "verified" tick so the decoy story is visible (TOK-0001: 60.3% vesting, 4% creator); **Trading** as a buys vs successful sells vs failed sells triple bar (the honeypot silhouette is 455 / 0 / 10 for TOK-0128) with a 7-day volume sparkline badge (steady/rising/bursty/falling). Chain norms appear as faint reference ticks on every gauge.
   - Hide: id, contract address (truncate), chain ("Ethereum test fixture" is an odd string to show a viewer).

3. **Answers and evaluation strip.**
   - The questions are **leading to the point of being rule restatements**. `red_flag.SELL_TAX` says "exceeds twenty per cent"; `honeypot_suspected.yes` spells out the exact pattern; and `chain_norms` in the state repeats both rules and explains both decoys ("Verified vesting contracts are not creator holdings", "A long-unmoved old pool is not itself a rug"). The model is matching sentences to fields.
   - `tradeable` contradicts `position_limit`: all 11 tax traps were answered **tradeable = yes** with position limit NONE ("do not open a position") on 10 of them; all 14 later-rugged tokens were answered tradeable (0.87–0.91) with SMALL. So **25 of 34 harmful tokens were called tradeable**. The KPI "Harmful tokens constrained 34 of 34" counts a SMALL position in a token that rugs as a success (`demo.js:85`). A retail user with a small position in a rug still loses it. Report "harmful tokens called tradeable 25 of 34" and define success as avoid (tradeable = no or limit NONE): 20 of 34.
   - `predictedOutcome` is derived by a hand rule in `evaluate()` (`demo.js:50-53`) from the flag, so "Outcome correct 94.4%" is mostly flag accuracy (149/160) re-labelled. The nine "fine called rugged" rows are low-confidence flags (0.28–0.52) on tokens the model also scored ≤ 2.18 and left at NORMAL — not really rug calls. Require flag ≠ NONE **and** risk ≥ bar to call an outcome.
   - Verdict card: `AVOID · honeypot · 455 buys, 0 sells, 10 failed · risk 5.5/6 · held-out outcome: honeypot — agrees`.

4. **Report, charts and metrics.**
   - **Dataset too easy / leakage by construction.** Feature ranges do not overlap: sell tax FINE 0–5% vs TAX_TRAP 23–51.8%; failed sells FINE 0–1 vs HONEYPOT 5–11 (successful sells 0–3 vs ≥ 129); mint authority present only in RUGGED (5/5); creator share FINE ≤ 12% vs RUGGED median 37%; one rug already shows an 81% liquidity removal in its "present-tense" history. A five-line if-else gets 153/160 with a sloppy honeypot cut and 160/160 with `failedSells ≥ 5`. "Future outcomes are held out" is technically true and practically meaningless: the future is a deterministic function of the present fields. AUC harmful-vs-fine on the score = 1.000.
   - **The curve tells the wrong story.** It tracks only RUGGED. At bar 3/6 it catches 2 of 14 rugs; rugs score just 2.59–3.12 ("Low"–"Moderate") — for tokens that later rug. The interesting operating point is 2.5: 34/34 harmful, 0 fine lost. With integer steps the chart jumps from "50 fine tokens lost" (bar 1) to "2 lost" (bar 2) to "12 rugs missed" (bar 3): the whole decision lives between two ticks. Use 0.25 steps, all harmful cohorts as separate lines, and x = fine tokens excluded (%), y = harmful caught (%) — a true ROC-style trade-off, which is what the PRP asked for ("how many good tokens you lose to catch 90% of rugs").
   - "Outcome correct 94.4%" toned warn (100%-or-warn rule again) while being the top-left KPI. Headline order should be: Honeypots caught 9/9 → Harmful avoided 20/34 (warn) → Decoys kept 18/18 → Fine excluded 0/126.
   - Missing: per-class P/R (RUGGED precision 14/23 = 61%), rules baseline row, flag accuracy on rugs (12/14: two MINT_AUTHORITY rugs named HOLDER_CONCENTRATION), reliability (flag confidence < 0.5: 74% right; ≥ 0.5: ≥ 97% — all nine false rug calls are in the low bin, so a confidence gate of 0.5 removes 8 of 9), money: pool USD protected (honeypot pools total ≈ $27.7m).
   - Distribution bar: six grey segments, no tone (`token-screening-6-report.png`). "1 verified vesting allocations were mistaken" — plural bug (`demo.js:127`). Only 10 distinct symbols across 160 tokens (DZEPH and DLUME are each two different honeypots), which will confuse any presenter.

5. **Bespoke Present screen.**
   - Beat 1 — "Buys in, nothing out": TOK-0128 (DVEXE, $3.59m pool): triple bar animates 455 buys, 0 sells, 10 failed. Stamp HONEYPOT · AVOID · 5.5/6.
   - Beat 2 — "Scary but fine": TOK-0001 (DORBI): top-10 holders 71.8% flashes red, then the holder bar splits to reveal 60.3% verified vesting, 4% creator. Stamp TRADEABLE · 1.9/6.
   - Beat 3 — "The one it got wrong": TOK-0019 — same decoy shape, flagged holder concentration at 0.45 confidence, position SMALL. Caption: "Low confidence is the tell."
   - Beat 4 — "The price of safety": the trade-off curve with the bar sliding to 2.5.
   - Closing number: **"34 of 34 traps above the line, 0 of 126 good tokens lost."** (with the caveat line "9 of 9 honeypots avoided outright".)

6. **Re-runnable model test.** Card: honeypot recall (hard gate = 100%); harmful avoided (not merely size-limited); fine excluded; decoy kept; per-class P/R/F1; harmful-vs-fine AUC; recall at the frozen bar and fine-loss at that bar; tradeable/limit coherence; rules-baseline accuracy; flag ECE. Dataset must change most in this domain: overlap the features (sell tax 12–25%, honeypots with 20–60 successful early sells then failures, fine tokens with 3–6 failed sells under congestion, renounced-but-proxy-upgradeable contracts, locked liquidity expiring in 3 days, rugs with no present-tense tell at all so the ceiling is < 100%), class balance closer to real base rates with a precision-at-k metric, unique symbols, and remove the decoy explanations from `chain_norms` for a "hard mode" slice.

7. **Bugs and defects.** Raw JSON rows clipped without wrap (`token-screening-3-stage-scored.png`); stepper pills wrapped under the title instead of right-aligned as in other demos; grey distribution bar; plural bug in finding; "Chain: Ethereum test fixture"; `threshold` in the curve is unrounded (0.16666…) unlike the other demos; 18-row "Worth opening" list of near-identical lines; KPI strip leaves 40% of the row empty.

8. **Top 5 actions.**
   1. Redefine "constrained": report harmful tokens called tradeable (25/34) and fix tradeable/limit incoherence. [S] [demo-only]
   2. Token sheet view (switches, tax dials, holder bar with vesting hatch, buys/sells/failed bars). [M] [demo-only, new view]
   3. Re-generate with overlapping features and no rule restatement in options/norms; add rules baseline. [L] [demo-only, re-record]
   4. Trade-off curve: all harmful cohorts, 0.25 steps, ROC axes, draggable bar. [M] [shared-runtime]
   5. Confidence-gated outcome derivation + per-class table. [S] [demo-only]

---

### 135 · Sybil clusters (`sybil-clusters`)

**Scores (0–10):** Story clarity 5 · Item stage 2 · Answers-to-decision legibility 3 · Report and charts 4 · Presenter readiness 1 · Evaluation rigour 4 (for honesty; the test itself is broken) · Re-run/benchmark readiness 2

1. **The one-sentence value.** "Before the airdrop goes out, find the 62 wallets that are really eight people — and don't take the allocation from the 88 who earned it." The current run cannot land it: **0 of 62 excluded, $0 saved, $186,373 paid, $69,026 of it to the farmers.** The notes say so plainly, which is to their credit, but a featured suite cannot ship a demo whose headline is "nothing happened". This needs a re-record before any design work.

2. **Item stage review.**
   - `QueueView` `slice(0, 12)` cuts three of the five crowd counts — "same action sequence", "created within ten minutes", "same gas price" never appear — and the `actionSequence` array is dropped entirely (`sybil-clusters-3-stage-scored.png` ends at "Wallets With The Same Withdrawal Endpoint 1"). For a wallet in a timing or gas cluster the stage shows *no evidence at all*.
   - The PRP specifies `view: graph` and the beat "eight clusters forming as wallets are classified"; the demo ships `view: 'queue'`. A cluster demo with no picture of a cluster is the biggest gap between spec and build in the domain.
   - Bespoke visual — two-pane "the crowd": left, a **persistent 150-dot population field** laid out by creation time (x) and gas price (y); as items are answered, dots recolour by the model's linking signal and draw faint links to a shared hub (funder node, endpoint node, a "same minute" bracket, a "same sequence" ribbon); planted clusters become visible as the run proceeds, the 36-wallet exchange hub stays neutral-coloured with an "exchange" badge. Right, the current wallet's **five-signal similarity meter**: five rows (funding / timing / sequence / gas / endpoint), each "shared with N of 150" on a log bar with the population median ticked (the baseline the notes say is missing), plus the action sequence as five chips and gas as mean ± stdev (a stdev of 0 across 7 wallets at 12.475 gwei is the C7 tell).

3. **Answers and evaluation strip.**
   - `exclude_from_allocation` never crosses 0.5: the probability runs 0.26–0.46 across all 150. The option text ("Give it the allocation. Doubt is not evidence.") plus the state's rule ("excluding a real user costs more…") push one way; the question is leading toward "no". Lowering the cut does not rescue it — AUC is 0.639 (at ≥ 0.35: 47 farmed vs 44 real).
   - `sybil_likelihood` AUC = 0.767 — better than the notes suggest ("does not separate") but far from usable; farmed 3.32–4.31, exchange decoys 2.95–3.69, guide-followers 3.74–3.97, independents 3.00–4.36.
   - `linking_signal` "62 of 62" is **not a finding**: it is the argmax of the five counts in the state. A one-line baseline (largest count > 1) also scores 62/62. Meanwhile on real users the model named a signal 81 of 88 times (67 funding source). The state even labels the hub `0xDEMO_EXCHANGE_HOTWALLET` and the model still called it a link.
   - A second, **unlabelled decoy exists**: 13 independents share one withdrawal endpoint — and it is the *same* `0xDEMO_EXCHANGE_HOTWALLET` address (users cashing out to the exchange). The model flagged 8 of them WITHDRAWAL_ENDPOINT. It is not in `notes.md` or the checks.
   - The fundamental design issue: per-wallet judgement with anonymous counts cannot recover *clusters* (which wallets belong together). Either pass a cluster candidate as the item (the 9 wallets sharing funder 6920, as a table) and ask "one operator?", or keep per-wallet items but include hashed group keys so the report can assemble clusters.
   - Verdict card: `EXCLUDE? 0.41 — no · likelihood 4.05/6 · link: funding source (shared with 9) · $949 at stake · label: farmed, cluster C1 — missed`.

4. **Report, charts and metrics.**
   - The KPI strip is honest and well composed (savings and harm side by side; the false-signal rate placed next to the 62/62). But "Real users excluded 0 of 88" in **good** tone and "Farmed wallets excluded 0 of 62" with **no** tone is misleading: both are the same degenerate all-"no" output. When a classifier predicts one class, show a single banner "No wallet was excluded — precision/recall undefined" instead of a green tile.
   - `findings` is empty (every branch in `findings()` requires an exclusion), so the most important sentence in `notes.md` has no on-page equivalent. Add: "Nothing was excluded: $69,026 went to eight farmers."
   - Notes vs data: notes say "forty-three wallets share the exchange hot wallet" — the data says 36 (`walletsWithTheSameFundingSource: 36`); notes say "$73,000 to the eight farmers" — the data says $69,026.
   - A no-model rule (largest count ≥ 5, ignoring the labelled exchange hub) excludes 62/62 farmed and 19/88 real (the 6 guide-followers + the 13 exchange cash-outs). That is the baseline to beat, and the guide-follower case is where a model *could* add value (their gas variance 5.9–9.9 and scattered creation dates distinguish them from C5/C6) — make that the story.
   - Charts: **cluster recovery bars** (8 rows, found/total per planted cluster, coloured by signal) — currently crammed into a KPI context string "C1: 0/9 · C2: 0/8 · …"; **savings vs harm curve** with $ on both axes (x = $ taken from real users, y = $ saved from farmers) rather than counts; the 6×6 signal matrix is fine but its only off-diagonal mass is the `None` row (67/6/8) — it should be re-framed as "signals claimed on real users". The current curve is a nearly straight diagonal (no separation) with no ticks; first four points are identical (150 wallets at bars 0–2).

5. **Bespoke Present screen** (to be recorded after the state fix; ids are valid today).
   - Beat 1 — "150 wallets, one allocation": the population field, all grey, "$186,373 to pay out".
   - Beat 2 — "One funder, nine hats": SW-004 opens; meter shows funding shared with 9; nine dots (C1: SW-004, -013, -018, -051, -077, -086, -092, -126, -144) link to funder 6920 and turn red. "$10,812 saved" (sum of C1 allocations; compute live).
   - Beat 3 — "Seven wallets, one gas price": SW-008 and the C7 set — 12.475 gwei, stdev 0 — snap into a horizontal line on the gas axis.
   - Beat 4 — "Same exchange is not same person": SW-001 and the 36-wallet hot-wallet hub stay neutral; then "same guide is not same person": SW-014's sequence ribbon with six wallets stays grey.
   - Closing pair of numbers (the PRP's own beat): **"$69,026 kept from 8 farmers · 0 real users turned away"** — only if the re-record earns it; otherwise close on the honest pair.

6. **Re-runnable model test.** Card: cluster recovery (clusters fully / ≥ 80% recovered), wallet-level precision/recall/F1 for exclusion, $ saved and $ wrongly taken, net value under the stated cost ratio (the rule says a false exclusion costs more — put a number on it, e.g. 3×, and report cost-weighted net), decoy exclusions by decoy kind (exchange-funded, guide, exchange cash-out), false-signal rate on real users, likelihood AUC, rules-baseline row, **degenerate-output guard** (fail the run if any yes/no question is > 95% one answer). Gates: real users excluded ≤ 2; ≥ 6 of 8 clusters ≥ 80% recovered; guide decoys excluded ≤ 1. Dataset: state must give population baselines (median share count) and an explicit bar; make clusters less clean (each currently differs from the crowd on exactly one signal with count 7–9 vs 1 — trivially rule-separable): mix two weak signals, vary cluster size 3–20, add partial funder overlap; label the 13 exchange cash-outs as a decoy kind; 150 items is small — 400+.

7. **Bugs and defects.** Three of five crowd counts and the action sequence missing from the stage (`sybil-clusters-3-stage-scored.png`); `Created At 2026-06-14T20:32:00Z` raw ISO; allocation `1,133.25` without currency; KPI "$186,37 / 3" wraps; distribution bar colours five signals the same amber and only "None" green, implying every named signal is a problem; check rows all amber with 8-chip lists — 10 rows of identical failure make the report 2,900px of noise; check detail string "Eight people built these wallets; this one was linked by…" repeated verbatim on all eight rows; `topItems` empty so "Worth opening" silently disappears; view is `queue` though the PRP specifies `graph`.

8. **Top 5 actions.**
   1. Fix the state (explicit bar, population baselines, neutral option wording) and re-record; until then do not feature this demo. [M] [demo-only]
   2. Build the population-field + five-signal meter view; clusters form during Play all. [L] [demo-only, new view]
   3. Add degenerate-output banner and drop green tone on vacuous KPIs; add the "nothing excluded" finding. [S] [shared-runtime + demo]
   4. Replace "62 of 62" with signal accuracy *versus the argmax baseline* and the false-signal rate as a pair; label the exchange cash-out decoy. [S] [demo-only]
   5. Cluster-recovery bars + $-vs-$ trade-off curve with cost weighting. [M] [shared-runtime widget]

---

## Domain summary

**Cross-demo patterns**

1. **Every dataset is separable by a rule a junior analyst could write in five lines** (wallet-risk 237/240; token-screening 153–160/160; mixer taint 100% by path walk; sybil signal 62/62 by argmax; profiling types separated by design). No report shows a baseline, so a visitor cannot tell "the model is good" from "the file is easy". A rules-engine row on every benchmark card is the single most valuable addition for this domain — and the honest pitch becomes "the model matches your rules engine from a prose description, and tells you why", which is a real value proposition for compliance desks.
2. **Scores rank well but sit in the middle of the rubric** (wallet-risk highs at 3.8–5.3, rugs at 2.6–3.1, tainted at 4.1–5.1, farmed at 3.3–4.3). Every demo then fits a bar in-sample and reports it as a finding. Freeze bars from a previous run/seed and report rubric offset explicitly.
3. **Yes/no answers are offset or degenerate** (mixer taint +0.2 offset; profiling "clear" 0.36–0.55 for everything; sybil "exclude" never above 0.46). Three of five demos need a noul threshold control and a degenerate-answer guard far more than they need another KPI.
4. **The cost of caution is systematically uncounted.** REVIEW, FREEZE and SMALL-position are treated as free or even as successes: $6.3m of clean deposits held (131), $11.6m of clean funds frozen with 16 self-contradictory freezes (133), 25 of 34 harmful tokens called tradeable but "constrained" (134). In crypto compliance, friction *is* the P&L line.
5. **Report prose and notes contain claims the data does not support**: decoys "went straight through" (131: 11 of 14 held), "9 traces treated a bridge as a break" (133: zero demonstrable), "8 of 8 arithmetic breaks caught" (133: confounded by a mixer on every such path), "ambiguity handled 10 of 10" (132: constant answer), "43 wallets / $73,000" (135: 36 / $69,026). For a suite whose selling point is honest evaluation these are the highest-priority fixes.
6. **The generic views destroy the domain's native visuals**: counterparty mix dropped, hour histogram as JSON, hops > 2 flattened, crowd counts sliced off, contract flags as a JSON string. Each demo has an obvious, recognisable picture (exposure strip, fingerprint, trace lanes, token sheet, cluster field) and none is drawn.
7. Actions/choices with an unused option (REPORT_INTERNALLY 0/90; monitoring NONE 0/200; exclude yes 0/150) go unremarked; add an "option never used" lint to the report.

**Flagship pick: 133 · Tracing and mixer exposure.** It is the only demo in the domain with a drawn object already, the only one whose grading is against *written rules in the state* (which is the clearest demonstration of what a typed-question model adds over a classifier), it has the cleanest closing number (34 of 34 with zero false holds at exposure 4 of 6), a genuinely interesting and honest tension (the yes/no ignores the exchange rule while the score obeys it), and a natural A/B regression pair ("rule in a list" vs "rule beside the evidence") that embodies the owner's re-runnable-test goal. It needs the false finding fixed, the confounded arithmetic cohort re-planted, and the trace-board view. Runner-up: 132 for visual appeal once the fingerprint card exists. 135 should not be featured until re-recorded.

**Signature visual for the domain: "the hop lane".** A left-to-right path of pills — wallet → hop → hop → labelled entity — with amounts on the links, a dashed policy line at the desk's action distance, and entity pills colour-coded (red mixer/sanctioned, green KYC exchange, teal bridge). It is the trace board in 133, shrinks to the "hop ruler" in 131's deposit slip, appears as the funder/endpoint hub links in 135's cluster field, and can serve as the domain's homepage tile animation: money moving hop by hop toward a red node, stopping at a green one. Pair it with a fixed domain colour grammar for counterparties (exchange / bridge / unknown / gambling / mixer / sanctioned) used identically in all five demos.
