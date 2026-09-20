# Domain 3 · Fraud and financial crime — demo-by-demo review

Scope: 121 card-fraud-triage, 122 account-takeover, 123 aml-alert-triage, 124 sanctions-name-match, 125 mule-network, 126 insider-surveillance. Read-only. Numbers quoted come from the computed report dumps, and from side calculations run over `demos/<id>/data.json`, `fixtures.json` and `data/synthetic/<id>.labels.json` (AUCs, one-line rule baselines, consistency checks). The ten global findings in the brief are assumed fixed and are not repeated, except where a demo makes them worse in a specific way.

A note on method that matters for this domain: for every demo I asked "could a one-line rule on the state reproduce the labels?". In four of six demos the answer is yes. That is the single most important domain finding and it is detailed per demo under "Report, charts and metrics".

---

### 121 · Card fraud triage (`card-fraud-triage`)

**Scores (0–10):** Story clarity 8 · Item stage 3 · Answers-to-decision legibility 4 · Report and charts 6 · Presenter readiness 3 · Evaluation rigour 6 · Re-run/benchmark readiness 6

1. **The one-sentence value.** "Same 400 alerts, same analyst hour: the rules engine puts 6 of 16 frauds in the first fifty, the model puts 13." This is the best story in the domain and one of the best in the suite, because it is a before/after on a fixed budget. First paint does not land it: `card-fraud-triage-1-landing.png` shows a title, a 12-field key/value dump for ALT-0001 and "0 answered". Neither "6 → 13" nor the word "hour" appears anywhere above the fold. The demo's own `value` string is good; the numbers that prove it are 3,000px down.

2. **Item stage review.** The queue view (`web/src/demo/views/QueueView.jsx:12`) takes the first 12 simple fields and silently drops everything else. For this demo that means:
   - **The last ten authorisations are never shown.** `recentTransactions` is an array, so `isSimple` rejects it. The notes say "Does the history explain this?" is "doing most of the work in the re-ordering" — the one piece of evidence that drives the answer is invisible on the stage (`card-fraud-triage-3-stage-scored.png`).
   - `merchant`, `card`, `cardholder`, `usualCountries`, `ruleId`, `ruleScore`, `ruleRank` fall after the 12-field cut and vanish. The rule rank is only recoverable from the title string.
   - What is shown is unformatted: "Fired At 2026-08-14T01:52:00Z", "Rule Precision Percent 6", "Amount 4.12", "Typical Transaction 72.5", "Average Monthly Spend 1,450" — no £, no %, no "01:52, a Friday night".
   
   What a fraud analyst needs, in this order: (a) the transaction as a sentence — "£4.12 at Meridian Supplies · streaming · GB · 01:52 · new device · 9 declines in the last day"; (b) this card's normal — "typical £72.50, GB only, 4 years, never at this merchant"; (c) a **mini statement strip** of the last ten authorisations with the alerted one appended and highlighted, amounts as small bars so a £4 probe after £80 fuel purchases is visually obvious; (d) the rule that fired with its precision as a thin meter ("Velocity rule · right 6% of the time"); (e) **two rank chips side by side: "Rule queue #366 → Model queue #1"**. The chip pair is the whole demo in one glyph and should be on every item.
   
   Bespoke layout: left two-thirds = transaction sentence + statement strip; right third = a vertical "queue ladder" (a 400-slot thin column with the item's rule position and model position marked, the first-50 band shaded). For ALT-0366 the marker visibly leaps from the bottom of the ladder into the shaded band.

3. **Answers and evaluation strip.**
   - `fraud_likelihood` (score) is well formed and is the ranking key. AUC against the planted labels is 0.921; planted frauds sit at model ranks 1–9, 11, 12, 17, 46, 70, 85 and 337.
   - `fraud_type` is asked of all 400 alerts and produces the ugliest row in the report: **97 non-fraud alerts were given a fraud type** (12 card testing, 85 stolen card; matrix "None" row). The question says "If this is fraud…", so the model answers hypothetically. Either gate it (only grade type where the action is BLOCK/STEP_UP) or add the NONE criterion to the front of the question. As drawn, the confusion matrix says the model is wrong on 97 of 384 clean alerts when it actually closed or watched most of them.
   - Three of five planted types are unreachable from the state: account takeover (0 of 3 named), merchant collusion (0 of 2), friendly fraud (0 of 2). The notes admit collusion "needs several merchants' worth of data that a single alert does not carry". A label that cannot be derived from the state is not a fair test; either carry the evidence or collapse the taxonomy to what a single authorisation can show.
   - `contact_customer`: the notes call it "nearly uncorrelated with the fraud". That is not what the fixtures say — the noul alone ranks fraud with **AUC 0.922**, as good as the likelihood score. It is unusable as an instruction (207 yes) but it is not noise. The notes should be corrected, and the question narrowed as the notes already propose.
   - `explains_itself`: strong (1 − noul gives AUC 0.891; yes on 250 alerts, only 2 of 16 frauds).
   - Evaluation strip (`card-fraud-triage-5-evaluation.png`): "Contact Yes" and "Acted Yes" are amber warnings on a correctly blocked card-testing fraud; "Explained No" is green. The tones are inverted relative to meaning. `acted`, `closed` and `ruleRank` are report plumbing and should not be in the strip.
   - **Verdict card should read:** "BLOCK · likelihood 4.7 of 6 · card testing. Planted: card testing — correct. Rule queue #1 → model queue #5. £4.12 now, but 9 declines in 24h means the number is being tested." For ALT-0023: "CLOSE · 1.2 of 6. Planted: friendly fraud — missed, and unknowable at authorisation time (4 earlier purchases at this merchant)."

4. **Report, charts and metrics.**
   - Headline KPIs are right and in the right order (6 of 16 → 13 of 16 → "6 alerts to the same catch"). Keep them. Add: **fraud value in the hour** (total planted fraud is only £5,209 across 16 alerts, so state it honestly as value, not as a big number), **precision@50** (13/50 = 26% vs 6/50 = 12%), **AUC or average precision** for both orderings, and **alerts needed for 90% recall** (model: 85; rules: 366).
   - Missing cost side: 119 alerts were blocked or stepped up and 15 were fraud (12.6% precision on action); 100 step-ups is a lot of customer friction and is not headlined. "Cards blocked without fraud: 7" is toned good only because `7 > 16` is false (`demo.js:152`) — 7 of 19 blocks (37%) hit an innocent card; the tone rule is arbitrary.
   - "Loud false alarms let go 17 of 25" is toned warn, yet the 8 failures are concentrated: all 6 planned purchases and 2 weddings. Say that in the KPI context; it is a more interesting line than the generic list of decoy kinds.
   - **The baseline is a straw man.** The rule score's AUC against the labels is 0.538 — essentially random — because 16 of the 25 decoys were placed at rule ranks 6–50 (a 17th at 54) and 9 frauds at ranks 217–382 by construction. A three-flag count available in the state (new device + never at this merchant + any declines) already gets AUC 0.779. The demo needs a second baseline ("simple scorecard") or a critic will say the model beat a queue designed to lose.
   - **The right chart is a two-line cumulative gains chart**: x = alerts opened (0–400), y = frauds found (0–16), one line for rule order, one for model order, a vertical band at x = 50 labelled "one analyst hour", and the two intersections annotated 6 and 13. The current curve has only the model line, seven hand-picked stops, no ticks, and in `card-fraud-triage-6-report.png` a column of stacked dots at the right edge that reads as a rendering fault. The rule-order line is the entire point of the demo and it is not drawn.
   - Second chart: a **rank-change slope chart** (left axis rule rank, right axis model rank, 16 fraud lines in red, 25 decoy lines in grey). Frauds sweep upward, holidays sink.
   - Distribution bar: block/step up/watch are all the same amber; they are an ordinal scale and want a four-step ramp.
   - Denominators are tiny: 16 frauds, and per-type groups of 2–5. "0 of 3 account takeovers left alone" is not evidence of anything. The per-type checks should be collapsed or the dataset enlarged.

5. **Bespoke Present screen (4 beats).**
   1. *"One hour, fifty alerts."* Full-width queue ladder of 400 slots in rule order, first 50 shaded, 16 frauds as red ticks: 6 inside the band, 10 outside, 9 of them buried between 217 and 382. Big caption "6 of 16".
   2. *Hero ALT-0366* (£220.95 at Quarry Rentals, rule rank 366). Statement strip on screen; the model answer lands (4.9 of 6, stolen card, block); the rank chip flips 366 → 1.
   3. *Decoy.* A holiday-abroad alert from the loud band (ALT-0155 is labelled "holiday abroad") closing with "the card's own history explains this"; then the honest counter-beat, ALT-0036 (a planned electronics purchase the model still stepped up), held for two seconds.
   4. *The re-sort.* The ladder animates from rule order to model order; red ticks flood into the band. Closing number: **"6 → 13 of 16, same hour, same alerts"**, then the gains chart with both lines.
   This needs LEFTOVERS 3.2 (a queue that can sort by an evaluation field). That section is correct that it is the most video-worthy outstanding runtime change; note that the beat does not need a generic sortable table — a purpose-built 400-slot ladder animating between two precomputed orders is smaller to build and looks better on camera.

6. **Re-runnable model test.** Benchmark card per run: frauds in first 50 (gate ≥ 12 of 16); alerts to 90% recall; AUC/average precision of `fraud_likelihood`; precision of BLOCK (gate ≥ 60%); decoys released by kind (holiday, wedding, planned purchase, renewals — gate: no kind at 0%); step-up volume; both baselines (rule order, simple scorecard) recomputed; drift vs previous model version on every line, plus a list of items whose action changed. Dataset changes for a fair repeatable test: 16 positives is too few for stable ranking metrics — go to ≥ 60 frauds (or 3 seeds × 400 alerts and report mean ± range); plant quiet/loud placement at random rather than adversarially, or publish both "adversarial" and "neutral" rule queues; drop or evidence the three unreachable types; keep `ruleScore`/`ruleRank` out of the state (already done — good).

7. **Bugs and defects seen.**
   - `recentTransactions` and seven other fields never rendered (QueueView 12-field cut) — `card-fraud-triage-3-stage-scored.png`.
   - Raw ISO timestamp, amounts without currency, "Rule Precision Percent 6" — same screenshot.
   - Evaluation tones inverted ("Acted ⚠ Yes" on a correct block) — `card-fraud-triage-5-evaluation.png`.
   - Curve: stacked dots at right edge, no rule-order line, no ticks — `card-fraud-triage-6-report.png`.
   - Top-items list repeats "block" ten times and hides the type; the "· fraud" suffix is the only truth signal and is plain text.
   - `notes.md` claim about `contact_customer` contradicts the fixtures (AUC 0.922).

8. **Top 5 actions.**
   1. Draw the two-line gains chart with the 50-alert band, and promote "6 → 13" to the hero strip at first paint [M] [shared-runtime widget, demo-only data].
   2. Build the queue ladder + rank chips and the animated re-sort (closes LEFTOVERS 3.2) [L] [shared-runtime].
   3. Bespoke alert card with the statement strip; stop dropping arrays in QueueView [M] [shared-runtime].
   4. Add a simple-scorecard baseline and precision/friction KPIs; fix the "blocked without fraud" tone rule [S] [demo-only].
   5. Gate `fraud_type` grading to acted alerts and drop or evidence the three unreachable types; correct the notes [S] [demo-only].

---

### 122 · Account takeover (`account-takeover`)

**Scores (0–10):** Story clarity 6 · Item stage 6 · Answers-to-decision legibility 3 · Report and charts 3 · Presenter readiness 3 · Evaluation rigour 3 · Re-run/benchmark readiness 3

1. **The one-sentence value.** "Catch every stolen session while challenging as few real customers as possible — and pick the lightest check that works." First paint shows SES-0001, a normal GB session with login → balance → £38.65 transfer. Nothing is at stake in it. The demo opens on the least interesting of 260 items; the first interesting one is SES-0020.

2. **Item stage review.** The timeline view is a real bespoke view and the best-structured stage in the domain after 126, but it omits precisely the facts that decide the hard cases (`web/src/demo/views/TimelineView.jsx`):
   - **Previous login** (`account.recentLogins`) — the notes stress that impossible travel "is never supplied as a flag" and must be inferred from the previous login's time and country. The viewer cannot do that inference because the previous login is not drawn.
   - **Customer context** — `travelNotice`, `emergencyTransferNote`, `deviceReplacementTicket`, `trustedHouseholdDeviceIds`. These are what make a decoy a decoy. None are shown.
   - Usual login hours, known beneficiaries (so "beneficiaryid: BEN-ACC-70000-1" cannot be read as known/new), largest 90-day transfer.
   - Event details are dumped as "amount: 38.65 · beneficiaryid: BEN-… · currency: USD".
   
   Bespoke layout: a horizontal **session rail**. Far left, greyed, the previous login ("GB · 18h ago · DEV-0001-A"); a gap labelled with the elapsed time and distance ("4h · GB → NG: not flyable"); then the current session's events as nodes coloured by the bank's own `actionRiskWeights` (login 0, change phone 5, add beneficiary 5, transfer 6), with a running cumulative risk line underneath. Context notes appear as pinned cards above the rail ("Travel notice: EG, 13–18 Sep"). The chosen intervention is drawn as a **gate** on the rail at the event where it would bite (PRP beat: "blocked in the middle"), with its friction points on the gate (push 1 · call-back 3 · documents 6 · block 8 · freeze 12).

3. **Answers and evaluation strip.**
   - Two questions are conditional but asked unconditionally, and the answers show it. `step_up_method` returned a method on **230 sessions where the action was not STEP_UP** (SES-0001: action allow, method "push approval" — visible in `account-takeover-5-evaluation.png`). `customer_friction_justified` is "yes" (0.61–0.75) on **231 of 231 ALLOW sessions**, where there is no friction to justify. It is a constant; it carries no information and renders as an amber "Friction Justified ⚠ Yes" on a clean session.
   - Fix: fold the method into the action enum (ALLOW · PUSH · CALL_BACK · DOCUMENT_CHECK · BLOCK_SESSION · FREEZE_ACCOUNT) — that is the actual decision ladder and it is ordinal in friction; replace the noul with "Would a push approval alone stop the loss in this session?".
   - `strongest_signal`: impossible travel named 0 of 8 times, behaviour shift 0 of 3. The model collapses everything onto "beneficiary change" (the last loud event). Either this is a real finding worth a headline ("the model reads the ending, not the cause") or the single-label design is unfair, since every takeover template ends ADD_BENEFICIARY → TRANSFER. I lean to the latter.
   - Strip duplicates: `flagged` and `challenged` are the same boolean; `predictedTakeover` is a threshold of `likelihood`; `frictionProbability` is the constant above.
   - **Verdict card should read:** "FREEZE ACCOUNT · 5.6 of 6 · SIM swap chain (phone changed → limit raised → new payee → transfer). Planted: takeover — caught. Policy's least-disruptive action was FREEZE — match. Friction if this had been a real customer: 12 points."

4. **Report, charts and metrics.**
   - **The dataset is too easy and the headline hides it.** `takeover_likelihood` separates the classes perfectly (AUC 1.000; highest normal session 1.07, takeovers 5.4–5.7). The 226 normal sessions contain only LOGIN_SUCCESS / VIEW_BALANCE / TRANSFER, none on a new device; a rule "any credential/beneficiary/limit event in the timeline" gives 14 true positives and 5 false. Each takeover shape is one fixed event template (all four SIM swaps are LOGIN → CHANGE_PHONE → RAISE_LIMIT → ADD_BENEFICIARY → TRANSFER).
   - **"Action accuracy 91.5%" is 226 free points plus 12 of 34.** On the 34 sessions that are not trivially normal, the exact least-disruptive action was chosen **12 times (35%)**: 7 of 14 takeovers (it froze the account on all 14, where policy wanted BLOCK_SESSION for the 4 credential-stuffing and 3 hijack cases) and 5 of 20 decoys (new phone only). All 5 emergency transfers with a pre-notification on file were blocked (8 points each = 40 of the 50 friction points); all 5 shared family devices were pushed; all 5 travellers were allowed where policy wanted a push. The honest headline is "catches everything, always reaches for the biggest hammer".
   - **Friction is only counted on legitimate customers**, so freezing (12) where a session block (8) would do costs nothing in the report. Over-reaction on true takeovers is a real operational cost (a frozen account is a call-centre case) and should be a KPI: "Over-escalated: 7 of 14".
   - **Hidden sections (global finding 8).** `decoys` is a 20-row table {id, shape, action, method, frictionCost, expectedAction} — this is the most interesting content in the report and is not rendered. Draw it as a **4 × 5 decoy grid**: rows = travel, new phone, emergency transfer, shared device; five cells each, coloured by outcome (green = policy action, amber = heavier than policy, blue = lighter), each cell showing the action glyph and friction points. `friction` = {points 50, challengedLegitimate 15, legitimateSessions 246}: draw as a stacked bar of the 50 points by decoy kind (40 emergency, 5 shared, 5 new phone, 0 travel).
   - The curve is degenerate (`account-takeover-6-report.png`): 14 of 14 caught at every threshold shown, so it is a vertical line and a flat line; the x axis is friction points (296 → 40 → 15 → 15), which the fixed table labels "Lines opened". With perfect separation there is no trade-off to show. Once the data is harder, the right chart is **catch rate (y) against legitimate friction points (x)** with the action-ladder operating point marked, and the PRP's "friction counter moving as the threshold moves" tied to the slider.
   - "Worth opening" shows "freeze account · 12 points" on true takeovers — friction points are defined as a cost to legitimate customers, so printing them against attackers is misleading. It also shows customer names with no session id.
   - KPI 1's context repeats the friction figure that KPI 2 and KPI 4 also carry; three of four tiles say "50".

5. **Bespoke Present screen (4 beats).**
   1. *SES-0083, SIM swap.* Session rail plays left to right: login on a new device, CHANGE_PHONE lights red, RAISE_LIMIT, ADD_BENEFICIARY; the gate drops before TRANSFER. "5.7 of 6 · freeze".
   2. *SES-0021, the customer with a new phone* (device-replacement ticket pinned above the rail): push approval, 1 friction point. The contrast with beat 1 is the use case.
   3. *The honest beat, SES-0026*: emergency property deposit, customer pre-notified the bank, the model blocks the session (8 points) where policy wanted a call-back (3). Show the decoy grid filling: one green row, three off-policy rows.
   4. *Threshold slider* on the catch/friction chart. Closing number today: **"14 of 14 takeovers caught for 50 friction points across 246 genuine customers"**; after the dataset is hardened, the closing number should be the friction at 100% catch versus a rules baseline.

6. **Re-runnable model test.** Record: catch rate by shape; legitimate challenge rate; friction points total and by decoy kind; **action accuracy on the non-normal subset** (gate ≥ 70%; today 35%); over-escalation count on true takeovers; signal accuracy excluding NONE; AUC; answer-consistency violations (method given without step-up: 230 today; gate = 0). Dataset: add noisy normals (new devices, password resets, new payees that are genuine, foreign logins without a notice) so that negatives are not three-event sessions; vary each takeover template (order, timing, partial chains, abandoned attempts); at least 40 takeovers; make some decoys lack a convenient context note; stop sending `device.isNew` as a precomputed flag if "new device" is meant to be inferred.

7. **Bugs and defects seen.**
   - "Step Up Method: push approval" with "Action: allow"; "Friction Justified ⚠ Yes" on an allowed session — `account-takeover-5-evaluation.png`.
   - Degenerate coverage curve (one vertical segment, one flat) — `account-takeover-6-report.png`.
   - Previous login and customer context absent from the stage — `account-takeover-3-stage-scored.png`.
   - Baseline line is a run-on string ("GB · 1 usual device · average transfer $925.50"); event details printed as "beneficiaryid:".
   - "Worth opening" attaches friction points to attackers and omits session ids.
   - `buildState` sends the whole item (`demo.js:27`), so anything added to the item later goes to the model unreviewed — fragile for a benchmark.

8. **Top 5 actions.**
   1. Report action accuracy on the hard subset and over-escalation; stop headlining 91.5% [S] [demo-only].
   2. Render the decoy grid and friction-by-kind bar from the already-computed `decoys`/`friction` [M] [shared-runtime widget].
   3. Add previous login, context cards and risk-weighted nodes to the timeline; draw the intervention as a gate [M] [demo-only view].
   4. Merge action + method into one ordinal ladder question; replace the constant noul; re-record [M] [demo-only].
   5. Harden the dataset (noisy normals, varied templates, ≥ 40 takeovers) [L] [demo-only].

---

### 123 · AML alert triage (`aml-alert-triage`)

**Scores (0–10):** Story clarity 7 · Item stage 3 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 3 · Evaluation rigour 3 · Re-run/benchmark readiness 3

1. **The one-sentence value.** "Cut a 300-alert monitoring queue to what two analysts can actually work, without losing one alert that matters, and name the typology." First paint: AML-0001, a teaching assistant, £378, twelve key/value pairs. The compliance wording is present in the report note (good, and required by the PRP) but not at first paint.

2. **Item stage review.** Same QueueView cut as 121, with worse consequences:
   - `triggeringPaymentList` (the payments that fired the alert) is an array → never shown. For structuring, the nine sub-£3,000 cash credits *are* the case.
   - `cashSharePercent`, `mainCorridor`, `corridorRisk`, `onboardingRisk`, `monthsDormantBefore`, `priorAlerts`, `priorOutcome` fall after the 12-field cut. `relationshipNote` only appears when it is longer than 60 characters, so it shows for planted cases and explained spikes and is absent for everyday alerts — the presence of a text block is itself a tell.
   - Labels are mangled by the camel-case splitter: "Credits In90Days", "Credit Total90Days", "Distinct Counterparties90Days" (`aml-alert-triage-3-stage-scored.png`).
   
   An AML analyst reads an alert as *expected versus actual*. Bespoke layout: header sentence ("Personal · care worker · expects £1,400 a month"); a **bullet bar** of 90-day credits against 3 × expected turnover (AML-0089: £21,427 against £4,200 — the bar runs off the scale); a **threshold strip** plotting each triggering payment as a dot by day against the £3,000 reporting line (AML-0089's eight cash credits sit in a tight row between £2,350 and £2,770 — unmistakable); cash share as a small donut (89%); corridor chip with risk colour; then the relationship note as a quoted file card, always present, and prior alerts as a small history line.

3. **Answers and evaluation strip.**
   - The five questions suit the job. `information_missing` is the most product-like output ("business purpose" on 74 of 80 escalations) — though 74 of 80 identical answers is closer to a default than an insight; grade it against a label.
   - **`disposition` and `suspicion` disagree, and the report follows the weaker one.** The score ranks the file almost perfectly (AUC 0.999; the 12 planted alerts score 4.27–5.44). Cutting at suspicion ≥ 4.27 gives **14 alerts containing all 12** (86% precision). The `disposition` choice escalates **80** (15% precision) and the headline is built on it. AML-0001 itself is escalated at suspicion 2.94 with typology NONE and confidence 0.46. The PRP's target beat was "300 → 41 with 11 of 12"; the score delivers better than that and nobody sees it.
   - 182 of 300 parked in MONITOR (61%) is not a triage; the notes concede it.
   - Strip: `kept` and `escalated` duplicate `disposition`; both render as amber warnings.
   - **Verdict card should read:** "ESCALATE · structuring · 5.4 of 6 · ask for source of funds. Planted: structuring — correct. Eight cash credits £2,350–£2,770 in eleven days against a £3,000 line; expected turnover £1,400." For an explained spike: "CLOSE · property sale · solicitor's reference on file. Planted: explained — correct. Analyst time saved ≈ 20 minutes."

4. **Report, charts and metrics.**
   - **Label leakage through `relationshipNote`.** The note is one of twelve fixed strings and maps one-to-one onto the label class: four strings for the 258 everyday alerts ("Nothing recorded on the relationship file this year." etc.), four for the 30 explained spikes, four for the 12 planted alerts (all four structuring cases carry the identical sentence "Counter staff note the customer asks how much can be paid in without paperwork."; see `scripts/generate/aml-alert-triage.js:138,165,192,218`). A string lookup scores 100%. The model's 12 of 12 with 12 of 12 typologies named is therefore not evidence of reading the account. A non-model baseline on one ratio (triggering total ÷ expected monthly turnover) already reaches AUC 0.955.
   - **The items are internally inconsistent.** `triggeringPayments` disagrees with the length of `triggeringPaymentList` on 235 of 300 alerts; `triggeringTotal` disagrees with the sum of the listed payments on 272 of 300 (AML-0001: "8 payments, £378.38" but the list has three payments totalling £3,432.66); `priorAlerts` contradicts `priorOutcome` on well over a hundred (50 alerts say 0 prior alerts and "Two earlier alerts, both closed"; 51 say 0 and "One earlier alert, closed"). All three pairs are sent to the model. A careful reader — human or model — should find these files suspicious for the wrong reason, which may be part of why 63 everyday alerts were escalated.
   - KPI naming: `kept` in `report()` means *escalated* (`demo.js:112`) while `evaluation.kept` means *not closed*. "Queue after triage 80 of 300" silently ignores the 182 monitored alerts that are still open work. Show the three lanes as a **funnel**: 300 → 38 closed / 182 watch / 80 escalate → 12 worth working.
   - Missing: precision of escalation (15%), alerts per true positive (6.7), analyst-weeks at the stated 50/week capacity (80 alerts = 1.6 weeks; at the score cut, 14 alerts = 0.3 weeks), typology accuracy reported separately for planted cases (12/12) and as false-typology rate on clean ones (**85 of 288 clean alerts were given a typology**, 59 of them "structuring"; matrix "None" row 59/11/13/0/2/203).
   - "Layering" is an option with zero planted cases and is excluded from the checks (`demo.js:146`); it shows as an empty matrix row with 11 false calls. Either plant some or remove the class.
   - Right charts: (a) the lane funnel above; (b) **suspicion histogram with planted alerts overlaid** and the capacity line at 50 — it shows the clean gap between 4.2 and everything else, and makes the threshold slider meaningful; (c) explained-spike outcomes by kind (from the fixtures: property sale 5/8 closed, bonus 8/8, seasonal 8/8, wedding 0/6 — the notes say two property sales stayed; it is three, all escalated) as four small bars — that is the "why" behind 21 of 30.
   - The curve's first two points are identical (300 reviewed at thresholds 0 and 1).

5. **Bespoke Present screen (4 beats).**
   1. *"300 alerts, two analysts, fifty a week."* A 300-cell tile wall, all grey; caption "six weeks of work".
   2. *Hero AML-0089, structuring.* Threshold strip: eight cash dots lining up under the £3,000 line; care worker expecting £1,400. Answer lands: structuring · escalate · 5.4 of 6.
   3. *Hero AML-0127, property sale* (labelled "a property sale"): a single large credit with a solicitor's reference and the file note; closed with the reason. Then the honest beat: a wedding collection (AML-0101 or AML-0224, both escalated) kept in the queue.
   4. *The wall re-colours*: 38 closed fade, 182 dim to "watch", 80 stay lit, 12 pulse. Drag the threshold to 4.3 and the lit set collapses to 14 with all 12 still inside. Closing number: **"300 → 14, all 12 kept"** — with the compliance line on screen throughout.

6. **Re-runnable model test.** Record: recall on planted (gate 12/12); queue size at the disposition and at the best score cut; precision of escalation; explained spikes closed by kind; typology accuracy on planted and false-typology rate on clean; monitor-lane share (gate ≤ 30%); `information_missing` accuracy against a new label; drift and item-level flips versus last run. Dataset: generate `relationshipNote` from a larger phrase bank with overlapping language across classes (some everyday alerts should have worrying-sounding notes; some planted cases should have a bland file); fix the three field inconsistencies; ≥ 40 planted cases with within-typology variation (structuring that is not always 88–94% cash from a care worker with exactly £1,400 expected turnover); add planted cases whose explanation is *partially* in the file; add layering or remove it.

7. **Bugs and defects seen.**
   - "Credits In90Days", "Credit Total90Days", "Debits In90Days", "Distinct Counterparties90Days" — `aml-alert-triage-3-stage-scored.png`.
   - Triggering payments, cash share, corridor, risk ratings and (for everyday alerts) the relationship note never rendered — same.
   - "Everyday alerts escalated 63 of 258" shows eight chips then "**and 12 more**"; there are 55 more. `demo.js:162` slices the list to 20 and `widgets.jsx:68` counts the sliced list — `aml-alert-triage-6-report.png`. Same fault on the explained row if it ever exceeds 20.
   - Evaluation strip shows "Kept ⚠ Yes · Escalated ⚠ Yes" as two warnings for one fact — `aml-alert-triage-5-evaluation.png`.
   - Data inconsistencies listed above (counts, totals, prior alerts).
   - Two KPIs have no tone and render neutral beside toned neighbours.

8. **Top 5 actions.**
   1. Remove the relationship-note leak and fix the three inconsistent field pairs in the generator; re-record [M] [demo-only].
   2. Rank and cut on `suspicion`; show disposition as a secondary lane; headline "300 → 14, 12 of 12" with the slider [S] [demo-only + shared slider].
   3. Bespoke alert card: expected-vs-actual bullet bar and the threshold strip of triggering payments [M] [demo-only view].
   4. Lane funnel + suspicion histogram with planted overlay and capacity line [M] [shared-runtime widgets].
   5. Fix the "and N more" count; stop slicing `items` in the demo [S] [shared-runtime + demo-only].

---

### 124 · Sanctions name matching (`sanctions-name-match`)

**Scores (0–10):** Story clarity 6 · Item stage 3 · Answers-to-decision legibility 4 · Report and charts 3 · Presenter readiness 2 · Evaluation rigour 2 · Re-run/benchmark readiness 2

1. **The one-sentence value.** "A fuzzy name engine raised 200 hits; tell me which are really the listed person, clear the rest with the field that proves it, and never lose a true match." First paint shows the record table for SNC-0001; the fictional-list caveat is present (good, and the PRP calls this the highest-sensitivity demo). What the visitor cannot see is *why this is hard* — the two names are not even on the same row.

2. **Item stage review.** The comparison view unions the keys of both records (`ComparisonView.jsx`, `fields = new Set([...Object.keys(left), ...Object.keys(right)])`). The customer record uses `name / dateOfBirth / nationality / address / identifierFragment`; the list entry uses `primaryName / aliases / datesOfBirth / nationalities / addresses / identifierFragments`. No key matches, so **the "side-by-side" table is two stacked lists with a dash in every opposite cell** (`sanctions-name-match-3-stage-scored.png`): "Name: Aminah Halabi | –", six rows later "Primary Name: – | Amina Halabi". Addresses print as raw JSON, aliases and dates as JSON arrays, "Fictional: Yes" is a data row, and the engine's fuzzy score (0.918) and the reason the candidate was generated are not shown at all. The view already supports `demo.comparisonRows(item)`; this demo simply does not supply it.
   
   Bespoke layout: a five-row **evidence ladder** — Name · Date of birth · Nationality · Address · Identifier. Each row: customer value | a match glyph (= exact, ≈ close, ≠ contradicts, ? missing) | list value, with **character-level diffing** inside the values ("Amina**h** Halabi" vs "Amina Halabi"; "1960-08-14" vs "19**7**0-08-14"). Aliases render as chips under the list name with the matching alias highlighted. Above the ladder, the engine's score as a meter ("name engine 0.92 — why this hit exists"). When the answer lands, the row the model named as deciding evidence gets a bracket, and the planted deciding row gets a second bracket; agreement is visible as overlap.

3. **Answers and evaluation strip.**
   - `same_entity` (noul) and `match_strength` (score) are near-duplicates; both separate the classes perfectly (AUC 1.000 each). Keep one; spend the slot on "Which field contradicts identity, if any?" separately from "Which field confirms it?" — today `deciding_evidence` tries to be both and scores 44.5%.
   - `needs_more_data` is **yes on 182 of 200**. `disposition` is REVIEW on 152 of 200. These are all-yes answers: the model declines to decide. For a screening tool that is the null product — the reason to buy it is to clear false positives.
   - Deciding-evidence confusion is systematic: planted IDENTIFIER → called DATE_OF_BIRTH on 50; planted NATIONALITY → DATE_OF_BIRTH on 35. That deserves a finding (the report has no `findings` at all).
   - The 0.5 cut on `same_entity` creates the "17 of 28 one-digit DOB" error. Every true match scores ≥ 0.8 and only 2 non-matches exceed 0.6, so a 0.7 cut gives zero identity errors. This is a calibration/threshold finding, not an identity-reasoning failure, and the report presents it as the latter.
   - Internal inconsistency: SNC-0007 was CONFIRMED while being a planted non-match (city/country collision). A false confirm freezes an innocent customer; the report has no line for it.
   - **Verdict card should read:** "REVIEW · same person 0.46 · deciding field: nationality (JO vs SA). Planted: different person, settled by nationality — identity correct, evidence correct, but policy expected CLEAR: this hit stays on an analyst's desk."

4. **Report, charts and metrics.**
   - **Label leakage through the identifier fragment.** Every true match has a customer fragment that equals the list fragment (both "800…"); every non-match carries a synthetic fragment that spells its construction: `ALT000`-style for transliteration, common-surname, DOB, city/country and clear-false cases, `SON…` for father-and-son, `null` for insufficient (`scripts/generate/sanctions-name-match.js:118–135`). The rule "fragment matches → same" scores **188 of 188**. The engine's own fuzzy score alone gives AUC 0.995. The identity task is solved before any reasoning starts, which is why both model scores are perfect separators and why the only interesting behaviour is the refusal to clear.
   - **"Identity accuracy 90%" is the wrong headline and is inflated.** It counts `predictedSame === false` as correct on 140 hits the model did not clear (`demo.js:75`). The matrix says it plainly: planted different → called different 30, called insufficient/review **140**. The operational numbers are: true matches kept 18/18 (good, and the one that must never fail); **false positives cleared 29 of 170 (17.1%)**; false confirms 1; analyst workload reduced from 200 to 171. Lead with "kept 18 of 18, cleared 17%" and let the demo be honest about being conservative.
   - Some labels are contestable. SNC-0001: list alias is an *exact* match for the customer name, date of birth is identical, same city; only nationality (JO vs SA) and the leaked fragment differ, and the label says CLEAR on nationality. Many practitioners would hold that for review — dual nationality is common. If REVIEW is a defensible answer, grading it as a failure to clear is unfair; label a set of "review is acceptable" pairs.
   - **Hidden section (global finding 8):** `insufficient` = {correct 10, total 12} — the model correctly refused to decide on 10 of 12 thin records. Draw it as a small "Correctly deferred 10 of 12" tile beside "True matches kept", with SNC-0053 and SNC-0095 as chips. It is already duplicated as the last check row, so either is fine — but it should sit in the KPI strip because "knows when it cannot know" is a selling point.
   - Distribution: CONFIRM is toned "bad" (`demo.js:80`); confirming 18 true matches is the job.
   - "Worth opening" is the first 12 of 182 items in file order that asked for more data (`demo.js:83`) — no ranking, no ids, no truth. Replace with: the false confirm (SNC-0007), the two mishandled thin records, then the highest-probability non-matches.
   - No curve at all. Right charts: (a) a **strip plot of `same_entity` probability** for all 200, coloured by truth, with the 0.5 line and a draggable cut — the clean gap is the picture; (b) **clearance rate by collision cause** as horizontal bars (from the fixtures: common surname 17/30 cleared, clear-false 11/20, father-and-son 1/28, transliteration 0/34, one-digit DOB 0/28, city/country 0/30); (c) the deciding-evidence confusion as a 6 × 6 heatmap.

5. **Bespoke Present screen (4 beats).**
   1. *"200 hits from the name engine, 18 real."* A row of 200 dots, all amber.
   2. *Father and son, SNC-0068* (the only one of 28 father-and-son pairs the model cleared; SNC-0008 shows the usual outcome — right field, date of birth, but held for review): ladder shows name "=", DOB "≠ a generation", bracket lands on DOB. PRP beat.
   3. *True match SNC-0004* (same person 0.95): name ≈, DOB =, identifier = — CONFIRM.
   4. *The honest reveal*: dots re-colour — 18 red (confirmed), 29 green (cleared), **152 still amber**. Closing number today: **"18 of 18 kept; 17% cleared"**. That is a weak close; after the leak is fixed and the disposition question is re-tuned, the close becomes "18 of 18 kept, N% of false hits cleared with the reason attached".

6. **Re-runnable model test.** Record: true-match recall (hard gate = 100%); false-confirm count (hard gate = 0); false-positive clearance rate overall and by cause; correct-deferral rate; deciding-field accuracy; review-lane share (gate ≤ 40%); AUC and the best cut for `same_entity`; drift and flips. Dataset: generate realistic identifier fragments for non-matches (random digits, sometimes missing, sometimes sharing a prefix); let some true matches lack an identifier so they must be confirmed on DOB + address; add true matches with a *worse* fuzzy score than some false ones (aliases, transliteration) so the engine score is not a 0.995 classifier; mark pairs where REVIEW is acceptable; ≥ 40 true matches.

7. **Bugs and defects seen.**
   - Non-aligned comparison (dashes in every opposite cell), raw JSON for address/aliases/dates, "Fictional: Yes" as a row — `sanctions-name-match-3-stage-scored.png`.
   - The sticky site header overlaps the item title in the same screenshot ("SNC-0001 · Aminah Halabi ↔ …" is cut through) — worth checking scroll-margin on the stage anchor.
   - Evaluation strip: "Flagged ⚠ Yes", "Needs More Data ⚠ Yes", raw 0.46 with no label — `sanctions-name-match-5-evaluation.png`.
   - Disposition legend in capitals (CLEAR/REVIEW/CONFIRM not passed through `readable`); CONFIRM in the "bad" colour — `sanctions-name-match-6-report.png`.
   - Check labels read "dob one digit candidates mishandled", "father son candidates mishandled".
   - No findings list, no curve: the report is the thinnest in the domain.

8. **Top 5 actions.**
   1. Remove the identifier-fragment leak and rebalance the engine score; re-record [M] [demo-only].
   2. Supply `comparisonRows` so the five identity fields align, with character diffs and match glyphs [M] [demo-only + small shared-runtime].
   3. Re-headline: "kept 18/18 · cleared 17% · 1 false confirm · deferred 10/12"; drop "Identity accuracy 90%" [S] [demo-only].
   4. Probability strip plot with a movable cut; clearance-by-cause bars [M] [shared-runtime widgets].
   5. Re-tune the questions (merge duplicate strength questions, split confirms/contradicts, sharpen CLEAR criteria) and mark review-acceptable labels [M] [demo-only].

---

### 125 · Mule networks (`mule-network`)

**Scores (0–10):** Story clarity 7 · Item stage 3 · Answers-to-decision legibility 4 · Report and charts 5 · Presenter readiness 3 · Evaluation rigour 5 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "Judge 120 accounts one at a time, then watch three laundering networks reassemble themselves — and the payroll that looks like one stay grey." It is the most visual promise in the domain. First paint (`mule-network-1-landing.png`) is ACC-0001: a red disc in the middle of a ring of faint, **unconnected** circles. It reads as a broken chart.

2. **Item stage review.** Two separate problems.
   - **The graph data is wrong.** `scripts/generate/mule-network.js:206` builds edges as `second.slice(0, 14)` — the first 14 transfers that touch any *neighbour*, not the focus account's own transfers — and line 204 caps nodes at 12. For ACC-0001 that yields 14 edges of which **1** has both endpoints among the drawn nodes and **0** touch the focus. Across the dataset, 1,635 edges are stored, 515 are drawable and only 168 touch their own focus account. Planted network items fare better (ACC-0022: 8 of 8 drawable, 3 touching the focus), which means on camera the only legible graphs are the guilty ones — an accidental tell.
   - **The view shows topology but not the evidence.** No amounts on edges, no timing, no direction emphasis; hop-1 nodes are as dim as hop-2 (`mule-network-3-stage-scored.png`); the ring is clipped at the bottom of the SVG. The facts that decide the role — in/out totals, share kept, median minutes in-to-out, shared device/address, declared income — are not on the stage at all. "Transfers as a table" is collapsed and lists neighbour-to-neighbour transfers.
   
   Bespoke layout: a **left-to-right flow (money in → account → money out)**, not a ring. Senders stacked on the left, recipients on the right, edge thickness = amount, edge label = time ("10:02 → 10:09"). Beneath it a **dwell-time strip**: each credit as a dot, joined to the debit that followed, so a mule's seven-minute hops look like staples and a normal account's look like long arcs. Right-hand fact column: in £7,714 · out £7,560 · kept 2% · median dwell 7 min · declared income vs turnover as a bullet bar · shared-device badge. Then a persistent **whole-file minimap** of all 120 accounts, in which each node takes its role colour as it is answered — this is what delivers the PRP beat "the fan-in collector lighting up as its mules are classified" and "the payroll decoy staying grey".

3. **Answers and evaluation strip.**
   - `role` is the right primary question, but with four options and thin ordinary traffic the model calls 56 of 120 accounts "mule" (41 of 99 ordinary accounts). `network_confidence` is far better behaved: **AUC 0.953**; at ≥ 3, 23 accounts are pulled and 16 are real (70%), against 21 of 63 (33%) for the role flag. As in 123, the score is the better instrument and the report headlines the choice.
   - `pass_through` noul: yes on 6, all mules — but 14 mules exist and those with median dwell 183–729 minutes were answered no (ACC-0006 at 183 minutes got 0.57; ACC-0004 at 625 got 0.34). The criterion says "minutes or hours"; the model is reading it as minutes.
   - `action` is **never graded**, and it is where the bank wins or loses: only 6 of the 21 network accounts were restricted or frozen (2 mules restricted, 1 frozen, 3 originators frozen). **No collector was restricted**: ACC-0003 and ACC-0041 were monitored, and ACC-0021 — the N2 collector, £9,990 in and £0 out, the one account where the money is still sitting — got NO_ACTION. Meanwhile 3 innocent accounts were restricted or frozen (ACC-0075, ACC-0082, and the payroll employer ACC-0061). That is the most important finding in this run and the report does not contain it.
   - Whether freezing an *originator* is right depends on who originators are (criminals seeding the network, or scam victims). The labels do not say. Decide and label an expected action per role.
   - Strip (`mule-network-5-evaluation.png`): for ACC-0001 "Role mule · Flagged ⚠ Yes · Pass Through No · Income Consistent No" on an ordinary account, with no sign that the planted role is UNRELATED. `confidence` and `networkConfidence` sit side by side, one 0–1 and one 0–6, neither with a unit.
   - **Verdict card should read:** "MULE · network confidence 4.8 of 6 · FREEZE. Planted: mule in N2 — correct. £7,714 in, £7,560 out, median dwell 7 minutes. Still in the account: £154."

4. **Report, charts and metrics.**
   - "Networks recovered whole 1 of 3" with "N1: 8 of 9 · N2: 6 of 6 · N3: 4 of 6" is the right idea and the right headline. Draw it: **three small network diagrams**, nodes coloured by called role with wrong calls ringed, plus the payroll cluster as a fourth in grey with its single error (the employer called originator and frozen).
   - **"Money the bank would hold £26,498" is wrong three ways.** (a) `demo.js:82` — for FREEZE it computes `totalIn − totalOut + totalOut`, i.e. `totalIn`: the month's gross inflow, not what is in the account. For RESTRICT_OUTBOUND it uses `totalOut`, money that has already gone. (b) It sums across accounts in the same chain, so the same pounds are counted at every hop. (c) **£9,138 of it (34%) is innocent customers' money** — ACC-0075 (£7,827, ordinary) is the top line of "Worth opening", and ACC-0082 (£1,311, ordinary) is fifth. The tile has no tone and no caveat. Replace with two figures: recoverable balance in correctly restricted network accounts, and innocent balance wrongly held.
   - Ordinary-account data is unrealistic in ways that feed the false positives, as the notes concede: ACC-0001 has £2,936 in and £6,149 out (`keptPercent` −109), 37 of 99 ordinary accounts have a negative kept share, and the originators show −2,689% and −14,225%. `keptPercent` needs an opening balance or a floor; sending "−14225" as a percentage is not a fair input.
   - Missing metrics: per-account precision/recall for "in a network" (recall 21/21, precision 33% by role, 70% at confidence ≥ 3); role macro-F1; action accuracy against expected actions; collector-action KPI ("collectors stopped: 0 of 3"); decoy release (payroll 11/12, touched-once 7/12, shared-device families — planted per the notes but not reported anywhere).
   - The matrix is small and readable once repaired: 3/0/0/0 · 1/13/0/0 · 0/2/2/0 · 0/41/1/57.
   - The curve is reasonable; label the 0.5 stop "confidence ≥ 3: 23 opened, 16 real".

5. **Bespoke Present screen (5 beats).**
   1. *Minimap, all 120 nodes grey.* "One month, 900 transfers, judged one account at a time — the model never sees a cluster."
   2. *Hero ACC-0022 (N2 mule).* Flow view: £7,714 in from ACC-0029, split to ACC-0024/0025 seven minutes later. "In at :02, out at :09." Answer: mule · 4.8 of 6 · freeze.
   3. *Minimap fills as Play-all runs*: N2 lights up whole (6 of 6); the collectors ACC-0003, ACC-0021, ACC-0041 turn collector-colour.
   4. *The payroll cluster stays grey* — 11 of 12 — with the employer ACC-0061 ringed as the one error.
   5. *Honest close*: the 41 ordinary accounts called mule flash amber, then the confidence slider moves to 3 and most fall away. Closing number: **"3 of 3 collectors named, from single-account reads"** — paired on screen with "and none of them stopped", until the action question is fixed.

6. **Re-runnable model test.** Record: networks recovered whole; per-network role recall; collectors named and collectors stopped; in-network precision/recall at the role flag and at the best confidence cut; AUC of `network_confidence`; decoy release by kind; action accuracy; correctly held vs wrongly held balance; drift and flips. Dataset: fix graph construction (focus edges first, then neighbour edges, with amounts and timestamps); give ordinary accounts salary anchors, retained balances and standing commitments (the notes already plan this); define `keptPercent` sensibly; add expected action per role; 6–8 networks of varied shape across ≥ 300 accounts so "networks recovered whole" is not a 3-item metric; two or three seeds.

7. **Bugs and defects seen.**
   - Graph for ACC-0001 has no edge touching the focus and one dangling dashed edge — `mule-network-1-landing.png`, `mule-network-3-stage-scored.png`; cause at `scripts/generate/mule-network.js:204–206`.
   - Bottom of the ring clipped (a node at the lower edge has no label) — `mule-network-3-stage-scored.png`.
   - Sticky header overlapping the stage title in the same screenshot.
   - `moneyHeld` formula (`demo.js:82`) and the untoned £26,498 tile; an innocent account tops "Worth opening" — `mule-network-6-report.png`.
   - KPI "The payroll cluster" value "11 of 12 left alone" wraps to three lines in the tile.
   - `keptPercent` values of −109, −2,689, −14,225 sent to the model.

8. **Top 5 actions.**
   1. Fix the generator's graph (focus edges first; amounts and times on edges) [S] [demo-only]; re-record is not needed since `graph` is not in the state.
   2. Grade `action`; replace "Money the bank would hold" with correctly-held vs wrongly-held balance; add "collectors stopped" [S] [demo-only].
   3. Whole-file minimap that colours as accounts are answered + three network diagrams in the report [L] [shared-runtime, reusable by 133 and 174].
   4. Flow-style item view with dwell-time strip and fact column [M] [shared-runtime].
   5. Re-generate ordinary traffic with salary anchors and sane `keptPercent`; re-record [M] [demo-only].

---

### 126 · Insider trading surveillance (`insider-surveillance`)

**Scores (0–10):** Story clarity 7 · Item stage 7 · Answers-to-decision legibility 5 · Report and charts 4 · Presenter readiness 5 · Evaluation rigour 2 · Re-run/benchmark readiness 2

1. **The one-sentence value.** "Every employee trade read against the chart, the calendar, the access list and their own history — nine cases opened, all nine planted, none innocent." The stage almost lands it at first paint because the candle chart with TRADE and EVENT markers is self-explanatory. The "real prices, invented people" framing is stated clearly, as the PRP asked.

2. **Item stage review.** The best stage in the domain (`insider-surveillance-3-stage-scored.png`): four header facts, 60 real candles, a dashed trade line, a dotted event line, and the ten-session outcome window shaded and revealed after scoring. That reveal is a strong presentational idea. What is missing is everything that actually decides the case:
   - **Material access to this issuer** is compressed into "restricted project · no issuer access listed". It is the decisive fact (see 4) and deserves a badge: "ACCESS TO NVDA: YES".
   - **Employee history** (8 prior trades) is not drawn. Show it as small markers on the same price axis for this symbol, plus a **size bar** — "this trade £X = 17.9 × their average" for TRD-0129.
   - **Colleague trades** are not drawn. The cluster beat ("four employees, one week, one instrument") needs colleague markers on the chart in a second colour.
   - **Days to event** and the blackout window: shade the 14-days-before to 2-days-after band on the time axis, so a trade inside it is visibly inside it.
   - Plan exemption as a badge ("Pre-cleared monthly plan since …").
   - The chart has two x-axis dates and no intermediate ticks; the y labels have no currency.
   
   This is a view to *extend*, not replace: add a trade-history lane and a colleague lane beneath the candles, and the blackout band behind them.

3. **Answers and evaluation strip.**
   - `pattern` is single-label where the planted cases are multi-label. All nine suspicious trades are 2–9 days before a material event by an employee with access — every one is "pre-announcement". The model called 6 of 9 PRE_ANNOUNCEMENT; the labels call TRD-0019/TRD-0129 "unusual size" (14.8× and 17.9× average), TRD-0161 "first-time instrument" and four "clustered". The 2-of-2 and 1-of-1 "missed or misnamed" checks are **label-design artefacts, not model errors**. Make `pattern` multi-select (four nouls) or grade "any applicable pattern".
   - `blackout_breach` is identical to the suspicious label on all 180 (all 9 suspicious are breaches; 179/180 called right). It is the same question as `disposition`.
   - `MONITOR` is never an expected disposition and was never chosen: a three-way choice with a dead middle option.
   - Strip (`insider-surveillance-5-evaluation.png`): "Explained By History ⚠ Yes" — amber for the benign answer. `flagged` and `caseOpened` duplicate `disposition`.
   - **Verdict card should read:** "OPEN CASE · 4.8 of 6 · blackout breach. Planted: suspicious — correct. 3× leveraged proxy, 17.9× usual size, 2 days before the event, has issuer access. Afterwards (not shown to the model): +7.5% in ten sessions."

4. **Report, charts and metrics.**
   - **100% everywhere means the test is not a test.** 9 of 9 opened, 100% precision, 180 of 180 dispositions. The reason is in the state: the rule *"employee.materialAccessSymbols includes the traded symbol AND there is no pre-cleared plan"* yields **9 true positives and 0 false positives**. Only one benign trade in 180 has access to the symbol traded, and that one has a plan. The model's scores show the same cliff (highest benign 2.69, lowest suspicious 3.03). The 60 candles per item (state ≈ 8,300 characters; 1.14 M input tokens for the run, 2.5–7× the other demos) contribute nothing to the decision — they are scenery. A sceptical surveillance buyer will see this in one minute.
   - The outcome returns are rhetorically risky. All nine suspicious trades show +7.1% to +24.0% after ten sessions (benign mean +1.85%), and "Worth opening" prints them as the value column. But lookalikes cleared by the model also show +23.96% (TRD-0090) and +14.85% (TRD-0097), and hindsight profit is not evidence of insider dealing. Use the outcome as colour in the item reveal, not as the ranking value in the report; and if shown, show the benign distribution beside it.
   - Missing because there is nothing to measure: precision/recall trade-off, calibration, threshold sensitivity. The curve collapses to a step at suspicion ≥ 3 (9 reviewed, 9 caught) — `insider-surveillance-6-report.png`. The 2 × 2 matrix (9/0/0/171) is fine as a form but should be secondary.
   - "Pattern accuracy 91.1% (164 of 180)" is 159 routine trades plus a handful; on the 9 planted it is 5 of 9, and 12 benign trades were given a non-routine pattern.
   - Distribution legend prints raw enums ("PRE_ANNOUNCEMENT"… via `label: pattern`) — rendered lower-case in the screenshot but with a "first time instrument 0 · 0%" entry for an empty class.
   - "Worth opening" rows show ticker only (three rows read "NVDA · open case · …") with no trade id or employee.
   - Right charts once the data is hardened: (a) **event-window scatter** — x = days from trade to event (−30…+5), y = trade size as a multiple of the employee's average, colour = access, ring = case opened, blackout band shaded; the planted cases should sit in one corner and the lookalikes beside them; (b) a **lookalike panel**: 8 scheduled purchases and 7 sector moves as small multiples with their clearing reason; (c) precision–recall against the suspicion score.

5. **Bespoke Present screen (4 beats).**
   1. *Hero TRD-0161* (NVDA, executive support with issuer access, first trade in the instrument, 3 days before the event). Candles end at the trade line; blackout band shaded; answer lands: open case, 4.3 of 6. Then the outcome window wipes in: +23.96%.
   2. *Lookalike TRD-0090* — same kind of window, same +23.96% afterwards, but a pre-cleared scheduled purchase with no issuer access: no action. The pairing of two identical outcomes with opposite decisions is the point: the model is judging what was knowable, not the profit.
   3. *Cluster*: TRD-0121 (NVDA) with three colleague markers on the chart in the same week.
   4. *Scatter* of all 180 trades; nine ringed. Closing number: **"9 opened, 9 planted, 171 left alone"** — which is only a credible close after the access shortcut is removed; until then, close on beat 2.

6. **Re-runnable model test.** Record: recall and precision of OPEN_CASE; suspicion AUC and margin between classes; lookalike clearance by kind; blackout-rule accuracy on a subset where breach ≠ suspicious; multi-label pattern F1; tokens per item (this demo is the expensive one — track it); drift and flips. Dataset, to make it a fair test: many benign trades by employees **with** access (outside the window, or under a plan, or selling at a loss); suspicious trades **without** listed access (tipped colleagues — which is what the cluster pattern is for); plans established *inside* the window (not exempt); window-edge cases at day 14/15 and +2/+3; expected MONITOR cases so the middle lane is live; ≥ 30 planted. If candles are to matter, plant cases where only the price/volume context distinguishes them (e.g. abnormal pre-event volume), otherwise drop the bars from the state and save 80% of the tokens.

7. **Bugs and defects seen.**
   - Presenter mode clips the y-axis labels at the right edge ("175.9", "168.2", "144.9") — `insider-surveillance-7-present.png`.
   - "TRADE" and "FICTIONAL EVENT" captions are stacked and offset from their lines; when the two dates are close they will collide — same screenshot.
   - Only two x-axis dates, no ticks; no currency on the price axis — `insider-surveillance-3-stage-scored.png`.
   - "Explained By History ⚠ Yes" amber on a routine trade — `insider-surveillance-5-evaluation.png`.
   - Empty "first time instrument 0 · 0%" legend entry; ticker-only rows in "Worth opening" — `insider-surveillance-6-report.png`.
   - `findings` is empty, so the report has no narrative line at all on a run with a perfect score.

8. **Top 5 actions.**
   1. Break the access shortcut in the generator (benign-with-access, suspicious-without, edge-of-window, live MONITOR lane); re-record [L] [demo-only].
   2. Make `pattern` multi-label or grade "any applicable"; drop the duplicate blackout/disposition question [S] [demo-only].
   3. Extend the candles view: blackout band, access badge, size bar, history and colleague lanes [M] [shared-runtime view].
   4. Replace outcome-% as the "Worth opening" value with suspicion + trade id + employee; show outcomes only in the reveal, with the benign distribution [S] [demo-only].
   5. Fix presenter-mode axis clipping and caption collision [S] [shared-runtime].

---

## Domain summary

**Cross-demo patterns.**

1. **Four of six demos can be solved by a one-line rule on the state.** 123: the relationship note is a 12-string lookup for the label class. 124: the identifier fragment spells the label (`800…` vs `ALT…`/`SON…`; 188 of 188). 126: material access to the traded symbol without a plan (9 TP, 0 FP). 122: any sensitive event in the timeline (14 TP, 5 FP), with normal sessions made of three event types. In each, the model's score is a perfect or near-perfect separator (AUC 0.999, 1.000, step at 3.0, 1.000). 121 and 125 are the honest ones (AUC 0.921 and 0.953) — and, not by coincidence, the ones with the most interesting reports. For a suite whose purpose is a repeatable model test, this is the first thing to fix: a benchmark a regex can pass cannot detect a regression.
2. **The score question is consistently better than the choice question, and the reports headline the choice.** 123: suspicion cuts 300 → 14 with 12 of 12; the disposition gives 80. 125: confidence ≥ 3 gives 70% precision; the role flag gives 33%. 124: a 0.7 cut on `same_entity` gives zero identity errors; the 0.5 cut gives 18. The promised threshold slider is not decoration in this domain — it is where the value is.
3. **The model is conservative to the point of not deciding.** 124: 152 of 200 REVIEW, 182 of 200 "needs more data". 123: 182 of 300 MONITOR. 125: 17 of 21 network accounts monitored or left alone, including all three collectors. 122 is the mirror image: FREEZE on 14 of 14. None of the reports has a KPI for "share of items actually decided", and it should be standard in this domain.
4. **Base rates and denominators are tiny.** 16, 14, 12, 18, 21 and 9 positives. Per-type checks have groups of 1–5. "0 of 3" and "2 of 2" are not metrics. Every demo needs ≥ 40 positives or multiple seeds with a range.
5. **Taxonomy questions are asked unconditionally and graded on the negatives**, producing matrix rows that look alarming and mean little (121: 97 clean alerts typed; 123: 85 clean alerts given a typology; 126: 12). Gate them on the action.
6. **Actions are asked but not costed.** 121 has no step-up friction KPI; 122 counts friction only on the innocent; 125 never grades the action and mis-computes the money; 123 ignores the monitor lane. A fraud demo without a cost-weighted error is half a demo: false negatives cost money, false positives cost customers and analyst hours, and each demo already has the ingredients (amounts, friction weights, capacity) to price both.
7. **The generic views drop the evidence.** QueueView discards arrays and everything past twelve fields (121's statement lines, 123's triggering payments); ComparisonView fails to align two records with different key names (124); the graph generator omits the focus account's own edges (125). Only 122 and 126 have stages that show the case, and both still omit the deciding fact (previous login; issuer access).
8. **Data hygiene.** 123 has three internally contradictory field pairs on the majority of items; 125 sends percentages like −14,225; 121's notes misdescribe a question's signal. These matter more here than elsewhere because financial-crime reviewers are professionally suspicious readers.

**Flagship pick: 121 · Card fraud triage.** It has the only before/after story on a fixed human budget ("same hour, 6 → 13"), an honest difficulty level, a stored deterministic baseline, a genuinely instructive miss (ALT-0023, friendly fraud that is unknowable at authorisation) and a genuinely instructive over-reaction (all six planned purchases). It is also the natural carrier for the most video-worthy runtime feature outstanding (LEFTOVERS 3.2, the re-sorting queue). It needs a bespoke alert card, the two-line gains chart and a second baseline — all modest. Runner-up once repaired: 125, because the network minimap lighting up is the best single image the domain can offer; today its graph is broken and its money KPI is wrong. 126 looks the most finished on screen but is the least defensible as an evaluation and should not lead until the access shortcut is gone.

**Signature visual for the domain: the "analyst's hour" queue ladder.** A tall, thin column of every item in the file, ordered by the incumbent process (rule score, engine score, arrival order), with a shaded band for what a human can reach (50 alerts, 50 a week, one hour) and the planted cases as red ticks. On Play-all the column re-sorts into model order and the ticks rise into the band; a counter reads "in reach: 6 → 13". The same component serves 121 (rule rank → model rank), 123 (300 → 14 at the capacity line), 124 (200 hits, 18 real, green cleared ticks falling away), 126 (180 trades, 9 cases) and, as a ranked strip beneath the minimap, 125. It makes the domain's shared claim — *limited human attention, put it where the crime is* — visible in one glance, it is inherently a before/after, and it doubles as the benchmark card's thumbnail: two runs of the same test are two ladders side by side.
