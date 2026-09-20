# Domain 8 — News, filings and links: demo-by-demo review

Scope: 171 · news-impact, 172 · event-clustering, 173 · filings-read, 174 · entity-links, 175 · rumour-grading.
Evidence: `demos/<id>/demo.js`, `notes.md`, `prps/17x-*.md`, labels in `data/synthetic/`, the computed report dumps, the recorded fixtures (re-aggregated where the report does not compute a number — those figures are marked "recomputed from fixtures"), and screenshots `-1`, `-3`, `-5`, `-6`, `-7`. Global findings 1–10 from the brief are assumed fixed and are not re-reported, except where they interact with something demo-specific.

Headline for the domain: two demos (news-impact, rumour-grading) are honest and interesting but grade the wrong things or hide the deciding evidence; three demos (event-clustering, entity-links, and most of filings-read) score 100% because the dataset writes the answer into the text. The stage views for four of five demos do not show the single piece of evidence the question is about.

---

### 171 · News impact (`news-impact`)

**Scores (0–10):** Story clarity 6 · Item stage 5 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 3 · Evaluation rigour 4 · Re-run/benchmark readiness 4 — **overall 4.5**

1. **One-sentence value.** "The same dramatic headline lands in front of a 7% drop and in front of nothing — the model grades them the same, refuses to call a trade 293 times out of 300, and that restraint is the product." First paint (`news-impact-1-landing.png`) does not land it: the hero item is NW-0001, a conference-attendance notice (materiality 0.7 of 6), the headline is printed twice, and the chart already shows the six bars after the headline before anything has been run.

2. **Item stage.**
   - **Spoiler bug (demo-specific, high impact).** `web/src/demo/views/CandlesView.jsx:117` passes `revealed={candles.length - markIndex}` unconditionally, so the post-headline bars are drawn at first paint with 0 answered (`news-impact-1-landing.png`, `-7-present.png`). `demo.js:6-7` says the opposite ("revealed once the answer is in"). `LabCandlesView` never receives/uses `result`; the older `InsiderCandlesView` in the same file does gate on `result`. The whole tension of the demo — what did the model know at decision time — is given away.
   - The marker pill says **"Decision"**; for this demo it must say "Headline" (there is no trade; `chart.trade` is undefined).
   - The stage shows *only* the chart. The `body`, `last_three_headlines`, `sector`, `close` and `kind` are all sent to the model (`demo.js:26-31`) and none are visible. A practitioner cannot see what was read.
   - Bespoke layout: left 38% a "wire card" (timestamp, ticker, sector chip, headline in large type, two body sentences, prior three headlines as a muted list); right 62% the candle chart clipped at the headline bar with a hatched "not yet known" region. On score, the hatched region wipes open and a bracket annotates **"+1.7% in 5 days"**, with a 7-notch materiality gauge directly under the headline and a direction arrow. The pre-news drift (`priorDriftPct`) should be drawn as a shaded 5-bar bracket *before* the marker labelled "−3.4% in the week before", because `already_priced` is about exactly that window.

3. **Answers and evaluation strip.**
   - `horizon` has no recoverable ground truth (notes admit it; 51 of 300; model says SAME_DAY 174 times). Either drop it or grade it against the generator's intent. It currently adds a failing number that says nothing about the model.
   - `already_priced` is reported as a success ("63 of 97", "the chart is read"). Recomputed from fixtures: the model says yes on **212 of 300**. Yes-rate is 65% (63/97) on drifted charts and **73% (149/203) on charts that had not drifted**. Precision 30%, and the answer is *anti*-correlated with the label. Most nouls sit at 0.49–0.53 (NW-0001: 0.53, NW-0035/0188/0040: 0.49) — this is an uncalibrated coin-flip reported as a finding. The strip then shows "Already Priced ⚠ Yes" on a conference notice (`news-impact-5-evaluation.png`).
   - `tradeable_now` fires 7 times; fine as a restraint signal, not as a hit rate.
   - Verdict card should read: "Graded 3.9 of 6 · negative · not tradeable — template intended Major/negative ✓ — market then: −7.36% in 5 days", with the explicit caption "the text cannot know the last part".

4. **Report, charts and metrics.**
   - **Circular headline KPI.** "Right when it called one: 52 of 61 (85%)" is not prediction. `scripts/generate/news-impact.js:211` picks the headline's sentiment from the sign of the actual forward move for the MOVED group, so direction is planted in the text. Against the generator's own `intendedDirection` (in the labels, unused by the report) the model is **117 of 117** correct with 1 abstention of 118 — i.e. trivial template sentiment. The honest KPI is "sentiment read: 117/117", and "direction vs market" should be shown only as context for ROUTINE items, where it is noise.
   - **Unused labels.** `intendedMateriality` and `intendedDirection` exist in `news-impact.labels.json` and are never graded. Recomputed: mean graded materiality by intended level — 0 → 0.67, 1 → 0.83, 2 → 1.59, 4 → 2.88, 5 → 2.84. The model does **not** separate intended-4 from intended-5 at all (and compresses 4–5 to ~2.9). That is the real rubric-position finding and should be a chart: a strip/box plot, x = intended level (0,1,2,4,5), y = graded score 0–6, with the identity line.
   - "Hit rate when acting 43% vs 29%" is 3 of 7, painted green. Five of the seven tradeable calls are from the dramatic set (3 MOVED, 4 NOTHING: NW-0047, 0115, 0188, 0204). A CI on 3/7 spans ~10–80%. Tone must be neutral, with "n = 7" in the value.
   - "Wrong-way" check includes NW-0035, a ROUTINE broker downgrade followed by +8.35%. That is market noise, not a reading error; restrict the check to MOVED or drop it.
   - Base rate is itself notable: 86 of 300 (29%) moved >4% in five days, 46 of them ROUTINE. The matrix (true values: Fell>4%: 3/22/0/10; Rose>4%: 22/2/0/27; Went nowhere: 23/30/0/40) mostly shows that; MIXED is never used (0 of 300) and should be flagged as an unused option, as rumour-grading does.
   - The curve is titled calibration but is a cumulative precision curve; it is non-monotonic (0.287 → 0.372 → 0.486 → 0.474) and is drawn without ticks. Replace with the paired-distribution chart below.
   - **The right hero chart:** two overlaid histograms (or a mirrored beeswarm) of graded materiality for MOVED (n=40) vs NOTHING (n=40) — visibly identical, gap −0.1 — next to ROUTINE (n=220) sitting 1.9 points lower. One picture makes both claims ("tells big from small; cannot and should not tell the future").
   - The "−0.1" KPI is toned `warn` (`demo.js:133`) while the first finding calls it "the demo working". The tone contradicts the narrative; a near-zero gap is the *pass* condition here.
   - Missing: a leak sentinel metric (AUC of materiality for MOVED vs NOTHING should be ≈0.5; alarm if >0.6), always-neutral baseline for direction, ECE for the two nouls.

5. **Present storyboard.**
   - Beat 1 — "A guidance cut." NW-0021 (LNTN, 2022-02-15, "cuts full-year guidance"), chart clipped at the headline. Model: 3.9 of 6, negative, tradeable 0.48.
   - Beat 2 — reveal: −7.36% in five days. "Looks like a prophet."
   - Beat 3 — the twin: NW-0188 (ORCH, 2024-10-29, *identical wording*), graded 3.8, negative — reveal: −0.29%. Side-by-side cards.
   - Beat 4 — all 80 dramatic headlines as the mirrored histogram; gap −0.1; then the 220 routine ones slide in 1.9 lower.
   - Beat 5 — close: "300 headlines. It said 'act' 7 times." Closing number: **−0.1** (the leak test passed) or **293 of 300 left alone**.

6. **Benchmark card.** Record per run: separation dramatic-vs-routine (gate ≥1.5), MOVED-vs-NOTHING gap and AUC (gate |gap| ≤0.3, AUC 0.4–0.6 — a *ceiling*, not a floor), sentiment accuracy vs intendedDirection (gate ≥95%), Spearman of graded vs intended materiality (gate ≥0.8) plus mean score at intended-5 (tracks scale compression; currently 2.84), already_priced balanced accuracy (currently ~46% — failing), abstention rate, tradeable rate, tokens. Slices: by template kind, by sector, by prior-drift bucket. Dataset changes: more than four routine templates; add intended levels 3 and 6; decouple headline sentiment from move sign in MOVED (so direction-vs-market becomes a genuine null test); drop or re-label horizon; fixed seed already present.

7. **Bugs and defects.** Post-headline bars visible before scoring (`-1-landing`, `-7-present`); marker says "Decision"; body/prior headlines absent from stage (`-3`); "Already Priced ⚠ Yes" on a routine item (`-5`); distribution bar has no MIXED and positive/negative share one colour (`-6`); "Worth opening" values like "-0.29% after" have no "5 days" unit; topItems are all negative guidance cuts — sorted by score only, so the list is ten near-identical rows.

8. **Top 5 actions.**
   1. Gate the after-bars on `result` in `LabCandlesView`, rename marker to "Headline". [S] [shared-runtime]
   2. Re-base grading on `intendedMateriality`/`intendedDirection`; relabel the 52/61 KPI as context, not skill. [M] [demo-only]
   3. Add wire-card + drift bracket to the stage (body, prior headlines, sector). [M] [demo-only]
   4. Replace the curve with MOVED/NOTHING/ROUTINE distribution chart; make the −0.1 gap a pass gate. [M] [shared-runtime widget, demo data]
   5. Report already_priced honestly (yes-rate 73% off-drift) or re-ask it as a score on drift size; drop horizon. [S] [demo-only]

---

### 172 · Event clustering (`event-clustering`)

**Scores (0–10):** Story clarity 5 · Item stage 2 · Answers-to-decision legibility 3 · Report and charts 3 · Presenter readiness 2 · Evaluation rigour 2 · Re-run/benchmark readiness 2 — **overall 2.7**

1. **One-sentence value.** "380 headlines in, 46 events out, with the one source worth reading pinned on each." First paint (`event-clustering-1-landing.png`) shows a field dump for one headline — Timestamp `2026-09-15T00:00:00.000Z`, Outlet "Outlet 01", the title three times — and no feed, no cluster, no count.

2. **Item stage.**
   - **The candidate cluster is invisible.** The only question that matters is "does this belong to *that* cluster", and `QueueView.jsx:6-12` drops every non-scalar field, so `candidateCluster` (the cluster's headlines, outlets, timestamps) is never drawn (`-3-stage-scored.png`). The viewer sees one headline and a verdict about something off-screen.
   - Raw ISO timestamp; `title` repeated as h2, h3 and a "Title" fact; outlet names are "Outlet 01…22", which makes source-rank judgement unreadable.
   - Bespoke layout (the PRP's acceptance line "before-and-after view is playable" is unmet): two columns. Left = the raw feed as a ticking tape in timestamp order, incoming headline highlighted. Right = cluster lanes (one lane per event, newest on top, a star on the reading source, a "+fact" chip on informative members). On score, the incoming card animates into its lane (join) or opens a new lane (new event). For near-duplicate offers the offered lane flashes and the card visibly bounces off into its own lane. A counter reads "57 headlines → 12 events".

3. **Answers and evaluation strip.**
   - `cluster_confidence` (score) duplicates the noul probability of `same_event`; it is never used in the report. Drop it or use it for a review queue.
   - `source_rank` conflates outlet type with content: a **blog** posting "Issuer filing: …" is labelled and answered PRIMARY (crosstab recomputed: blog→PRIMARY 8, aggregator→PRIMARY 7). An aggregator re-posting a filing is not a primary source; the label is wrong for a newsroom. Ask instead "is this the originating document?" and keep outlet type as a given.
   - Strip shows "Adds Information ⚠ Yes" (amber) when that is the good outcome, and "Confidence 2.71" with no scale (`-5-evaluation.png`).
   - Verdict card: "Joined 'North Harbor M raises guidance' (now 5 headlines) · adds a fact: issuer confirmation · becomes the reading source ✓ matches planted event EV-13".

4. **Report, charts and metrics.**
   - **100/100/100 means the dataset is too easy, and it was tuned until it passed.** Notes: "re-recorded the 46 direct-source items after making their issuer-filing evidence explicit" — i.e. titles were rewritten to begin "Issuer filing:" until primary detection scored. True joins share the **identical title string** plus "· update N"; this is string equality, not event resolution. Every `same_event` noul is ≤0.15 or ≥0.92 (recomputed; zero answers between 0.2 and 0.8), so there is no threshold story at all.
   - **The "dangerous near-duplicates" are not near.** PAIR-1 is "North Bridge B cuts guidance" offered against "North Harbor A raises guidance" — different company, opposite action. All six pairs are like this (EC-0002/0004/0006/0008/0010/0012). The KPI "6 of 6… wrongly merging them is the expensive error" is not evidence of anything.
   - Pair precision has only **6 real negatives** (340 offered candidates: 334 true joins + 6 decoys; the other 40 have `candidateCluster: null`, which makes "no" automatic). "100.0%" with one decimal on 6 negatives is false precision.
   - Candidate generation is given: each item is offered exactly one cluster, which for true members is always the right one. The hard part of clustering (which of 46 open events?) is outside the test.
   - "Reading time saved 100.2 min" = 334 × 18 s, which assumes every joined headline is skipped — including the ones the model itself says add information. It should be (joined − informative) × 18 s.
   - Report body is a 46-row table plus a 20-row "Worth opening" list repeating the same rows (`-6-report.png`, 3798 px). **A real visual is needed**: a swim-lane timeline — x = the 72 hours, one row per event (46 rows at 14 px = 650 px), one dot per headline coloured by source rank, ring on informative members, star on the chosen reading source, a red link where a wrong merge occurred. Above it a single "380 → 46" funnel bar. This replaces both tables and is the homepage-grade picture of "deduplication".
   - Missing metrics: B-cubed or pairwise F1 over *all* pairs, adjusted Rand index against `eventId`, cluster purity, reading-source accuracy (is the chosen source the planted primary? 43/46), baseline: normalised-title exact match (would also score ~100% here — which is the point).

5. **Present storyboard.**
   - Beat 1 — the tape: 30 headlines scroll past in 6 seconds, unreadable. "This is the desk at 9 a.m."
   - Beat 2 — EV-13 assembles: EC-0013 (market talk), EC-0059, EC-0105, EC-0151 drop into one lane; EC-0197 "Issuer filing confirms…" arrives, gets the star and the "+fact" chip (and honestly: the model *missed* PRIMARY on EC-0197 — show the miss badge).
   - Beat 3 — a decoy bounces: EC-0002 offered to EC-0001's lane, rejected at 0.1x probability (only worth showing once the decoys are genuinely confusable).
   - Beat 4 — full swim-lane fills: 380 dots, 46 lanes.
   - Close: **380 → 46**, with "0 wrong merges" as the sub-line.

6. **Benchmark card.** B-cubed P/R/F1, ARI, wrong-merge count on hard negatives (gate = 0 with n ≥ 60), missed-join rate, reading-source accuracy, information-addition P/R, mean |p−0.5| (confidence sharpness), per-slice: rumour-then-confirmed events, updates, same-company-different-event, different-company-same-action. Dataset must change: paraphrased titles (no shared string, no "update N" suffix), real hard negatives (same company two events in 72 h; "North Harbor Holdings" vs "North Harbor Energy" same action same hour), 2–4 candidate clusters offered per item including the wrong ones, ≥25% negatives, named fictional outlets with a stable reputation, freeze the text before recording (no tune-to-pass).

7. **Bugs and defects.** Candidate cluster absent from stage (`-3`); ISO timestamp with milliseconds (`-1`, `-3`); title ×3; "Adds Information ⚠ Yes" amber (`-5`); cluster table and "Worth opening" duplicate each other (`-6`); reading source shows "What we know: … update 1 · Outlet 01" for the clusters whose primary was missed — a secondary rewrite is presented as the source to read without any warning; "Primary-source precision 100%" headline hides recall 93.5% in the check text.

8. **Top 5 actions.**
   1. Rebuild the dataset with confusable negatives, paraphrased members and multi-candidate offers; stop editing text after a failed run. [L] [demo-only]
   2. Feed → lanes bespoke stage that shows the candidate cluster. [M] [demo-only view]
   3. Swim-lane timeline report widget replacing `EventClusterReport` table. [M] [shared-runtime]
   4. Replace pair P/R with B-cubed/ARI + hard-negative merge rate; fix reading-time formula. [S] [demo-only]
   5. Fix PRIMARY semantics (content vs outlet) and drop `cluster_confidence`. [S] [demo-only]

---

### 173 · Filings and calls (`filings-read`)

**Scores (0–10):** Story clarity 6 · Item stage 6 · Answers-to-decision legibility 4 · Report and charts 4 · Presenter readiness 4 · Evaluation rigour 4 · Re-run/benchmark readiness 4 — **overall 4.6**

1. **One-sentence value.** "Revenue up, margin up — and the chief executive says he is more cautious: the model reads the gap a skim would miss." The first item, FD-0001, is genuinely that case, so first paint (`filings-read-1`/`-7-present.png`) is the closest in the domain to landing its story — but nothing on screen points at the two sentences that disagree, and the prior period is collapsed.

2. **Item stage.** `DocumentView` is the right base. Needed:
   - Highlight evidence: numbers sentence in green ("431.3 vs 388.2 million; margin 23.1 vs 22.5"), tone sentences in amber ("more cautious view", "order book… lower"), guidance sentence boxed. Even without model-provided spans, the generator knows which sentence carries which plant.
   - **Risk sections need a diff, not prose.** For RISKS items show current list and previous list side by side with the inserted line highlighted and its position called out ("new · 13 of 16"). Today the prior list is hidden in a collapsed `<details>` (`-3-stage-scored.png`), so the PRP beat "a new risk factor found in position 14 of 19" cannot be seen.
   - Header: `Kind RESULTS` raw enum, "Published On", "Words 117" are low value; promote company + period + document kind as a chip; hide Words.
   - For call excerpts render speaker turns as a transcript (Analyst / Chief executive), and flag the insider sentence. Note the generator drops the insider sentence in as the *answer to an unrelated question* ("How should we think about the margin bridge…?" → "The chief operating officer disposed of 370,000 shares…", FD-0029) — it reads as a bug on camera.

3. **Answers and evaluation strip.**
   - `new_risk_factor` is ill-posed for non-risk documents and the report hides the consequence. Recomputed from fixtures: the model says "yes" on **18 of 30 RESULTS and 12 of 30 CALL documents whose label is NONE** — 30 false positives. The "phantom" check filters to `kind === 'RISKS'` (`demo.js:138, 143`), so the page shows "0 of 13" and a green tick. All-document precision is 17/47 = **36%**; the page implies 100%. FD-0001 itself shows "New Risk ⚠ Yes" with label NONE (`-5-evaluation.png`). Either ask the question only on RISKS items or grade it everywhere.
   - `numbers_and_tone_agree`: the 12 beat-but-worse nouls are 0.34–0.61; the 4 "misses" are 0.50, 0.51, 0.52, 0.61. `>= 0.5` counts 0.50 as "agree" (`demo.js:71`). This is a knife-edge threshold, and 7 of 78 ordinary documents are also called "disagree". Needs a threshold control and P/R (currently P = 8/15 = 53%, R = 67%).
   - `insider_transaction_significant`: n = 5 (3 significant, 2 routine). The strength gap 0.95 vs 0.52 is a nice illustration and not a metric. Notes.md contradicts itself ("Every insider sale was called significant" / "Four of the five got a yes"); the KPI says "1 of 2 routine".
   - Strip: "Agree ✓ No" is rendered green-good when "No" is the alarm; "Tone 1.43" has no scale or anchor words; "Confidence 1".
   - Verdict card: "Guidance maintained ✓ · tone worse (1.4 of 6; planted 2) ✓ · numbers and language disagree ✓ — read this one", then the two quotes.

4. **Report, charts and metrics.**
   - Guidance 90/90 with minimum confidence 0.98 is keyword-spotting ("reaffirms", "reduced to", "withdraws"); after the generator fix there is no adversarial case left. The best story in the notes — FD-0047, where words said "reduced" and the range arithmetic said "raised", and the model followed the arithmetic — was *removed from the dataset*. Put it back deliberately as a labelled slice ("words and numbers conflict").
   - Tone label "follows mechanically from the guidance direction" (notes), so "Tone off by 0.60" measures agreement with a rule correlated with question 1.
   - Buried vs obvious: 9/9 vs 8/8 at 16 lines with the header "previous filing listed 15 risks" and a new line that is visibly longer and more specific than the boilerplate pool. It is a list diff with the answer's length as a tell. Test at 40–60 lines, reorder the old list, and add a *reworded* old risk as a decoy.
   - The coverage curve (`demo.js:169-177`) plots "tone far from unchanged" against "guidance mentioned or risk new"; rate is 1.0 from the second point onward because tone derives from guidance. It is meaningless; remove.
   - "What a document costs: 1,716 characters" is an operational stat among quality KPIs and wraps mid-word ("characte/rs", `-6-report.png`); move to the run footer as tokens and cost.
   - "Worth opening" lists ten items all marked "agrees", sorted by tone extremity — the successes. It should list FD-0006, FD-0025, FD-0047, FD-0078 (the four missed gaps) first.
   - Charts that fit: (a) the PRP's "guidance grid" — 12 companies × quarters, cell coloured by guidance call, dot if wrong; (b) a **numbers-vs-tone quadrant**: x = planted numbers direction (revenue/margin delta), y = model tone score, the 12 beat-but-worse documents landing in the bottom-right quadrant, ringed if the model flagged the gap; (c) rank-position plot for new-risk detection: x = position of inserted risk / list length, y = noul — becomes interesting once lists are long.
   - Missing: precision for every noul (not only recall), ECE, baseline (keyword rules for guidance will score ~100% — show it, it is honest), per-kind slices.

5. **Present storyboard.**
   - Beat 1 — FD-0001 (KSTL Q1 2025 results): numbers sentence lights green: "+11% revenue, margin up".
   - Beat 2 — tone sentences light amber; tone dial swings to 1.4 of 6; badge "numbers and language disagree" (noul 0.35).
   - Beat 3 — FD-0012 (Marlow Studios principal risks): two lists side by side, line 13 of 16 ("dispute with a former joint venture partner… arbitration") slides out highlighted.
   - Beat 4 — FD-0029 vs FD-0048: two share sales, both "yes", but 0.95 vs 0.58 — "the probability is the answer".
   - Close on the guidance grid and the honest number: **8 of 12 gaps caught** (not 90 of 90).

6. **Benchmark card.** Guidance macro-F1 (gate ≥0.95) + conflict-slice accuracy; tone MAE and Spearman; new-risk P/R **over all documents** and by position tercile and list length; numbers-vs-tone P/R/F1 at a stated threshold plus AUC; insider AUC on ≥20 cases; ECE per noul; tokens per document. Dataset: ≥30 beat-but-worse and ≥30 "miss-but-upbeat" cases; ≥20 insider cases (incl. purchases); risk lists of 40+ with reworded decoys; keep 5–8 words-vs-arithmetic conflicts; hold out risk statements not in the pool of 18; decouple tone label from guidance.

7. **Bugs and defects.** "The period before it" summary has no left padding and is clipped against the border (`-3`, `-7`); "Kind RESULTS" raw enum; `Agree ✓ No` green (`-5`); KPI "1,716 characte/rs" and "0.95 against 0.52" wrap badly (`-6`); distribution bar colours Cut and Withdrawn the same amber and Maintained/Not mentioned the same grey; check rows 1–5 duplicate the matrix diagonal (five green zeros); notes/KPI contradiction on routine insider count.

8. **Top 5 actions.**
   1. Grade `new_risk_factor` on all 90 documents (or scope the question to RISKS) and show precision 17/47. [S] [demo-only]
   2. Evidence highlighting + side-by-side risk diff in `DocumentView`. [M] [shared-runtime view, demo data hints]
   3. Rebalance the dataset toward the hard slices (beat-but-worse, conflicts, long lists, insider n ≥ 20). [L] [demo-only]
   4. Replace the coverage curve with the numbers-vs-tone quadrant and the guidance grid. [M] [shared-runtime widget]
   5. Re-rank "Worth opening" by disagreement with labels. [S] [demo-only]

---

### 174 · Entity links (`entity-links`)

**Scores (0–10):** Story clarity 4 · Item stage 2 · Answers-to-decision legibility 3 · Report and charts 2 · Presenter readiness 2 · Evaluation rigour 2 · Re-run/benchmark readiness 2 — **overall 2.4**

1. **One-sentence value.** "From 400 scraps of dated evidence, a live map of who is tied to whom — and which supplier is two steps from a failing fund." First paint and presenter mode (`entity-links-7-present.png`) show two circles joined by one fat arrow in ~600 px of empty space, the far label overprinted by the arrowhead, and no evidence text anywhere.

2. **Item stage.**
   - **The evidence is never shown.** `GraphView` renders only `item.graph`; `item.evidence` (the dated snippets that are the entire input) and the entity profiles (jurisdiction, registration, industry) are not drawn (`-3-stage-scored.png`). The per-item graph is always exactly 2 nodes and 1 edge labelled "candidate evidence" (recomputed: every item has `graph.nodes.length === 2`). The `<details>` is titled "Transfers as a table" — copy inherited from the mule demo.
   - The PRP requires "the graph builds as pairs are judged, with edge thickness from strength" (`prps/174:13`). Not built.
   - Bespoke layout: left = two entity cards (type chip, jurisdiction, registration, industry) with an **evidence timeline** between them — dated source-typed chips ("2025-12-31 · ownership filing · 31% voting interest", "2026-06-30 · termination filing · ended 2026-04-30") — the last chip decides active/ended. Right = the cumulative network, 90 nodes in a fixed deterministic layout (no physics; precompute positions once from the seed), all pairs judged so far drawn, the current pair's edge pulsing in; edge colour = relationship type, width = strength, dashed grey = ended, no edge + a small "≠" glyph for a rejected coincidence.

3. **Answers and evaluation strip.**
   - `evidence_sufficient` and `relationship = NONE` are the same decision here (the report requires both for a coincidence rejection, `demo.js:62`); redundant.
   - `contagion_risk` has **no label and no discrimination**: yes on 278 of 288 active relationships — all 41 litigation, all 52 board seats, 25 of 35 shared auditors (recomputed). A shared auditor is not a contagion channel. The question needs an economic hook (share of revenue, size of stake) in the evidence and a planted label.
   - `strength` clusters by type, not by evidence: ownership 3.6–4.3 (every ownership snippet seen says "31% voting interest"), supplier 4.0–4.25. The top "Worth opening" item is a **shared auditor at 4.6 of 6**, above every ownership stake — indefensible on a rubric whose top is "Controlling".
   - Strip: "Still Active ⚠ Yes · Contagion Risk ⚠ Yes · Evidence Sufficient ⚠ Yes" — three amber warnings on the cleanest item in the set (`-5-evaluation.png`).
   - Verdict card: "Ownership · active · strong (4.1) — evidence: ownership filing 2025-12-31 + current disclosure 2026-06-30 ✓ · completes chain CHAIN-1: Harbor 01 → River 02 → Summit 03".

4. **Report, charts and metrics.**
   - **100% on 400 is label leakage through phrasing.** Evidence source strings map one-to-one to labels (recomputed): "ownership filing + current disclosure" → OWNERSHIP active (43/43); "… + termination filing" → ended (20/20, text: "The relationship described above ended on…"); "directory search" → NONE (80/80, text literally says "no ownership, contract, board, audit or litigation evidence is supplied"); coincidences say "different owners, addresses and registrations… without asserting any corporate relationship". A lookup on `evidence[].source` scores 100%. Nothing here can regress, so nothing here is a test.
   - "3,520 directed two-step contagion paths" from 279 edges on 90 nodes (mean degree 6.2) is combinatorial noise presented as a finding; six are planted. Paths through shared auditors and litigation should not count; rank paths by product of strengths and show the top 20.
   - **A real network visual is required** — this is the one demo where a table is actively wrong. `EntityNetworkReport` prints 279 rows (6483 px, `-6-report.png`), and "Worth opening" adds 30 more. Replace with: a 90-node network (fixed layout, funds/companies/people as shapes, edge colour by type, width by strength, ended edges dashed) occupying ~700 px; the six planted chains drawn as highlighted two-hop ribbons; and the PRP's promised interaction — **click an entity → its 1-hop and 2-hop neighbourhood lights up** with a side list "what is two steps away and through whom". Keep the table behind a disclosure. Secondary chart: relationship-type confusion matrix (7×7) and a small-multiple of strength by type.
   - Missing: per-type P/R, active-status F1 on the ended slice (n = 20), coincidence false-accept rate, edge-level P/R of the recovered graph vs the planted graph, chain recovery, baseline (source-string lookup — currently 100%).

5. **Present storyboard.**
   - Beat 1 — one sentence becomes an edge: EL-0002 (Fictional River 02 → Fictional Summit 03, supplier); the annual-filing chip drops onto the timeline and a line draws in the network.
   - Beat 2 — the link that ended: EL-0025 (Beacon 60 / Summit 63) — ownership filing, then the termination chip; the edge draws and goes dashed grey. "Still 'ownership'. No longer a channel."
   - Beat 3 — the namesake: the Fictional Meridian 01 Holdings / Meridian 01 Services pair — cards look alike, registry chip says different owners; no edge, "evidence insufficient".
   - Beat 4 — fast-forward 400 pairs; network fills; click Fictional Harbor 01 → River 02 → Summit 03 lights as CHAIN-1.
   - Close: **6 of 6 chains** — but only after the dataset is hardened; today the honest close is "400 of 400, and that is the problem".

6. **Benchmark card.** Edge P/R/F1 vs planted graph; per-type F1; ended-link recall and false-ended rate; coincidence false-accept rate (n ≥ 50); chain recovery; contagion P/R against planted labels; strength Spearman vs planted stake/revenue share; graph-level: nodes/edges/paths drift vs previous run. Dataset: evidence that must be *inferred* (board seat stated as "Ms X, a director of A, joined B's audit committee"; supplier stated as a revenue-concentration sentence), conflicting snippets (older filing says active, newer press says talks to exit), stale evidence without a termination filing (is it still active after 3 years' silence?), mixed source types per label, real-looking fictional names (not "Fictional Harbor 01"), hard coincidences with shared directors' surnames or addresses, varied stakes (3%–80%) to give strength a ground truth.

7. **Bugs and defects.** Far node label overprinted by the edge/arrowhead (`-3`, `-7`); ~60% of the stage is empty; "Transfers as a table" wrong noun; evidence absent; all-amber "Yes" badges (`-5`); 279-row table + 30-row list (`-6`); entity names "Fictional Harbor 01" read as placeholder data on camera; relationship enums lower-cased but "From/To" direction arbitrary for symmetric types (shared auditor, litigation) while an arrowhead is drawn.

8. **Top 5 actions.**
   1. Rewrite the generator so the label is not recoverable from `source` strings or boilerplate sentences; add conflicting/stale/inferred evidence and plant contagion + strength labels. [L] [demo-only]
   2. Network report widget with click-to-expand two-hop view; demote the table. [L] [shared-runtime]
   3. Evidence-timeline + entity-cards stage with cumulative graph. [M] [demo-only view]
   4. Filter/rank contagion paths (exclude auditor/litigation, top-N by strength); stop headlining 3,520. [S] [demo-only]
   5. Believable fictional names and varied stakes. [S] [demo-only]

---

### 175 · Rumour grading (`rumour-grading`)

**Scores (0–10):** Story clarity 6 · Item stage 3 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 3 · Evaluation rigour 5 · Re-run/benchmark readiness 4 — **overall 4.3**

1. **One-sentence value.** "Forty accounts, one sentence, twenty minutes: that is a campaign, not a crowd — and the model can tell them apart when reach and speed are identical." First paint (`rumour-grading-1`/`-7-present.png`) shows a title of "RM-0001 · PINE · an account that reads filings", a twelve-field grid, and the claim itself at the bottom in body text.

2. **Item stage.**
   - **The deciding evidence is cut off.** `QueueView.jsx:11` does `.slice(0, 12)`; this item has 15 scalar fields, so `wordingSharedPercent`, `independentSourcesSayingIt` and `companyRecentNews` (exactly 60 chars, so it is classed scalar by `isText` at `> 60`) are dropped (`-3-stage-scored.png`). The notes say wording is "the only thing that can separate them"; the viewer cannot see it. `citedDocument` is null for 231 items and is dropped too.
   - `itemLabel` should be the claim. `Source Type FILING_WATCHER` duplicates `Source Description`.
   - Bespoke layout: the claim as a quoted post card (handle, posted time). Beside it a **track-record bar** (42 confirmed / 8 denied / 17 open of 67). Below, a **spread strip**: x = minutes since post (log scale), one dot per repeating account, dot fill = wording similarity (solid = copy, hollow = paraphrase) with the summary "33 accounts · 18 min · 95% same wording". Then three chips: independent sources (n), cited document (name or "none"), company's recent confirmed news. A push looks like a solid wall of dots; a crowd looks like scattered hollow ones — unmistakable in one glance.

3. **Answers and evaluation strip.**
   - Three of five questions are field read-offs: `corroborated` ≡ `independentSourcesSayingIt > 0` (162/171 yes, 0 false yes), `checkable` ≡ `citedDocument != null` (9/9, 0/231), and `coordinated_push` is a threshold on a supplied number: the rule "wording ≥ 60% and accounts ≥ 20" scores **14/14 and 0/12 — better than the model's 14/14 and 1/12** (recomputed). Organic-crowd nouls sit at 0.41–0.55, pushes at 0.81–0.88: the margin to a false alarm is 0.05. Give the model the actual repeated posts (5–8 snippets) instead of a percentage and this becomes a real test.
   - `disposition` does not discriminate: VERIFY on 11/22 confirmed (50%), 16/38 denied (42%), 85/180 unresolved (47%). ACT_WORTHY 0, IGNORE 1. It also contradicts the model's own sub-answers: RM-0016 — coordinated 0.87, source reliability 0.73 of 6, zero independent sources, 14/46 track record — is sent to VERIFY. The option wording invites it ("Send somebody to check the thing it points at" — there is nothing pointed at). Re-anchor options with costs, or derive disposition from the sub-answers and show the rule.
   - `source_reliability` tops out at **3.04 of 6**; a source with 42 of 67 confirmed and 8 denied gets "Moderate". Same scale compression as news-impact. The calibration curve therefore has 4 of 7 points null (`curve.points[3..6].reviewed = 0`) and the chart draws three dots.
   - Strip: "Corroborated ⚠ Yes" amber for the reassuring answer (`-5-evaluation.png`).
   - Verdict card: "Coordinated push (0.87) · source 0.7 of 6 · nobody independent · nothing to check → do not amplify. Later: DENIED ✓".

4. **Report, charts and metrics.**
   - Two KPIs are structural zeros painted green: "Confirmed claims ignored 0 of 22" and "Denied claims called act-worthy 0 of 38" (`demo.js:126-127`). The findings text admits act-worthy went unused, but the tiles still read as wins (`-6-report.png`). Tone must be neutral with context "option unused".
   - KPI "Denied claims called act-worthy 0 of 38" and check "False claim sent for verifying or acting on 16 of 38" measure different things under near-identical names on the same page.
   - "Sent to somebody to check 112 of 240" is toned good because it is under half (`demo.js:125`) — 47% of the feed to a human queue with no lift over base rate (precision on resolved: 11/27 = 41% vs base 37%) is not good.
   - The reliability gap 0.8 and the rising curve (37% → 59% → 68%) are generator-planted (notes admit ~70% correlation) on n = 60, 34, 19.
   - Data defects: three different companies share ticker **PINE** (Pinefield Industries / Resources / Group — different sectors) in `context.companies`; RM-0035 claims an earnings miss and cites "a tender award notice" — template cross-wiring.
   - Charts that fit: (a) **scatter of the 26 fast-spreading claims**, x = accounts, y = minutes, colour = wording share, marker = model call — shows reach/speed overlap and wording separating; (b) reliability score vs track-record ratio scatter (should be a line; shows compression); (c) disposition by outcome as a 3×4 stacked bar with the unused columns explicitly greyed; (d) verification-queue economics: queue size vs confirmed-caught as a threshold on a composite score — this is where the missing slider belongs.
   - Missing: rule baseline (shown above — it wins), P/R/F1 on coordination with CI (n = 14/12), ECE, lift of VERIFY over base rate, cost-weighted error (analyst minutes per true claim surfaced).

5. **Present storyboard.**
   - Beat 1 — RM-0016: "Beacon Group is preparing a rights issue at a discount." Spread strip fills: 33 solid dots in 18 minutes, 95% same wording. Badge: coordinated 0.87; source 0.7 of 6. Later: DENIED.
   - Beat 2 — RM-0008: same reach (43 accounts, 38 min), hollow dots, 31% shared wording → 0.55, the one organic crowd the model wrongly called a push. Show it honestly: "this is where the line is".
   - Beat 3 — RM-0035: quiet post, 4 repeats in 11 hours, cites a document, source 82/131 → checkable, VERIFY. Later: CONFIRMED.
   - Beat 4 — the 26-claim scatter: reach and speed overlap entirely; colour splits them.
   - Close: **14 of 14 pushes caught, 1 of 12 crowds mis-flagged** — with the rule baseline printed beside it once the raw posts replace the percentage.

6. **Benchmark card.** Coordination P/R/F1 + AUC with CI, and the same for the numeric-rule baseline; reliability Spearman vs track-record ratio and max score used (compression watch; now 3.04); disposition usage histogram with an "unused option" alarm; VERIFY lift over base rate; queue share; checkable/corroborated as sanity gates (must stay 100%); ECE. Slices: source type, spread class, cited vs not. Dataset: ≥50 pushes and ≥50 organic crowds with wording share overlapping in the 40–75% band; raw repeated posts instead of a percentage; resolve more claims (≥120 resolved); unique tickers; coherent cited documents; some reliable sources that are wrong and unreliable ones that are right, labelled as a slice.

7. **Bugs and defects.** Wording %, independent sources, recent company news and cited document missing from the stage (`-3`, `-7`); title is source description not the claim; raw `FILING_WATCHER` (`-3`); finding begins lower-case "act worthy went unused…" (`-6`); calibration chart has three points and no ticks; distribution bar draws Ignore (1 item) as a green sliver and Watch/Verify in the same grey; "Worth opening" is nine "unresolved" rows — no story value; duplicate PINE ticker.

8. **Top 5 actions.**
   1. Bespoke stage: claim card + track-record bar + spread strip; never truncate fields silently (`QueueView.slice(0,12)`). [M] [demo-only view + S shared-runtime fix]
   2. Replace `wordingSharedPercent` with sampled repeat posts; widen the overlap band; add the rule baseline to the report. [L] [demo-only]
   3. Fix disposition (re-anchored options or derived policy) and neutralise the structural-zero KPIs. [S] [demo-only]
   4. Add the 26-claim scatter and queue-economics curve. [M] [shared-runtime widget]
   5. Data hygiene: unique tickers, coherent cited documents, more resolved claims. [S] [demo-only]

---

## Domain summary

**Cross-demo patterns**

1. **The stage hides the evidence the question is about** in four of five demos: candidate cluster (172), evidence snippets (174), wording share and independent sources (175), headline body and prior headlines (171). Only filings-read shows what the model read. Two causes are shared-runtime: `QueueView` silently drops nested fields and anything after the 12th scalar; `GraphView` draws only `item.graph`.
2. **Perfect scores come from answers written into the text.** 172 (identical title strings, "Issuer filing:" prefix added after a failed run), 174 (source strings map 1:1 to labels), 173 guidance (keyword verbs, min confidence 0.98), 175 corroborated/checkable (field read-offs). A one-line rules baseline matches or beats the model on each. None of these can detect a regression, which defeats the re-runnable-benchmark goal.
3. **Reports grade recall and hide precision.** 173 new-risk: 30 false positives excluded by a `kind === 'RISKS'` filter (true precision 36%). 171 already-priced: "63 of 97" with a 73% yes-rate on the negatives. 172 primary: headline is precision 100%, recall 93.5% is in small print.
4. **Circular or structural metrics painted green.** 171 direction 52/61 (sentiment planted from the move's sign); 175 two zeros from unused options; 171 hit rate 3/7; 174 3,520 paths.
5. **Score questions use the bottom half of the rubric**: materiality max 3.9/6, source reliability max 3.04/6, entity strength 1.5–4.6 by type rather than evidence. Every score demo needs a rank-correlation-with-intent metric and a "max used" drift watch, and the anchors need quantities in them.
6. **The honest notes are the best content in the domain** (the horizon label rewrite, the FD-0047 generator bug, the two zeroes). None of that reaches the page or the Present screen; it should become the "what this run taught us" beat.
7. Tables stand in for the two visuals the domain is named after: 279-row edge table (174) and 46-row cluster table (172). Both need purpose-built visuals; the tables belong behind a disclosure.

**Numbers to double-check / that look wrong**
- 171: "Right when it called one 52 of 61" is circular; vs intended direction it is 117/117. `already_priced` yes on 212/300, 73% on non-drifted. Hit rate 43% = 3/7. Intended-4 vs intended-5 graded 2.88 vs 2.84.
- 172: 100.0% pair precision rests on 6 negatives that are not near-duplicates; all nouls ≤0.15 or ≥0.92; reading time counts informative headlines as skipped; blogs labelled PRIMARY.
- 173: new-risk "0 of 13 phantom" hides 30 false positives on results/calls; four beat-but-worse "misses" are nouls 0.50–0.61; notes contradict KPI on routine insider sales; n = 5 insider cases.
- 174: 400/400 reproducible by source-string lookup; contagion yes on 278/288 including 25/35 shared auditors; top strength item is a shared auditor at 4.6/6; 3,520 paths vs 6 planted.
- 175: rule baseline 14/14 & 0/12 beats the model's 14/14 & 1/12; VERIFY rate 50% confirmed vs 42% denied vs 47% unresolved (no lift); reliability max 3.04/6 leaves 4 of 7 curve points empty; three companies share ticker PINE.

**Flagship pick: 171 · News impact.** It is the only demo in the domain on real price data, it has a genuinely counter-intuitive and defensible thesis (identical words, different futures, gap −0.1; 293 of 300 left alone), the candle stage is already the most visual, and its fixes are small (gate the reveal, re-base grading on intended labels, one distribution chart). It also carries the message most relevant to a benchmark harness: a test whose *pass* condition is "no separation" is a leak detector, which is a distinctive thing to show. Rumour-grading is the runner-up once the spread strip exists and the wording signal is made non-trivial. Entity-links has the highest visual ceiling but needs a new dataset and a new widget before it should be featured.

**Signature visual for the domain: the evidence timeline resolving into structure.** A horizontal time axis carrying dated, source-typed chips (headline, filing, post, docket), which on scoring resolve into a structure on the right — a candle reveal (171), a cluster lane (172), a highlighted sentence/diff (173), a network edge (174), a spread wall of dots (175). One motif — "dated evidence in, structure out" — gives the five demos a shared identity and gives the homepage tile a single animation: chips sliding along a timeline and snapping into a small network with one two-hop path lit.
