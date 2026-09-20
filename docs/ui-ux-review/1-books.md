# Domain review 1 — Books and reconciliation (101–105)

Scope: `ledger-integrity`, `bank-reconciliation`, `expense-posting`, `three-way-match`, `close-blockers`. Evidence: `demos/<id>/demo.js`, `notes.md`, `prps/10x-*.md`, label files, the computed report dumps, the 1440px screenshots, `LEFTOVERS.md`, `handovers/102` and `handovers/104`. Global findings 1–10 of the brief are assumed fixed and not repeated except where a demo makes them materially worse.

Three findings in this domain are more serious than anything cosmetic and are flagged up front:

- **102 leaks its labels through the state.** Every statement reference and ledger `documentId` carries the planted class as a suffix (`DEMO2605-0196-FEE`, `-PART`, `-FX`, `-DUP`, `-MISS`, `-PAY`, `…MESSY`, `JRN-TIM-11`, `JRN-MESSY-12`, `JRN-PART-03`). The 60/60 result is not evidence of anything.
- **104's headline money number adds AED, GBP and EUR invoice totals as if they were USD.** $78,509.68 of the $137,815.28 "money at risk" (57%) is un-converted foreign currency.
- **105 marks a wrong decision as "agrees"**, and 102's "closing balance reconciles" check is an identity that cannot fail whatever the model answers.

---

### 101 · Ledger integrity review (`ledger-integrity`)

**Scores (0–10):** Story clarity 6 · Item stage 6 · Answers-to-decision legibility 4 · Report and charts 4 · Presenter readiness 3 · Evaluation rigour 5 · Re-run/benchmark readiness 4 — **overall 4.6**

1. **The one-sentence value.** "Out of 502 journal lines, it finds the 11 that are wrong, names what is wrong with each, and tells you how few lines a person must open to catch them all." First paint (`ledger-integrity-1-landing.png`) shows L-0001, office rent, a balanced two-line document with a green "Document balances" badge: the most boring line in the ledger. Nothing on screen says 11 problems exist, that any were found, or what "wrong" looks like. The only bespoke view in the domain is wasted on a clean first item.

2. **Item stage review.** `LedgerView.jsx` shows document lines (Line, Account, Memo, Debit, Credit), totals and a balance badge. That is good for two of five issue types (reversed sign, missing counter-entry) and blind for the other three:
   - *Duplicate posting* is only findable from `same_amount_same_counterparty` (demo.js:30–35, 69) — the view never shows the lookalike document. The PRP's first video beat ("the state shows both lines") cannot be filmed from the stage.
   - *Period cut-off* needs the line date against the period window; the date is an eyebrow in pink capitals and the period is not shown at all.
   - *Misclassified account* needs the account's habits (`account_this_month`: postings, median, largest, usual counter-accounts) beside the memo; none of it is shown. Counterparty, reference, posted-by and posted-at are also absent.
   - The selected row is almost indistinguishable: in `-3-stage-scored.png` the row header cell of the *other* line and the tfoot label are the ones with a lighter background, so the eye goes to L-0002 and "Document totals", not to L-0001.
   
   Bespoke layout: a three-column "audit bench". Left: the document as a T-account pair (debits left, credits right, a balance beam underneath that tilts and turns amber by the imbalance amount). Centre: the line under review as a large card — account code + name, side, amount with currency, memo in quotes, date chip coloured red if outside the period bar drawn under it (1–31 May with the line's date as a tick). Right: "Context the model was given" — an account-habits strip (dot plot of this month's amounts in that account with this line's amount marked, usual counter-accounts as chips) and a "Twins" list showing any same-counterparty/same-amount posting with its document id and date gap ("DOC-0080 · 9 days earlier · same 4,210.00"). When the verdict lands, the offending element is ringed: the twin, the date tick, the tilted beam, or the account chip.

3. **Answers and evaluation strip.**
   - `document_balances` is not a judgement; it is arithmetic the state already contains (`total_debit`, `total_credit`, demo.js:65–66). It is never graded and only feeds a badge. Either grade it against the computed truth (a free sanity metric: "arithmetic agreement 502/502") or drop it.
   - `severity` is asked on every line; clean L-0001 scores 0.99 ("Cosmetic") rather than ~0, and `needs_human_review` returns 0.33 on the same clean line. 233 of 502 lines sit at ≥0.30 and 480 at ≥0.20: the noul has a floor around 0.2–0.35, so the threshold axis below 0.3 is dead. The rubric wording "If something is wrong…" invites a non-zero answer.
   - Two different triggers exist and are not reconciled: `flagged` (issue ≠ NONE → 85 lines) and `forReview` (review ≥ 0.5 → 96 lines). The strip shows both as "Flagged" and "For Review" with no explanation.
   - `memo_matches_posting` is never used in the report.
   - `-5-evaluation.png`: "Balances ⚠ Yes" and "Memo Matches ⚠ Yes" are amber warnings for good news; "Severity 0.99" has no scale; "Review 0.33" has no meaning to a visitor.
   - Verdict card should read: **"Clean — post as is"** or **"Duplicate posting · Material (4.2/6) · send to reviewer"**, then a ground-truth line ("Planted: duplicate of DOC-0080 — caught, named correctly" / "Nothing planted — false alarm, VAT-convention cluster"), then amount at stake (the line amount with currency) and the one-line reason pointing at the evidence (twin, date, side).

4. **Report, charts and metrics.** True numbers: 502 lines, 13 planted lines / 11 problems, 9 of 11 problems named, 85 lines flagged of which 75 have nothing planted, 96 sent to a person.
   - **Missing headline: precision.** Line-level precision is 10/85 = **11.8%**; recall is 10/13 lines (77%) or 9/11 problems (82%); F1 ≈ 0.20. Excluding the 68-line VAT cluster precision is 10/17 = 59%. The KPI strip never says this; "Lines flagged 85 · 75 with nothing planted" hides it in a context string with neutral tone.
   - **The VAT cluster dominates everything.** 68 of 75 false alarms are "reversed sign on VAT payable" (91%). The distribution bar's 70-line "reversed sign" segment, the confusion row `none → reversed sign = 68`, and 5 of the 10 "Worth opening" entries (L-0143, L-0330, L-0099, L-0102, L-0303, severity 3.9–4.0, within 0.4 of the real planted problems) are all this one dataset defect. `LEFTOVERS.md` 1.1 already says the dataset is wrong; it should be fixed (add VAT receivable, regenerate, re-record) before any video, because every chart on the page is telling the VAT story instead of the demo's story.
   - **Coverage curve is inconsistent with the KPI.** `coverage()` (demo.js:206–214) counts a problem as caught when any planted line is merely *opened* (`review ≥ threshold`), while "Problems caught 9 of 11" requires the issue type to be *named*. At 0.5 both happen to read 9, which hides the difference. The curve also saturates instantly: 11/11 at 233 lines, and thresholds 0–0.2 are 480–502 lines. Use a finer grid between 0.3 and 0.9 and plot problems-found versus lines-opened with a random-review diagonal (opening 96 random lines finds ~2.1 problems; the model finds 9).
   - **Tiny denominators.** Two examples per class (three for misclassified). One miss moves class recall by 33–50 points. The matrix is a 5×5 of twos.
   - **Check count/items mismatch.** "Planted problems the model did not name — 2 of 11" lists three chips (L-0228, L-0229, L-0240) because the count is problems and the items are lines. Show "dup-1 (L-0228 + L-0229)" as one chip.
   - **Decoys are invisible.** The three lines that look wrong and are not (credit note, round 25,000 lease payment, 18,000 prepayment) are the most persuasive evidence in the demo and appear nowhere in the report; they are not even in the labels file (no `kind: decoy`), so they cannot be graded on a re-run. Add them as labelled negatives and a "Tempting but correct — left alone 3/3" check.
   - Charts that fit: (a) a **ledger strip** — 502 ticks in posting order, planted problems as tall markers coloured caught/missed, false alarms as short amber ticks, VAT cluster as its own hatch; (b) per-issue recall bars with n shown; (c) the gain curve described above; (d) severity dot plot split planted / false alarm / clean to show separation (planted 1.8–4.4, VAT cluster ~3.9–4.0 — it does *not* separate, which is worth seeing).
   - Baseline: a rules engine (document imbalance, date outside period, exact twin) would catch 8 of 11 with near-zero false alarms; the model's added value is the 3 misclassifications (2 caught) and leaving the credit-note decoy alone. Show that comparison honestly.

5. **Bespoke Present screen.**
   - Beat 1 — "502 lines, one month, 11 things wrong." Full-width ledger strip, all grey, counter "0 of 11 found". 
   - Beat 2 — hero **L-0106** (duplicate, caught): bench view, the twin DOC-0080 slides in from the right, verdict "Duplicate posting". Then **L-0142** (reversed sign, severity 4.4): the balance beam tilts.
   - Beat 3 — hero **L-0460** (owner draw posted as salary, severity 4.2): memo and account chip ringed in disagreement. (The PRP's capex beat, L-0240, was *missed* in the recorded run — do not use it as a success beat; use it in beat 4.)
   - Beat 4 — honesty: the credit-note decoy left alone, then the two misses (L-0228/9, L-0240) marked on the strip.
   - Beat 5 — the gain curve with a draggable operating point; closing number: **"Open 96 of 502 lines, catch 9 of 11"** (or, after the VAT fix and a finer grid, the point where all 11 are caught).

6. **Re-runnable model test.** Benchmark card: problem recall (named) and line precision, per-issue recall with n, false alarms per 100 clean lines, decoys left alone (3/3), lines-to-open for 100% recall and for 80% recall, AUC of `needs_human_review` against planted, severity separation (mean planted − mean clean), arithmetic agreement of `document_balances`, top false-alarm cluster with share. Gates: recall ≥ 80%, precision ≥ 50%, decoys 3/3, no single cluster > 30% of false alarms. Drift: per-line answer diff versus the previous model (flips listed by id). Dataset changes: fix the VAT chart; raise to ≥ 8 problems per class (≈ 45 problems, ~8%); label decoys; add hard negatives per class (legit reversal, accrual dated next month, legitimately unusual account); generate 3 seeds and report mean ± range; note that a duplicate's twin is always handed to the model in `same_amount_same_counterparty` capped at 4 — add a few non-duplicate same-amount recurring payments (rent, subscriptions) so that "has a twin" is not itself the label.

7. **Bugs and defects seen.**
   - Selected-row highlight lands on the wrong cells; row-header and tfoot backgrounds are inconsistent (`-3-stage-scored.png`, `-7-present.png`).
   - "Balances ⚠ Yes", "Memo Matches ⚠ Yes" amber for good values (`-5-evaluation.png`).
   - Curve occupies ~470px of an 880px panel with no ticks and the first three points stacked at x≈480–502 (`-6-report.png`).
   - Distribution legend percentages read "2 · 0%" for two classes (rounding of 0.4%); all five problem classes are the same amber.
   - Missed check shows "2 of 11" with three chips.
   - "Worth opening" marks planted lines but not false alarms; half the list is the VAT cluster.
   - PRP says "deposit as revenue"; the dataset planted "rent posted as travel" (L-0018) — spec and data disagree.

8. **Top 5 actions.**
   1. Fix the VAT receivable defect, regenerate and re-record (LEFTOVERS 1.1) — it contaminates every chart. [M] [demo-only]
   2. Extend `LedgerView` into the audit bench: twins, period bar, account habits, counterparty, a real selected-row state. [M] [shared-runtime]
   3. Add precision/recall/F1, decoy check and rules baseline to the report; make the curve's "caught" definition match the KPI. [S] [demo-only]
   4. Open on a hero item (L-0106) rather than L-0001; order the rail with planted/flagged first once scored. [S] [shared-runtime]
   5. Grow labels to ≥ 8 per class, label decoys, multi-seed. [L] [demo-only]

---

### 102 · Bank reconciliation (`bank-reconciliation`)

**Scores (0–10):** Story clarity 5 · Item stage 1 · Answers-to-decision legibility 4 · Report and charts 3 · Presenter readiness 1 · Evaluation rigour 1 · Re-run/benchmark readiness 2 — **overall 2.4**

1. **The one-sentence value.** "It matches each open bank line to the right ledger entry, clears the safe ones by itself, and names the reason for every one left." First paint (`bank-reconciliation-1-landing.png`) is a key/value table whose two main cells are **raw JSON strings** — `{"id":"S-0011","currency":"USD",…}` and a ten-line wrapped array of five candidates. This is the worst first paint in the domain; the PRP says the two-column view "is the shot that sells this demo" and it does not exist.

2. **Item stage review.** A reconciler needs: the statement line (date, signed amount, description, reference) on the left; five candidates on the right as aligned rows with **deltas computed against the statement line** — amount difference (absolute and %), day gap, reference similarity, counterparty match — and the chosen one highlighted. Hide `id` duplicates, `currency` when equal, `documentId`. Bespoke layout: left card "Bank says" with a large signed amount; right a five-row candidate table with columns Δ amount, Δ days, reference (matching characters highlighted), counterparty; a connector line drawn from the statement card to the model's pick, labelled with the break reason ("Partial payment · 92% of invoice · $1,051.43 still open"). For FX lines show both currencies side by side (EUR equal, USD differs, implied rate each side). For NONE, all five rows dim and the card says "Nothing in the books — book a bank fee of $35.90". Above it a thin **reconciliation waterfall** (opening → pre-cleared → auto-cleared → still open → closing) that fills as items are played.

3. **Answers and evaluation strip.**
   - `best_match` options are positional ("The first candidate in the ranked ledger list"). The intended entry is rank 1 in 36 of the 46 matched cases (78%) and rank 2 in the other 10, never 3–5, so position is a strong prior; shuffle candidate order per item with a seeded permutation and record the rank of the truth.
   - `break_reason` includes `MATCHED` — a non-reason inside a "why did it break" question; and `auto_clear` is fully determined by it (`autoCleared` requires MATCHED **and** quality ≥ 4 **and** noul ≥ 0.5, demo.js:85). Three of the four questions restate one decision; in the recorded run the quality threshold does nothing at all (curve is flat at 47/13 for thresholds 0 through 4).
   - Verdict card: **"Auto-clear → B-0015 · exact amount, 2 days apart"** or **"Leave open · partial payment · $5,038.80 of $5,700.00 received, $661.20 outstanding"**, plus "Ground truth: agrees (entry and reason)" and the proposed journal action (book fee / chase remainder / reverse duplicate B-xxxx-B).
   - `-5-evaluation.png`: "Flagged ⚠ Yes · Best Match none · Match Quality 0.02 · Clear Probability 0.07 · For Review ⚠ Yes" — five fields that all mean "bank fee, not in books".

4. **Report, charts and metrics.**
   - **Label leakage invalidates the result.** `buildState` passes `item.statement` whole and spreads every candidate (`...entry`, demo.js:34–38). Verified across all 60 items: statement references end in `-FEE` (9), `-PART` (8), `-FX` (7), `-DUP` (6), `-MISS` (5), `-PAY` (12 timing) or contain `MESSY` (13); ledger `documentId`s are `JRN-TIM-nn`, `JRN-PART-nn`, `JRN-FX-nn`, `JRN-DUP-nn-A`, `JRN-MESSY-nn`; descriptions say "Part payment", "EUR invoice at booking rate", "Open invoice". The break reason can be read off the suffix and the correct candidate is the one with the identical reference string. 60/60, 100% precision and an empty findings list are therefore meaningless. The handover (line 144) says a check fails if a planted value leaks; the check evidently compares label *values*, not encodings of them.
   - **The balance check is a tautology.** `reconcile()` (demo.js:155–160) sums opening + pre-cleared + auto-cleared + remaining; auto-cleared and remaining partition the same 60 lines, so the total is constant and `difference` is 0 for any answers whatsoever. It is presented as a passed control ("0 of 1"). A meaningful version reconciles the *book* side: after applying the model's proposed actions (clear, book fee, book FX difference, reverse duplicate), does adjusted book balance equal the statement balance, and by how much is it off when the model is wrong?
   - **Hidden sections.** `reconciliation` {opening 485,250.00; pre-cleared −188,584.54; auto-cleared −3,378.18; remaining −36,392.34; closing 256,894.94; difference 0} should be the hero chart: a **waterfall** with those five bars, auto-cleared in green, remaining split by break reason. `resolvedProblems` (60) is a single integer already shown in the checks; fold it into a KPI "Resolved exactly 60/60".
   - **KPI framing.** "Auto-clear rate 22%" reads as weak; the real story is 180 rule-cleared + 13 model-cleared of 240 = **80.4% straight-through**, and the 47 left each carry a named reason and proposed action. Add "of 60 rule-failures, 13 rescued; 47 explained". "Money left to reconcile $190,466.32" is gross absolute value while net remaining is −$36,392.34; say "gross" on the tile. The value wraps mid-number ("$190,46 / 6.32").
   - **Context-string bug:** "Human workload 47 · 60 answered so far" — the context is a progress note, not a qualifier of 47.
   - **Coverage curve is degenerate:** five identical points then a drop; rendered as one diagonal segment in `-6-report.png`. Axis label "Lines a person opens" against y "Correct auto-clears" — more work gives fewer clears, a confusing inversion. Replace with a bar per quality threshold: auto-cleared (correct / incorrect) versus sent to person.
   - Charts that fit: waterfall; break-reason bars *with money* (count and $ per reason); a candidate-rank histogram (rank of truth vs rank chosen); match-quality strip plot by label class (MATCHED should sit at 5–6, partial at 2–3, NONE at 0).
   - Baselines required: (i) always rank 1 + reason from amount/date rule; (ii) exact-reference string match. After de-leaking, these are the numbers to beat.

5. **Bespoke Present screen.**
   - Beat 1 — waterfall: "240 lines; a strict rule cleared 180. These 60 are why reconciliation takes two days." 
   - Beat 2 — hero **S-0033** (messy match: `DEMO26050239MESSY` vs `BOOK/239-…`, truncated counterparty "Pinefield") → auto-clear; the matching digits light up in both references. (Remove the literal word MESSY from the data first.)
   - Beat 3 — hero **S-0140** (partial payment, $12,706.01, largest open item): connector to the open invoice, remainder computed. Then **S-0040** (FX: EUR equal, USD differs) with the two implied rates.
   - Beat 4 — hero **S-0011** (wire fee $35.90): all candidates dim, "Not in the books — book bank charge".
   - Beat 5 — waterfall completes; closing number: **"193 of 240 lines cleared without a person; the other 47 arrive with a reason."**

6. **Re-runnable model test.** Card: exact-resolution rate (entry + reason), match top-1 accuracy with truth-rank breakdown, reason macro-F1, auto-clear precision and recall on MATCHED, **unsafe clears (count and $)** as a hard gate = 0, straight-through rate including rule pre-clears, $ explained vs unexplained, per-reason slice, rank-shuffle robustness (same items, permuted candidates — answers must not move), flips vs previous run. Dataset: strip class tokens from references, document ids and descriptions (use neutral `JRN-000123`, realistic bank narratives); make MATCHED negatives genuinely confusable (two candidates same amount, different counterparties; same counterparty, near amounts); add cases where truth is rank 3–5 and cases where a plausible-looking candidate exists for a MISSING line; 60 → ≥ 200 open lines so each reason has ≥ 25; 3 seeds.

7. **Bugs and defects seen.** Raw JSON in Statement and Candidates cells (`-1-landing.png`, `-3-stage-scored.png`); title with Unicode minus and amount wraps beside the phase chips; KPI value wraps mid-number and strip uses ~55% of width (`-6-report.png`); curve nearly empty; all six break reasons share one amber; "60 answered so far" context; rail labels wrap to two lines each.

8. **Top 5 actions.**
   1. Remove label tokens from references/documentIds/descriptions, regenerate, re-record, and extend the leak test to catch encoded labels. [M] [demo-only]
   2. Build the two-pane `reconciliation` view with per-candidate deltas and connector (LEFTOVERS 3.3; reusable by 104 and the orders domain). [L] [shared-runtime]
   3. Render `reconciliation` as a waterfall widget and replace the tautological balance check with a book-side adjusted-balance check. [M] [shared-runtime + demo]
   4. Shuffle candidate order; add rank and baseline metrics; reframe KPIs around straight-through rate and unsafe clears in $. [S] [demo-only]
   5. Collapse the redundant questions: keep `best_match`, `break_reason` (without MATCHED → add `NO_BREAK`), and make `auto_clear` the only gate with a threshold that actually moves the curve. [S] [demo-only, needs re-record]

---

### 103 · Expense posting (`expense-posting`)

**Scores (0–10):** Story clarity 6 · Item stage 3 · Answers-to-decision legibility 5 · Report and charts 3 · Presenter readiness 2 · Evaluation rigour 3 · Re-run/benchmark readiness 3 — **overall 3.6**

1. **The one-sentence value.** "It posts 400 card charges to the right account and knows which ones it should not post alone." First paint (`expense-posting-1-landing.png`) is a field dump for a 3.23 AED bank fee: `Amount 3.23` and `Currency AED` in separate cells, title printed twice, no chart of accounts, no vendor history. It reads as a database row, not a bookkeeping decision.

2. **Item stage review.** `QueueView` prints the first 12 simple keys; `priorPostings` (the single most decisive input) is an array and is silently dropped, as is the chart of accounts. Promote: vendor, description in quotes, amount with currency and sign (refunds in a distinct style), date, card mask. Hide: reference, paymentMethod (chip), isRefund (fold into amount), id duplicate. Bespoke layout: left a **card-statement line** (merchant, memo, amount); right a **chart-of-accounts ladder** — 12 account rows, each with a probability bar that fills as the answer lands, the winner pinned and the runner-up visible (this *is* the choice answer, so stage and answer merge); under the statement line a "This vendor before" mini-list (date, amount, account chip) or "First charge from this vendor"; policy chips "Receipt needed > 200 AED", "Capitalise > 500 AED" that light when triggered. A threshold line across the ladder shows auto-post vs review.

3. **Answers and evaluation strip.**
   - `receipt_required` is pure arithmetic against `receipt_required_above` (200) — not a judgement, never graded. `vat_treatment` is never graded either (no VAT label exists). Half the questions contribute nothing to the report. Either label and grade them (receipt: computed truth; VAT: planted) or cut them.
   - `posting_clarity` duplicates `account.confidence`; the report uses confidence for the threshold and clarity only for "Worth opening". Show whether they agree (scatter) or drop one.
   - The 1500 Hardware option depends on the capitalisation threshold — a genuine judgement the dataset barely tests (20 hardware items, all correct).
   - Strip (`-5-evaluation.png`): "Auto Post ⚠ Yes" — amber warning for the desired outcome; "Confidence 1"; "Vat out of scope"; Account and Account Name as separate fields.
   - Verdict card: **"Post 3.23 AED → 6000 Bank charges · auto (100%)"** / **"Hold for review · 54% Shipping vs 41% Office supplies"**, then "Intended: 5100 Office supplies — wrong, and held back by the 70% gate".

4. **Report, charts and metrics.**
   - **99.8% = the dataset, not the model** (LEFTOVERS 1.2, notes.md). 335/400 are single-account vendors and the state includes up to three prior postings *with the account* (demo.js:34–36), so 84% of the file is lookup. Even the 20 "no-memo" items mostly have 3 prior postings (E-0318, E-0249, E-0352). A **"copy the vendor's last account" baseline** would likely score ≥ 95%; the report must show it, because model-minus-baseline is the only honest headline.
   - **The curve is flat.** Points 0–0.3 are all 400/399/0.9975 and the curve is a dot cluster. With one error in 400, no threshold trade-off exists; the PRP's second video beat ("dragging 0.5 → 0.8, automation drops, accuracy rises") cannot be shown: automation moves 400 → 397 and accuracy 99.75 → 100.
   - **Notes contradict the report.** notes.md says E-0334 "is the one charge held back"; the report says 397 auto-posted, so **three** were held (two of them correct). 
   - **The one error is arguably a label problem.** E-0334 "Packing tape and boxes", 50 AED, Lantern Depot: history shows 5300 then 5100 twice; the model said Shipping at 54%. Packing materials → shipping is a defensible posting. The benchmark needs an "arguable" flag on labels.
   - **12×12 matrix**: 144 cells, 143 of them zero or diagonal; with the `td.empty` bug it stretches past the 3,600px screenshot limit (`-6-report.png` ends mid-matrix at "Hardware"), so the curve, checks and "Worth opening" are never seen. Even repaired, a 12×12 with one off-diagonal is the wrong chart: show **"top confusions" as a ranked list of pairs** and a per-account recall bar chart (n per account 19–49).
   - Column header says "Planted ↓ · Called →" — nothing is planted here; should be "Intended ↓ · Posted →".
   - Distribution bar: 12 equal grey segments with no tone — uninformative; replace with spend per account (AED) as horizontal bars, auto vs held stacked.
   - Right KPIs: automation rate at threshold, accuracy when automatic, **errors let through (count and AED)**, review queue size, accuracy on the hard slice (ambiguous 29/30, no-memo 20/20, refunds 15/15) — the per-kind checks exist and are the best part of this report; promote them to a slice table with n and a Wilson interval (29/30 → 83–99%).
   - Add calibration: reliability diagram/ECE is the PRP's stated purpose ("cleanest demo for the calibration argument") and is absent. With mean confidence ~0.99 and accuracy 0.9975 it will be trivially good until the dataset is hardened.
   - Money is missing entirely: total spend posted automatically, AED mis-posted.
   - Data glitch: E-0102 "Hotel, 39 nights, N. Farouk" for 192.75 AED.

5. **Bespoke Present screen.**
   - Beat 1 — "400 uncategorised charges, 12 accounts, quarter-end." A statement feed scrolling; counter of posted/held.
   - Beat 2 — hero **E-0102** (Kestrel Hotel — travel vs meals): the ladder shows a split between 5500 and 5510, memo decides.
   - Beat 3 — hero **E-0077** (Copperline Media, no description, 1,776.53 AED, only one prior posting): right from the vendor alone, clarity 3.0 shown as lower certainty.
   - Beat 4 — hero **E-0334**: 54% Shipping vs Office supplies — below the gate, routed to a person: "the only one it got wrong is the one it refused to post alone."
   - Beat 5 — threshold slider over the ladder population; closing number: **"397 of 400 posted automatically, 0 wrong."** (After hardening the dataset this becomes a real trade-off number such as "posts 78% alone at 99% accuracy".)

6. **Re-runnable model test.** Card: accuracy overall and **by slice** (clear / ambiguous / no-memo / refund / first-time vendor — 55 items with no history, currently unreported), automation rate and accuracy-when-automatic at fixed gates (0.7, 0.9), errors let through in count and AED, ECE and max calibration gap, coverage at 99% accuracy, lift over last-posting baseline and over majority-per-vendor baseline, top confusion pairs, receipt-rule agreement (computed truth). Gates: auto-accuracy ≥ 99%, hard-slice accuracy ≥ 85%, lift over baseline > 0 on the hard slice. Dataset: drop or cap vendor history (LEFTOVERS fix), raise ambiguous + no-history share to ≥ 40%, add vendors whose history is *misleading* (last posting wrong account for this memo — E-0334 is the only such case today), add capitalisation-boundary hardware (480 vs 520 AED), mark arguable labels, label VAT and receipt truth, multi-seed.

7. **Bugs and defects seen.** Duplicate title and redundant `E-0001` eyebrow (`-1-landing.png`); amount without currency, currency as its own field; `priorPostings` never displayed; "Auto Post ⚠ Yes" amber (`-5-evaluation.png`); report clipped by the exploded 12×12 matrix (`-6-report.png`); "Planted" header; all-grey distribution; KPI labels wrap to two lines ("Posted automatically", "Accuracy when automatic") making tile heights uneven; "Prior Balance"-style raw numbers without thousands formatting consistency ("3.23").

8. **Top 5 actions.**
   1. Harden the dataset (history capped/removed for ambiguous vendors, misleading histories, more first-time vendors) and re-record; publish baseline lift. [M] [demo-only]
   2. Build the statement-line + chart-of-accounts ladder stage with vendor history. [M] [shared-runtime, new `posting` view]
   3. Replace the 12×12 matrix with top-confusions + per-account recall; add slice table with intervals, calibration plot, money KPIs. [M] [shared-runtime widgets]
   4. Grade or remove `receipt_required` and `vat_treatment`; fix "Planted" wording and the notes.md "one held back" statement. [S] [demo-only]
   5. Threshold slider bound to the curve and to the queue split (auto vs review), as the PRP specified. [M] [shared-runtime]

---

### 104 · Three-way match (`three-way-match`)

**Scores (0–10):** Story clarity 7 · Item stage 2 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 2 · Evaluation rigour 5 · Re-run/benchmark readiness 5 — **overall 4.3**

1. **The one-sentence value.** "Before the payment run it holds the invoices that disagree with the PO or the goods receipt — and releases the ones that differ only within tolerance." First paint is a key/value table with three cells of raw JSON (`{"id":"PO-0001","date":…,"lines":[{…}]}`), `NET_30` raw and `Supplier History []`. The most visual idea in the domain — three documents side by side — is shown as three strings.

2. **Item stage review.** An AP clerk compares line by line. Bespoke layout: **three document cards in a row** (Purchase order · Goods receipt · Invoice) with headers (id, date, currency chip) and one aligned line-item band across all three: Qty ordered 40 → received **34** → billed 40; unit price 412.53 → — → 412.53. Differences computed in the view and drawn as delta chips between cards ("−6 received", "+3.0% price · tolerance 2%"), green when inside tolerance, red when outside; a tolerance gauge (a short bar with the 2% / 1-unit mark and the actual variance as a pointer) is the unmistakable visual. Below: invoice arithmetic strip (subtotal × 5% = expected tax vs billed tax) and a "Seen before?" strip listing the ≤ 2 earlier supplier packets with invoice id and GR id, ringed when identical (duplicates). For P-0001 the stage should scream "billed 40, received 34 — $2,598.94 for goods not delivered" without any model.
   Hide: incoterm, purchaseOrderId repetitions, `freight: 0`. Format `NET_30` → "Net 30".

3. **Answers and evaluation strip.**
   - `within_tolerance` and `hold_payment` are near-inverse questions, and `mismatch = NONE` is defined as "agree or within tolerance", so three of four questions encode one decision. `agrees()` (demo.js:139–145) requires all three to line up — fine as a strictness test, but the redundancy should be exploited as a **consistency metric** (how often do they contradict?) rather than presented as four independent answers.
   - `mismatch` is single-choice "primary result"; fine, but the option text for PRICE/QUANTITY already embeds "exceeds tolerance", so choosing PRICE for a 1.4% rise is a direct self-contradiction the report could count.
   - The model is asked to do arithmetic it demonstrably does not do (tax 0/5, tolerance 0/8). Consider giving computed variances in the state for a second "assisted" variant — model vs model+calculator is a much stronger benchmark story than a single run.
   - Strip (`-5-evaluation.png`): "Within Tolerance ✓ No" is rendered **green with a tick** while meaning "out of policy" — the inverse of the global amber-true bug; "Amount At Risk 2598.94" has no currency; "Within Tolerance Probability 0.04 / Risk Score 5.21 / Hold Probability 0.92" are three unlabelled scales.
   - Verdict card: **"HOLD · partial delivery · $2,598.94 billed for 6 units not received"** + "Planted: partial delivery — agrees" + next action ("short-pay or request credit note").

4. **Report, charts and metrics.** True matrix: price 9/9, quantity 7/7, currency 4/4, partial 6/6, tax 0/5 (all called none), duplicate 1/3 named (and that one released), none-row: 108 none + 4 price + 4 quantity.
   - **Currency-summing error.** `documentRisk` returns `item.invoice.total` for CURRENCY (demo.js:134) and `money()` formats it as USD. P-0010 is 24,611.60 **AED**, P-0043 23,959.16 AED, P-0022 15,799.15 GBP, P-0101 14,139.77 EUR — displayed as "$24,611.60" etc. These four total 78,509.68, i.e. **75% of the "$104,820.51 held" KPI** and the top three "Worth opening" rows. Either convert at a stated rate or exclude currency mismatches from the money sum and report them as "4 invoices in the wrong currency".
   - **The money metric hides the tax failure.** All five tax errors together are $586.35 of exposure; duplicates are $32,408.42. So "$32,994.77 missed" is 98% duplicates. Count-based recall (26/34 = 76.5%) and money-based recall (76.1%) agree by coincidence. Report both per class.
   - **"False holds 6.9%" is a misleading average.** It is 0/108 on exact packets and **8/8 on the negative controls** — the model never once applied the tolerance. The PRP calls false-hold rate "the number that decides whether AP would tolerate this"; show it split: "Exact packets held 0/108 · Allowed differences held 8/8" with the second in red.
   - **A rules engine beats the model here.** Price, quantity, tax, currency, partial delivery and tolerance are all deterministic from structured fields; a 30-line rule set scores 31/34 + 8/8 controls, and duplicates need only an invoice-id lookup. The report must show that baseline. As built, the demo demonstrates that the model is *worse* than the rule. To make the use case honest, the state has to contain what rules cannot read: free-text invoice lines, unit-of-measure differences (box of 10 vs each), renamed item descriptions, freight and discount lines, split deliveries across two GRs, credit-note references. Then "rules: 40%, model: 85%" becomes the story.
   - **Hidden sections.** `money` {held 104,820.51; released 32,994.77; total 137,815.28; difference 0} → a single **stacked exposure bar** (held green / missed red) broken down by mismatch class, with counts annotated; it should sit directly under the KPIs. `supplierRanking` (23 suppliers; Bluewater Print 2 · 26,126.09, Copperline Works 2 · 24,842.77, Meridian Print 1 · 15,799.15, Orchard Foods 1 · 14,783.75…) → horizontal bars, top 8, each split held/missed. Note that it is computed purely from **labels** (demo.js:251–259), so it is identical on every run and says nothing about the model; rank by model-held exposure and mark agreement with planted, otherwise it is dataset description, not a result. It also inherits the currency error (three of the top four suppliers are currency cases).
   - Curve: the risk-score threshold cannot recover the misses — at ≥ 2: 36 held / 27 caught; at ≥ 1: 104 held / 34 caught. So the tax and duplicate packets score between 1 and 2 (P-0149 risk 1.1, P-0099 1.6, P-0124 2.6). Worth stating: "no threshold fixes this; it is a reading failure". The dashed precision line and the solid count line share one unlabelled axis in `-6-report.png`.
   - `documentRisk` reads only `lines[0]`; fine today (one line per packet) but wrong the moment multi-line packets are added.
   - Missing: precision 26/34 = 76.5% of holds real, F1 0.76; cost-weighted error (missed $ vs false-hold handling cost at, say, $15 each); agreement between the three redundant answers.

5. **Bespoke Present screen.**
   - Beat 1 — "150 invoices queued for Friday's payment run. 34 should not be paid as billed." Three-document bench empty, payment-run total ticking.
   - Beat 2 — hero **P-0008** (exactly +3.00% vs 2% tolerance, $486.86): tolerance gauge pointer lands outside the band → HOLD. Then **P-0001** (40 billed / 34 received, $2,598.94).
   - Beat 3 — hero **P-0013** (+1.40%, inside tolerance): the gauge pointer sits *inside* the band and the model still holds it. Say so: "it sees the difference; it does not apply the policy — 8 of 8." This is the most credible beat in the domain because it shows the harness catching a failure.
   - Beat 4 — hero **P-0149** (duplicate of INV-0109, $14,783.75, risk 1.1, released): the "Seen before?" strip rings the identical invoice id the model ignored. Pair with **P-0124** (named duplicate, still released).
   - Beat 5 — exposure bar by class; closing number after the currency fix: **"26 of 34 held; every miss is tax arithmetic or history — that is what the next model version has to beat."** For a positive close, use the per-class bars: price/quantity/currency/partial 26/26.

6. **Re-runnable model test.** Card: hold recall and precision, per-class named+held (6 classes), **tolerance-control pass rate (n=8 → raise to ≥ 30)**, exact-packet false-hold rate, exposure held/missed in one currency, duplicate recall (history use), tax-arithmetic recall, answer-consistency rate across the three redundant questions, rules-engine baseline side by side, flips vs previous run. Gates: tolerance controls ≥ 90% released, exact false holds ≤ 1%, duplicate recall ≥ 2/3, missed exposure ≤ 10%. Dataset: FX-convert or exclude currency totals; ≥ 15 per class (duplicates 3 → 15, tax 5 → 15); boundary cases at 1.9/2.0/2.1% and ±1/±2 units; multi-line packets; rule-proof cases (UoM, renamed items, split GRs); duplicates whose earlier packet is *not* in the two-packet history window to test "unknowable" honestly; 3 seeds. Fix handover 104's stale 3.5× token rule (LEFTOVERS §4).

7. **Bugs and defects seen.** Raw JSON for Purchase Order, Goods Receipt, Invoice; `[]` for Supplier History; `NET_30` (`-3-stage-scored.png`); "Within Tolerance ✓ No" green for a breach and "Amount At Risk 2598.94" unitless (`-5-evaluation.png`); KPI "$104,82 / 0.51" wraps mid-number; tax column in the matrix is entirely empty yet the row shows 5 under "none" in pink with no emphasis; check labels lower-case and negatively phrased ("price problems not resolved · 0 of 9" with a green tick — a double negative); "Worth opening" mixes foreign-currency totals labelled with $ (`-6-report.png`); findings line says "5 of 15 mismatch errors" without saying that the other 10 are 8 tolerance + 2 duplicates.

8. **Top 5 actions.**
   1. Fix the currency summation in `documentRisk`/`money` and restate KPIs, top items and supplier ranking. [S] [demo-only]
   2. Build the three-document aligned view with computed deltas and tolerance gauge (shared `documents` view with 102; LEFTOVERS 3.3). [L] [shared-runtime]
   3. Add the rules baseline and split false holds into exact vs tolerance controls; render `money` as a stacked exposure bar by class and `supplierRanking` as split bars driven by model output. [M] [shared-runtime + demo]
   4. Make the dataset rule-proof (free text, UoM, split receipts) and enlarge the small classes; consider an "assisted" variant with variances in the state. [L] [demo-only]
   5. Positive check wording ("Price: 9 of 9 held and named") and a consistency metric across the redundant questions. [S] [demo-only]

---

### 105 · Close blockers (`close-blockers`)

**Scores (0–10):** Story clarity 7 · Item stage 4 · Answers-to-decision legibility 5 · Report and charts 5 · Presenter readiness 3 · Evaluation rigour 4 · Re-run/benchmark readiness 4 — **overall 4.6**

1. **The one-sentence value.** "On working day four it turns a 60-account trial balance into a ranked list of what is actually stopping the close and whose desk it belongs on — without crying wolf on big movements that are fully supported." First paint: account 1000 Cash at bank, a 2×5 grid of numbers (`Prior Balance 838,042.6`, `Expected Movement Low −67,000`) and "Checked against last month, as expected." No board, no lanes, no deadline. The PRP's "four owner lanes filling up" does not exist anywhere.

2. **Item stage review.** The preparer note "carries most of the signal" (PRP) yet is the last, smallest-context field, styled identically to `Open Items 0`. Promote: the note as a quoted block with the preparer's voice; movement against the expected band; reconciliation status as a status chip; open items. Hide: `Account` and `Name` (already in the title twice), `Category` as a chip. Format: GBP with no pence, signed movement with direction words (the data stores liabilities credit-negative, so TB-2210 shows movement −163,951 while its note says "up 80%", and TB-2320 shows +253,284 while the note says "down by almost the whole balance" — display must normalise sign by account category). Bespoke layout: top, a **movement bullet chart** — expected band (−67k…+67k) as a grey bar, actual movement as a marker, materiality £25k as dashed lines; this makes the decoy story instant (marker far outside the band, yet "not a blocker"). Middle: the note as a large quote card with the phrases the verdict hinges on underlined ("Schedule is attached", "No approval in the folder"). Right: close calendar "Day 4 of 6" and reconciliation chip. After scoring, the card flies into one of **five owner lanes** (AP, AR, Treasury, Tax, Controller — the PRP says four; the code has five) on a persistent board beneath, with a readiness meter.

3. **Answers and evaluation strip.**
   - Questions are the best-formed in the domain: type, gate, severity, owner are distinct. But `blocker_type = NONE` and `blocks_close = yes` can coexist, and in the recorded run they do on 3 of 6 decoys (TB-1310, TB-2320, TB-2720). `evaluate` (demo.js:98–100) then prints a board label "2720 Provisions – restructuring · none · CONTROLLER" — a blocker with no reason. Decide a rule (block only when type ≠ NONE *and* noul ≥ 0.5, reporting contradictions separately) — under that rule this run scores 6/6 on decoys, which shows how fragile the headline is.
   - `outsideExpected` and `material` are computed from the item, not the model, yet sit in the same strip as answers, styled the same.
   - Owner ground truth encodes a house convention (notes.md admits 2 of 4 disagreements are arguable). Accept a set of owners per label, or report "strict" and "lenient" agreement.
   - Verdict card: **"BLOCKS THE CLOSE · unsupported journal · £63,000 · Controller · severity 5.1"** / **"Ready — movement large but supported (schedule attached)"**, then "Planted: blocker/decoy/clean — agrees", with days to deadline.

4. **Report, charts and metrics.** True matrix is a pure diagonal: 4/3/2/2/2 and 47 none. 13/13 blockers, 0/41 false blocks, 3/6 decoys blocked, owner 9/13.
   - **"agrees" on a wrong decision.** `topItems` tags `· agrees` when only the blocker *name* matches (demo.js:243, `named()`); the fifth "Worth opening" row is "2720 Provisions – restructuring · none · CONTROLLER · agrees · £100,307" — a decoy the model wrongly blocked, labelled as agreement. Use full agreement (type + gate) and mark decoys explicitly.
   - **Too easy, and leaky by construction.** All 41 clean accounts have movement inside the expected band (0 outside), one of 8 templated notes ("Checked against last month, as expected.") or none, and a "Reconciled N September" status; every blocker note is a confession ("Not done.", "No accrual booked for the audit", "No approval in the folder"), several restating the option text nearly verbatim. Any keyword rule gets 60/60 on type. The only items that test judgement are the 6 decoys and the 4 quiet-movement blockers — 10 items. Needed: clean accounts with long, messy, worried-sounding notes; clean accounts outside the band with thin notes; blockers whose note is evasive or reassuring ("should be fine"); contradictions between note and numbers (note says reconciled, 21 open items).
   - **Tiny denominators:** five blocker classes of 2–4. "Owner agreement 69.2%" is 9/13; each account is 7.7 points.
   - **"Readiness after the top five 81.7%"** is `(cleared + 5)/60` — arithmetic, not a model result, and the top five by severity includes the decoy 2720, so fixing them does not mean five real blockers cleared. The PRP beat "71% → 96%" is not what the data gives (73.3% → 81.7%; all 16 held → 100%). Replace with a **burn-up**: x = blockers worked in ranked order, y = true readiness, where decoys produce a flat step (wasted effort), against a baseline ordering by absolute movement. That chart *is* the value of ranking.
   - **Curve is degenerate:** severity bars 0–3 give identical points (16/13/0.813); notes say bar 5 → 4 accounts, all real. Draw as a small table/step chart: bar → queue size → real → precision.
   - **Distribution bar** shows owner lanes (2/2/4/2/6 + 44 cleared) all amber — it is the owner-lane view the PRP wanted, squeezed into a generic bar; legend shows "ap", "ar" lower-cased. Make it the five-lane board with cards sized by £ movement.
   - Missing: baseline (flag if outside band or material: catches 9/13 blockers and wrongly flags 5/6 decoys — the model's 13/13 found and 3/6 left alone vs the rule's 9/13 and 1/6 is a genuinely strong comparison and is not shown); severity separation (4.65 / 3.50 / 1.38 is in the note string, not a chart — draw three dot strips); £ exposure by blocker type; contradiction count (type NONE but blocks).
   - Five KPIs overflow the four-tile rhythm; tiles are narrow and text-heavy (`-6-report.png`).

5. **Bespoke Present screen.**
   - Beat 1 — "Working day 4 of 6. Sixty accounts. What is stopping the close?" Trial balance as 60 bullet-chart rows; a naive movement rule lights 14 of them (9 real, 5 decoys) and misses 4 real ones.
   - Beat 2 — pair: hero **TB-2210** (bonus accrual, −£163,951, "Yes it is up 80%… approval in the close folder") → *not* a blocker; next to **TB-2700** (legal accrual, movement −£8,542, inside the band, "has worked all month and has not billed") → blocker. "The big one is fine; the quiet one is not."
   - Beat 3 — hero **TB-1400** (unsupported £63k write-down, journal 4488) → Controller lane; the five lanes fill: AP 2, AR 2, Treasury 4, Tax 2, Controller 6.
   - Beat 4 — honesty: **TB-2720** (restructuring release, board minute filed) lands on the board anyway — "3 of 6 supported accounts still held: it named them NONE and blocked them regardless."
   - Beat 5 — burn-up of readiness as ranked blockers are ticked; closing number: **"13 of 13 real blockers on the board, none hidden in the 73% it cleared."**

6. **Re-runnable model test.** Card: blocker recall (named + held), decoy pass rate, ordinary false-block rate, owner agreement strict/lenient, type–gate contradiction count, severity separation (means and AUC blocker vs decoy), ranked-list quality (precision@5, NDCG by £), readiness with hidden-blocker count, threshold-rule baseline, flips vs previous run. Gates: recall = 100% (a missed blocker is the costly error), decoys ≥ 5/6, contradictions = 0, hidden blockers = 0. Dataset: 60 → 150–200 accounts across 3 entities/months; ≥ 10 per blocker type; ≥ 20 decoys; adversarial clean notes and evasive blocker notes as above; owner labels as sets; several note-writers' styles; seeds. Keep the "no note" negatives (5 today) and add "no note but blocked" positives.

7. **Bugs and defects seen.** Title three times (h2, eyebrow TB-1000, h3) and again as Account/Name fields (`-3-stage-scored.png`, `-7-present.png`); `838,042.6` one decimal next to `830,788.81`; no currency on any figure; sign convention contradicts the notes on liability accounts; decoy row tagged "agrees" (`-6-report.png`); legend owners lower-cased; checks phrased as double negatives with green ticks ("Unreconciled not caught 0 of 4"); curve has two visible points plus a dashed line on an unlabelled shared axis; PRP says four lanes, code has five owners; report `note` is a 3-sentence paragraph in the subtitle slot.

8. **Top 5 actions.**
   1. Build the close board: bullet-chart stage with note as quote + five owner lanes + readiness meter (also the Present centrepiece). [L] [shared-runtime, new `close-board` view]
   2. Fix `agrees` to require type + gate; resolve the NONE-but-blocks contradiction in `evaluate` and report it as its own metric. [S] [demo-only]
   3. Add the movement/materiality rule baseline and the readiness burn-up versus that baseline. [M] [demo-only + widget]
   4. Harden and enlarge the dataset (adversarial notes, more decoys, owner sets), re-record. [L] [demo-only]
   5. Normalise sign and currency display by account category; positive check wording. [S] [shared-runtime formatting + demo]

---

## Domain summary

**Cross-demo patterns**

1. **Results are either suspiciously perfect or dominated by one artefact.** 102: 60/60 with labels encoded in references. 103: 399/400 on a lookup-dominated file. 105: 60/60 on type with confession-style notes and templated clean notes. 101: 68 of 75 false alarms from one chart-of-accounts defect. 104 is the only demo whose failures are informative (tax 0/5, duplicates 0/3 held, tolerance 0/8) — and there a rules engine would outscore the model. No demo in the domain shows a **baseline**, and in every one the baseline changes the story.
2. **Identity checks presented as controls.** 102's closing-balance check and 104's held + released = total cannot fail regardless of model output; they add green ticks without adding evidence. Keep them as unit tests, not as report rows.
3. **Redundant question sets.** 102 (MATCHED ≡ auto_clear), 104 (NONE ≡ within_tolerance ≡ ¬hold), 101 (`document_balances` is arithmetic), 103 (`receipt_required` is arithmetic; `vat_treatment` ungraded). Un-graded questions should be graded against computed truth or removed; redundant ones should be turned into a consistency metric.
4. **Tiny class denominators** (2–9 per class in 101, 104, 105) make per-class numbers and matrices decorative. Every demo needs ≥ 10–15 per class, labelled decoys/negative controls as a first-class slice, and multiple seeds.
5. **Money is the domain's native unit and is mishandled.** 104 sums four currencies as USD; 102 shows gross without saying so; 103 has no money in the report; 105 shows raw unsigned-convention numbers without £; 101 never totals the value of misposted lines. A shared `Money` formatter with currency and sign-by-account-type is needed.
6. **Generic views hide the decisive evidence.** 102 and 104 print JSON; 103 drops vendor history; 101 omits twins, period and habits; 105 buries the note. In each case the comparison the model is asked to make (statement vs candidates, PO vs GR vs invoice, line vs twin, movement vs band) can be *computed and drawn by the view* — so the viewer sees the answer forming before the model says it.
7. **Report wording is inverted.** Checks are phrased as failures with green ticks ("price problems not resolved 0 of 9"); "Planted" is used where nothing was planted (103); "agrees" is attached to partial agreement (105).
8. **Video beats in the PRPs no longer match the recorded runs**: 101's capex beat (L-0240) was missed; 103's slider beat has nothing to move; 104's 1.4% release is a hold; 105's 71% → 96% is 73.3% → 81.7%. The storyboards above use the real ids.

**Flagship pick: 104 · Three-way match** — after its two fixes (currency conversion, three-document view). Reasons: the concept is understood in three seconds by anyone who has paid an invoice; it has the most naturally visual stage in the domain (three documents, aligned lines, a tolerance gauge); money at risk is the native headline; and it is the only demo with an honest, legible failure profile (26/34, tolerance 0/8), which is exactly what a repeatable benchmark is for — a number the next model version can visibly move. 105 is the runner-up and the better *narrative* (big-but-fine vs quiet-but-blocking), but its board view is a larger build and its dataset is currently too easy. 102 must not be featured until it is de-leaked.

**Signature visual for the domain: the "tie-out".** Two or three source documents side by side with aligned rows, differences computed by the view and drawn as delta chips on connector lines, and a tolerance/expected band with a pointer showing whether the difference is inside or outside policy; beneath it a running **waterfall to a closing figure** (statement balance, payment-run total, close readiness) that moves as each item is resolved. 101 uses it as line ↔ twin/document, 102 as statement ↔ candidates, 103 as charge ↔ account ladder, 104 as PO ↔ GR ↔ invoice, 105 as movement ↔ expected band — one visual grammar, five demos, and the waterfall gives every Present screen its closing number.
