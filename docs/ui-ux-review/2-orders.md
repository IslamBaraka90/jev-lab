# Domain 2 — Orders and customers (PRPs 111–116)

Scope: `order-risk`, `cod-abuse`, `dispute-routing`, `chargeback-evidence`, `merchant-onboarding`, `delivery-exceptions`.
Evidence: `demos/<id>/demo.js`, `notes.md`, `prps/11x-*.md`, labels in `data/synthetic/`, the computed report dumps, the 1440px screenshots, and a small set of extra statistics recomputed from `fixtures.json` + labels (ECE, AUC, majority and rules baselines, per-component accuracy, money deltas). The ten global findings in the brief are assumed fixed and are not repeated, except where a demo makes them materially worse.

Conventions: ECE = expected calibration error over 5 equal-width confidence bins on the named choice question. "Rules baseline" = a few hand-written field rules, given as a sanity check of dataset difficulty, not as a fair competitor.

---

### 111 · Order risk at checkout (`order-risk`)

**Scores (0–10):** Story clarity 6 · Item stage 3 · Answers-to-decision legibility 5 · Report and charts 5 · Presenter readiness 2 · Evaluation rigour 4 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "Every checkout gets approve / review / decline with a named fraud pattern, and you can see both costs at once: fraud shipped and good customers turned away." First paint (`order-risk-1-landing.png`) does not land it: the visitor sees a title, a one-line value, then `ORD-0001 · £1,400 · 2 items` twice and a grid of `Placed At 2026-08-10T03:55:00Z`, `Total 1,399.76`, `Item Count 2`. Nothing says "fraud", "9 of 9 stopped" or "£0 good orders declined". The demo's actual headline (9/9 fraud stopped, 0 false declines, 83 reviews) is 4,000px below and absent until Play all.

2. **Item stage review.** `QueueView` keeps only the first 12 scalar fields (`web/src/demo/views/QueueView.jsx:11`, `.slice(0, 12)`) and drops every non-scalar. For ORD-0001 (a planted reshipper) that hides exactly the evidence that makes it a reshipper: `binCountry: FR` (the third disagreeing country — stage shows only BR/GB/BR), `shippingLine1: "Unit 250, Cedar Logistics Park"`, `deviceIsNew`, `deviceDistinctCards`, `accountChangedHoursAgo`, `lifetimeValue`, `priorRefunds`, the `basket` (laptop + 27-inch monitor) and the billing name. The model sees all of it (`demo.js:35-55`); the viewer sees none. Store baselines (average order value, share shipped abroad, review capacity) are never on stage, so "£1,400" has no anchor.
   - Promote: total with currency and "× the shop's average order" chip; basket lines; customer tenure + prior orders as "new customer / 4-year customer, 31 orders"; the country triangle; device "new · 3 cards in 24h"; shipping line 1; account changed N hours ago.
   - Hide/demote: `deviceId`, raw ISO timestamp (render "Mon 03:55, 95 s checkout vs 210 s median"), `card` mask.
   - Bespoke visual — **the checkout identity triangle**: left column "Who" (tenure bar, orders, chargebacks, LTV), centre a four-node mini-graph Billing → Card BIN → Connection → Shipping with country flags/codes, edges green when equal and red when not (ORD-0001 would show GB–FR–BR–BR, three red edges), right column "What" (basket lines, value against the shop's AOV as a bullet bar, checkout seconds against median). Under it a device strip: "orders today ●", "distinct cards ●●●". Card testing (ORD-0220/0221/0222) should render as a linked cluster: three orders, one device id, three cards, £8–£20, highlighted together in the rail.

3. **Answers and evaluation strip.**
   - `decision` and `risk` overlap, and the run shows they disagree in a way that matters: both account takeovers were sent to review at risk 1.83 and 2.12 — lower than the gift-abroad decoys (2.26–2.90) and the company first orders (2.95–3.25). The risk scale is compressed (max 4.8 of 6). Risk AUC for fraud vs not is 0.955, so ranking is fine; the scale anchors are the problem. Consider anchoring risk to expected loss ("chance this ends in a chargeback") with numeric hints per step.
   - `fraud_pattern` contradicts `decision` often: 34 non-fraud orders were given a fraud pattern (32 "first party misuse", 2 "reshipper"); only 2 of those 32 have any prior chargeback, and 7 of them were simultaneously APPROVED. A named fraud pattern on an approved order is an incoherent ticket. Add a cross-answer consistency check (pattern ≠ NONE ⇒ not APPROVE) and report it like dispute-routing reports empty refunds.
   - `step_up_would_help` (yes on 13) and `address_consistent` (no on 8) are asked but never graded or used; either grade them (labels know which decoys a 3DS challenge would clear) or wire step-up into the decision as a fourth lane — it is the single most valuable real-world action here because it converts a review into an automatic approve.
   - Verdict card should read: "DECLINE · reshipper · risk 4.7/6 · 37% sure" + ground truth chip "Planted: reshipper — correct" + "£1,400 kept from shipping" + the three fields that drove it. For a decoy: "REVIEW · planted as good (company first order) — unnecessary hold, £6,590 delayed". Today it is ten raw fields with `Stopped ⚠ Yes`, `Declined ⚠ Yes` and `Value 1399.76` (`order-risk-5-evaluation.png`); `stopped/declined/reviewed` are three booleans restating `decision`.

4. **Report, charts and metrics.**
   - The headline hides the real cost. "Sent to a person 83 … 79 of them did not need it" is toned **good** (`demo.js:143`) because 12/day < 20/day. Stop precision is 9/88 = **10.2%**. Good basket value held in review is **£56,480 — more than the £43,559 approved without a person**. That is the number a head of payments would react to, and it is not on the page.
   - A four-line rules baseline (≥2 prior chargebacks; ≥3 cards on one device; new device + new address + account changed <48h; first order >£800 shipped to a different country than billing) flags exactly 9 orders and all 9 are the frauds: 100% recall at 100% precision, against the model's 100% recall at 10% precision. The notes claim no single field separates fraud, which is true, but two-field conjunctions separate it perfectly. Either the dataset needs fraud that rules miss and decoys that rules hit, or the page must show the rules baseline honestly. As it stands the demo shows a model being beaten by a filter.
   - 9 positives is too few for any rate: every "x of 9" KPI has a ±30-point interval. "Pattern named right 9 of 9" comes from groups of 3/2/2/2.
   - The matrix's informative cells are in the None row (2 → reshipper, 32 → first-party misuse), but the title and finding talk only about the diagonal. Add a finding for "34 good orders given a fraud pattern".
   - Hard-coded strings: `reviewed.length / 7` and "a limit of about twenty" (`demo.js:143`) ignore `context.reviewCapacity`; "of the twelve good orders" (`demo.js:204`) is literal. They will lie as soon as the dataset changes.
   - Distribution tones make Review and Decline the same amber (`demo.js:171`); decline should be the red/serious lane.
   - Right charts: (a) **cost curve in money** — x = risk threshold for "stop", two lines: fraud value let through (£) and good value held/declined (£), crossing point annotated; this is the PRP's "threshold slider trading catch rate against false declines, in money". (b) **Strip plot of risk score by group** (fraud / decoy / ordinary; one dot per order, colour = decision) — instantly shows ATOs sitting below decoys. (c) Decision × ground-truth 3×2 table in money, not a 5×5 pattern matrix as the hero.
   - Missing: precision/recall/F1 for "stopped", value-weighted versions, decision ECE (0.072 — decent; the 41 answers at ~34% confidence are right 56% of the time), review-rate against capacity from context, rules baseline.

5. **Bespoke Present screen** (4 beats).
   1. *"One night, one device, three cards."* ORD-0220 / 0221 / 0222 shown as a linked cluster (£8.49, £9.38, £19.78). Three DECLINE stamps land in sequence with "card testing".
   2. *"Looks worse than fraud, is not."* ORD-0255, company first order, £6,590: identity triangle shows nothing mismatched, PO number in coupon field; verdict REVIEW at risk 2.95 — then the truth chip "good customer". Say honestly that it was held, not approved (the PRP beat says "approved with a reason"; the run did not do that — only ORD-0165, a £300 new-device decoy, was approved).
   3. *"The quiet one."* ORD-0224, account takeover, £1,682: four-year customer, new device, new address, details changed hours ago; pattern named at high confidence, risk only 1.83. The point: the reason is right even when the number is shy.
   4. *The threshold in money.* The cost curve with a draggable line: at risk ≥ 3 → 15 orders opened, 7 of 9 frauds, 47% precision; at "everything stopped" → 88 opened, 10%.
   Closing number: **£10,172 of fraud stopped, £0 of good orders declined — at the price of £56,480 waiting for a person.**

6. **Re-runnable model test.** Benchmark card per run: fraud recall (count and £), false-decline count and £, review rate vs capacity, stop precision, value-weighted cost = fraud £ shipped + margin × good £ declined + minutes × reviews, pattern macro-F1 on fraud, pattern false-naming rate on good orders, decision/pattern coherence violations, risk AUC, ECE, per-slice results (4 patterns, 4 decoy looks, ordinary-with-noise), rules-baseline row, and delta vs previous run/model. Gates: fraud recall ≥ 95% by value; false declines = 0 on decoys; review rate ≤ capacity; stop precision ≥ 25%; coherence violations = 0. Dataset changes: at least 40–60 frauds (or report Wilson intervals), several seeds, frauds that defeat the simple conjunction rules (e.g. takeovers with no recent account change, reshippers on a second order), decoys that trip them, and a held-out split that is never shown on the page.

7. **Bugs and defects seen.**
   - Reshipper evidence absent from the stage because of the 12-field cap (`order-risk-3-stage-scored.png`).
   - `Total 1,399.76` no currency; `Placed At` raw ISO; `Stopped ⚠ Yes` / `Declined ⚠ Yes` amber although they are the correct outcome (`order-risk-5-evaluation.png`).
   - "Sent to a person" toned good with "79 of them did not need it" in its own context line (`order-risk-6-report.png`).
   - Legend shows lower-case "approve / review / decline" while distribution labels are sentence case.
   - "Worth opening" is sorted by basket value, so the top three are all good company orders; the frauds start at row 4.
   - PRP beat promises five card-testing orders; the data has three.

8. **Top 5 actions.**
   1. Build the identity-triangle order view with basket, device strip and baselines. [M] [demo-only]
   2. Replace the headline with the two-cost money view: fraud £ stopped, good £ declined, good £ held (£56,480), stop precision 10.2%; fix the "good" tone. [S] [demo-only]
   3. Add the rules baseline and harden the dataset so rules do not get 9/9 at 100% precision; raise positives to 40+. [L] [demo-only]
   4. Money cost curve with threshold control and the risk strip plot by group. [M] [shared-runtime]
   5. Coherence check (pattern named but approved: 7; pattern on good orders: 34) as a label-free check row, and grade or remove `step_up_would_help` / `address_consistent`. [S] [demo-only]

---

### 112 · Repeat non-fulfilment abuse (`cod-abuse`)

**Scores (0–10):** Story clarity 5 · Item stage 1 · Answers-to-decision legibility 5 · Report and charts 4 · Presenter readiness 1 · Evaluation rigour 5 · Re-run/benchmark readiness 5

1. **The one-sentence value.** "Before the next cash-on-delivery parcel ships, tell a serial refuser from a customer who just had a bad week — and restrict only the first." First paint (`cod-abuse-1-landing.png`) shows a title in compliance jargon ("Repeat non-fulfilment abuse"; the id and everyone in the trade say "COD abuse / serial refusers") and then a wall of raw JSON. The value does not land; the page looks broken.

2. **Item stage review.** `view: 'table'` prints the `orders` array through `JSON.stringify` (`TableView.jsx:10`). C-0001's 14 orders × 12 fields are one unbroken paragraph that also overflows the card on the right (`cod-abuse-3-stage-scored.png`, `cod-abuse-7-present.png`). This is the worst stage in the domain and it is the demo the PRP says "makes non-fintech e-commerce people care".
   - Bespoke visual — **the customer order ribbon**: one horizontal timeline over 18 months, one tile per order, colour by outcome (delivered = green, refused = red, returned = amber, reshipped = blue outline), tile height by value, a small "COD"/"card" glyph, promo code as a tag. Shaded vertical bands mark the 7 documented courier-outage days so an innocent's three reds sit visibly inside the band. Above: three counters computed client-side for the viewer only — "11 of 14 refused · $2,0xx shipped for nothing · 2 addresses". Below: an accounts/addresses lane (one row per account id, one marker per distinct address) so an address hopper's 4 accounts and 6 addresses read as a staircase while a refuser is one flat line.
   - Promote phone-to-accounts linkage ("1 phone → 4 accounts") as a header chip. Hide order ids, `reshippedFromOrderId` (draw as an arrow instead), currency per row.

3. **Answers and evaluation strip.**
   - `intent` has a dead option: CARELESS was chosen 0 times in 180 (30 deliberate, 150 circumstantial). All six promo abusers were named PROMO_ABUSER and simultaneously judged CIRCUMSTANTIAL, severity 0.25–0.77, ALLOW. The model is saying "yes that is the pattern, no it is not serious" — a coherent position that the label policy (PREPAY_ONLY) simply disagrees with, because the restriction question only talks about *fulfilment cost* ("Block cash on delivery because repeated fulfilment cost is likely"). Promo abuse has no fulfilment cost. Either add a lane that fits it (e.g. "NO_PROMOS") or stop grading promo abusers against PREPAY_ONLY.
   - ADDRESS_HOPPER vs SERIAL_REFUSER are not mutually exclusive: every hopper also refuses. All 7 hoppers were called refusers with the hopper option second (P = 0.15–0.46; C-0097 lost 0.40 vs 0.46 on confidence but the choice went to refuser). The criteria should say "prefer ADDRESS_HOPPER when one phone spans several accounts, even if refusals are present", or the pattern should be multi-label (two noul questions: "repeated refusals?", "linked accounts?").
   - `courier_at_fault` is leaked by the state: reason codes include the literal `COURIER_OUTAGE` (15 orders) and the state carries `courier_outage_days`. "Matched all 180 labels" is a lookup, not a judgement.
   - Verdict card: "BLOCK COD · serial refuser · severity 5.5/6 · deliberate" + truth chip + "11 refused COD parcels × $12.50 = $137.50 already burned; next parcel would be the 12th" + "$134.27 of good purchases affected". `flagged` and `restricted` are the same boolean shown twice (`cod-abuse-5-evaluation.png`); `Pattern Confidence 1` should be "100%".

4. **Report, charts and metrics.**
   - 96.1% / 95.6% are majority-class numbers: 144 of 180 are NORMAL (always-NORMAL baseline = 80.0% pattern, always-ALLOW = 80.0% restriction). Per-class pattern recall is 100 / 100 / **0** / 100 / 100 → macro recall 80%. On the abusive class the lane is right for 30 of 36 (83.3% recall) with 30 of 32 restricted being abusive (93.8% precision). Those are the honest headline numbers.
   - The economics KPIs sabotage the story: **"Shipping cost avoided $2,225.00" next to "Good value restricted $38,855.17"** reads as "we risked $38.9k of good business to save $2.2k". The two numbers are not comparable (one is past refusals × $12.50, the other is lifetime accepted value, and restriction does not destroy that value — PREPAY still lets them buy). The saving is also retrospective (counts refusals that already happened, including those of the two wrongly restricted innocents) and ignores the dominant COD costs: return leg, cash handling, restocking, inventory lock-up. The PRP asks for "a clear before-and-after on the cost line"; build that: projected next-12-month refusals for restricted customers at their historical rate × (outbound + return + handling), against projected margin lost from restricted customers who would have accepted.
   - Hidden sections (global finding 8): `innocents` is a list of the 10 explainable-streak customers with `restriction`, `keptAccess`, `courierAtFault` — draw as a ten-row "innocents ledger": mini ribbon, reason (outage / wrong address), lane given, green tick or red cross; C-0016 (PREPAY_ONLY) and C-0163 (BLOCK_COD) are the two crosses and both are wrong-address cases, not outage cases (all 5 outage innocents were recognised, courier-fault 0.92–0.93). `economics` is `{shippingSaved: 2225, goodValueRestricted: 38855.17}` — draw as a before/after bar pair per lane once the forward-looking model exists.
   - Curve: "Severity threshold" plateaus at 30 of 36 because the 6 promo abusers all score below 1; at severity ≥ 3, 30 restricted and 30 abusive (100% precision). That is a strong, presentable operating point and it is unlabeled and tiny.
   - Calibration: pattern ECE 0.016 (163 answers at 0.99), restriction ECE 0.116 — low-confidence restriction answers are almost always right (under-confident). Worth a reliability chart.
   - Right charts: grouped recall bars per planted group (refuser 14/14, returner 9/9, hopper 0/7 name · 7/7 lane, promo 6/6 name · 0/6 lane, innocents 8/10) with name and lane as two bars — this one chart tells the whole run. Drop the 5×5 matrix to secondary.

5. **Bespoke Present screen** (4 beats).
   1. *"Eleven refusals in fourteen orders."* C-0001 Amina Moussa ribbon fills tile by tile, red after red; counter climbs to $137.50 shipped for nothing; stamp BLOCK COD · deliberate · 5.5/6.
   2. *"Three refusals in one week — and left alone."* C-0023: three reds inside the shaded outage band; courier-at-fault 93%; stamp ALLOW. Put C-0001 and C-0023 side by side: same count of recent failures, opposite verdict.
   3. *"Caught by the phone number."* C-0097: four accounts, six addresses, one phone. Show honestly: lane correct (BLOCK COD), name wrong (refuser 0.40 vs hopper 0.46) — "right action, wrong reason, 7 out of 7 times".
   4. *The miss.* C-0163, a wrong-address customer with successful reshipments, blocked. Then the group recall bars.
   Closing number: **30 of 36 abusers restricted, 8 of 10 innocents untouched, at 94% precision.**

6. **Re-runnable model test.** Card: macro recall and per-group recall for name and for lane, precision/recall of "restricted", innocents kept (n/10, as a hard gate), coherence (pattern named + ALLOW), severity AUC, ECE ×2, forward-looking net saving, baselines (always-ALLOW 80%; refusal-rate ≥ 50% and ≥ 3 refusals rule: flags 19, 17 abusive, 2 innocents). Gates: innocents wrongly restricted ≤ 1; lane recall on abuse ≥ 90%; macro recall ≥ 90%. Dataset: more innocents (10 is a tiny denominator; aim for 40 across ≥ 4 excuses: outage, wrong address, damaged-in-transit streak, hospital/travel note), remove the `COURIER_OUTAGE` reason code or make it noisy, vary hopper account counts (all 7 have exactly 4), balance NORMAL down or report macro metrics only, multi-seed.

7. **Bugs and defects seen.**
   - Raw JSON stage, clipped on the right edge (`cod-abuse-3-stage-scored.png`, `-7-present.png`, `-1-landing.png`).
   - Sticky site header painted over the item table in the stage capture (`cod-abuse-3-stage-scored.png`; same in `merchant-onboarding-3-stage-scored.png`) — check z-index/scroll-margin of the stage under the fixed nav.
   - KPI values wrap mid-number: "$2,225.0 / 0" and "$38,855. / 17" (`cod-abuse-6-report.png`); cents are noise here.
   - "Shipping cost avoided" toned good unconditionally (`demo.js:147`).
   - Check labels in lower case ("serial refuser pattern or lane wrong") while other demos use sentence case.
   - Phones are +971 (UAE) and addresses are "Chapel Street, Jarrow Bay" with USD amounts — the locale is incoherent for a COD market story.

8. **Top 5 actions.**
   1. Build the order-ribbon customer view with outage bands and the accounts/addresses lane. [M] [demo-only, reusable for 116]
   2. Replace the two economics KPIs with a forward-looking before/after cost line; render the hidden `innocents` ledger. [M] [demo-only + small shared widget]
   3. Headline on macro/per-group recall and restricted precision/recall, with the majority baseline shown. [S] [demo-only]
   4. Fix the taxonomy: hopper-vs-refuser precedence or multi-label; a lane that fits promo abuse; drop the dead CARELESS option or give it planted cases. [M] [demo-only, needs re-record]
   5. Remove the `COURIER_OUTAGE` reason-code leak and enlarge the innocent set to 40. [M] [demo-only]

---

### 113 · Dispute and refund routing (`dispute-routing`)

**Scores (0–10):** Story clarity 7 · Item stage 5 · Answers-to-decision legibility 7 · Report and charts 6 · Presenter readiness 3 · Evaluation rigour 6 · Re-run/benchmark readiness 6

1. **The one-sentence value.** "A customer message goes in; a typed backend call comes out — action, amount, reason code — and we grade every argument, not just the tool choice." First paint is the generic fact grid; the message (the human hook) is at the bottom of the card and the call (the payoff) is three panels down. The best idea in the domain is invisible at first paint, but once reached, "THE CALL THIS BUILDS" (`dispute-routing-5-evaluation.png`) is the only bespoke, genuinely legible evaluation block in these six demos.

2. **Item stage review.** QueueView shows 12 facts then the message (`dispute-routing-3-stage-scored.png`). Cut by the 12-field cap: `wantsToKeep`, `cosmetic` (both decide the 25%/50% partial bands), `customer`, `orderId`; nulls (`cancelledOnRecord`, `duplicateChargeId`) are dropped silently although they decide SUBSCRIPTION and DUPLICATE. The refund policy — the thing being applied — is never on stage.
   - Bespoke visual — **ticket → policy → call**, three columns. Left: the customer's message as a chat bubble with name, "customer since 2026", "0 previous disputes" chips, and claim type as a pill. Centre: the seven policy rules as a checklist, each evaluated against this dispute for the viewer ("Lost after 10 days without a scan — 14 days ✓", "Refund above £300 needs a person — £129.55 ✓", "Photo for damage — n/a"). Right: the call card, empty until the answers land, then filling argument by argument (endpoint, amount, band, reason code), each argument carrying its own confidence bar and, in graded mode, a ✓/✗ against the label.
   - Format: `Claim NOT_RECEIVED` → "Not received"; money with £; `Days Since Last Scan 14` next to the policy's 10.

3. **Answers and evaluation strip.**
   - The question set is good and the label-free "refund calls that refund nothing" check is the best evaluation idea in the domain. Extend it: all 7 disputes where the policy says DENY but the model chose REFUND_NOW (DSP-0003, 0019, 0051, 0054, 0076, 0156, 0203) have band NONE **and** `policy_allows` < 0.5 (0.26–0.42) **and** automation < 4. Three of five answers said "no"; the action said "yes". A majority-of-answers coherence rule would have caught 7 of the 22 wrong actions for free. Show that.
   - `refund_band` FULL vs FULL_PLUS_SHIPPING: 42 of 76 band errors are FULL→FULL_PLUS_SHIPPING. The option text says "where the shop or its courier is at fault", and a model can reasonably hold the shop at fault for a duplicate charge or a not-as-described item. The label policy is narrower than the wording. Tighten the wording or accept both where shipping = 0 (the finding already admits 7 of these are the same money).
   - `reason_code`: 8 of 13 errors are NO_FAULT_FOUND→SUBSCRIPTION, and the labels themselves are inconsistent on denied claims: friendly fraud is labelled NO_FAULT_FOUND, but policy-expired DSP-0057 is labelled NOT_AS_DESCRIBED. Decide whether a DENY carries the *claim* category or the *finding* and make the labels and option text agree.
   - `confidence_to_automate` is a self-assessment question; useful, but its scale label "How safely could this call be made" mixes confidence with stakes.
   - Verdict card: the call itself, plus "Policy agrees: action ✓ · band ✗ (policy: FULL, £129.55 — model adds £4.95 shipping) · reason ✓" and "Would send unseen: yes (4.55 ≥ 4)".

4. **Report, charts and metrics.**
   - **KPI contradiction:** "Refunded £11,691.64 · 162 refunds · £0.00 of it against policy" is toned **warn** (`demo.js:173`) because `wrongRefunds.length` is 7 while their money is £0.00 — they are the empty refunds. The reader sees an amber tile that says nothing is wrong. Say instead: "7 refund calls on disputes the policy refuses — all for £0".
   - **The "generous" narrative is wrong in money.** Notes say the model is "consistently more generous than the policy". Recomputed: policy would refund £13,957.11; the model's calls carry £11,691.65. Over-payment is only **£211.95** (shipping add-backs); under-payment is **£2,477.41**, driven by 21 FULL→NONE empty refunds. Net the model under-refunds by £2,265 — customers owed money get a zero call. That is a better, truer story: the failure is incoherence, not generosity.
   - **"Safe to send unseen: 97"** contradicts its own context "76.3% of those calls fully correct". 23 of the 97 "safe" calls carry a wrong band or reason. Rename to "Would send unseen" and headline the fully-correct share; gate safe-to-send on coherence too (2 empty refunds clear the ≥4 bar).
   - Baseline: always-REFUND_NOW = 165/220 = 75.0% vs the model's 90%. Per-class action recall: refund 93.9%, request evidence 100% (n=5), escalate 83.3% (15/18), **deny 71.9% (23/32)** — deny is the costly class and the weakest; say so.
   - Component accuracy: action 198/220, band 144/220 (65.5%), reason 207/220 (94.1%). The report only shows action and whole-call; add the two middle numbers as a funnel (action → +band → +reason: 90% → … → 57.3%).
   - Calibration: action ECE 0.132 and under-confident (answers at ~50% confidence are right 88%); band ECE 0.155 with the 66 answers at ~32% confidence right only 17% — band confidence is a usable "do not automate" signal, better than the self-reported automation score. Plot both.
   - Curve: this is an automation-vs-accuracy curve (at ≥3: 154 automatic, 97.4% right; at ≥4: 97, 100% on action). Draw it as such: x = share of queue automated, y = accuracy of automated calls (action and whole-call as two lines), with the chosen bar marked. The generic coverage labels do not fit.
   - Distribution tones: REFUND_NOW = good, everything else warn (`demo.js:207`). Paying out is not "good" and denying friendly fraud is not a warning. Use neutral categorical colours.
   - **Label defect:** DSP-0052 is labelled REFUND_NOW · FULL_PLUS_SHIPPING = £304.95 (order £300.00 + £4.95), but the policy in the state says "Refunds above 300 are signed off by a person, whatever the merits." The generator tests the order total, not the refund. It is also the top "Worth opening" row. Its message reads "a linen duvet set inside is cracked" (template slip); DSP-0057 has claim NOT_AS_DESCRIBED with a message that says "It arrived smashed".

5. **Bespoke Present screen** (5 beats).
   1. *Message in, call out.* DSP-0001: the chat bubble ("Still no parcel… it has said that for 20 days"), the policy checklist ticks "14 days > 10", the call card types itself: `POST /v1/disputes/DSP-0001/refund · £134.50 · NOT_RECEIVED`.
   2. *Friendly fraud, denied with a code.* DSP-0066, £247.63, signed-for, third not-received claim: checklist shows "3rd claim + proof of delivery ✗", call is `/decline · NO_FAULT_FOUND`, 98% confidence. 18 of 18.
   3. *Asks instead of deciding.* DSP-0106, damage, £123.93, no photo: call is `/evidence-request · PHOTOGRAPH_OF_ITEM · due in 7 days`. 5 of 5.
   4. *The typed contradiction.* DSP-0003: action REFUND_NOW, band NONE, policy-allows 40% → `amount: 0`. "Every answer is well-formed; together they disagree. We catch it without a single label." 27 of 162.
   5. *The funnel and the automation bar.* 90% action → 57% whole call; 97 calls clear the bar with 100% correct actions.
   Closing number: **90% pick the right tool; 57% fill every argument right — and the 27 self-contradicting calls are caught with no labels at all.**

6. **Re-runnable model test.** Card: action accuracy + per-class recall, band accuracy, reason accuracy, whole-call accuracy, £ over-paid / £ under-paid vs policy, refunds against policy (count and £), coherence violations (empty refunds; policy_allows vs action), automation rate at the bar and whole-call accuracy above it, ECE per question, per-slice (6 kinds), always-refund baseline, delta vs last run. Gates: £ against policy = 0; deny recall ≥ 90%; coherence violations = 0 among automated calls; whole-call accuracy of automated calls ≥ 95%. Dataset: fix the £300 edge (DSP-0052) and the DENY reason-code convention; hand-write or heavily vary the 171 "everyday" disputes (21 of 22 wrong actions live there and they are templated); add boundary cases on every numeric rule (day 10/11, day 30/31, £300/£300.01, third claim with and without proof); raise REQUEST_EVIDENCE (5) and policy-expired (6) to ≥ 20 each.

7. **Bugs and defects seen.**
   - Endpoint shows the literal placeholder `POST /v1/disputes/{id}/refund` instead of the dispute id (`dispute-routing-5-evaluation.png`).
   - `Policy Allows ⚠ Yes` rendered as an amber warning on a correct, allowed refund (same shot).
   - `"amount": 134.5` in the call body (no fixed decimals) next to "£134.50" in the header.
   - "£11,691. / 64" wraps mid-number; amber tone with "£0.00 against policy" (`dispute-routing-6-report.png`).
   - `Claim NOT_RECEIVED`, `Order Total 129.55` raw on the stage (`dispute-routing-3-stage-scored.png`).
   - Curve's dashed precision line starts at the top-left and is unreadable without axes (`-6-report.png`).

8. **Top 5 actions.**
   1. Ticket → policy checklist → call-card stage, with per-argument confidence and ✓/✗. [M] [demo-only]
   2. Correct the report narrative and KPIs: under-refund £2,477 vs over-refund £212, 7 zero-refund calls on deny cases, rename "Safe to send unseen", neutral distribution tones. [S] [demo-only]
   3. Add the coherence rule across action / band / policy_allows as a label-free gate, and show how many wrong actions it catches (7 of 22). [S] [demo-only]
   4. Fix labels: DSP-0052 (> £300 refund), DENY reason-code convention, message/claim template slips; vary the everyday queue; re-record. [M] [demo-only]
   5. Automation-vs-accuracy chart with two lines (action, whole call) and the accuracy funnel. [M] [shared-runtime]

---

### 114 · Chargeback evidence (`chargeback-evidence`)

**Scores (0–10):** Story clarity 5 · Item stage 1 · Answers-to-decision legibility 4 · Report and charts 3 · Presenter readiness 1 · Evaluation rigour 4 · Re-run/benchmark readiness 4

1. **The one-sentence value.** "Before the deadline, know whether this evidence packet wins as it stands, which single document would flip it, and whether it is worth the effort." First paint is four rows of raw JSON (`chargeback-evidence-3-stage-scored.png`, `-7-present.png`). A disputes analyst would recognise nothing.

2. **Item stage review.** `view: 'table'` stringifies `order`, `dispute`, `evidence`, `transactionSignals`. The natural object here is a **checklist against a rule**, and the state even carries the rule (`reason_requirements`: decisive + supporting documents per reason code) — which the stage never shows.
   - Bespoke visual — **the evidence packet board**: header strip "PRODUCT NOT RECEIVED · $1,273.04 · Visa debit · deadline 21 Sep — 2 days left" with a deadline bar (as-of → deadline, a 3-day "typical collection" block overlaid so deadline risk is visible as overlap). Below, five document cards in a row (AVS/CVV, delivery proof, terms acceptance, comms log, refund proof); each card is either filled (key facts: "Signed by Sami Sabri · 1 Aug · GPS match") or an empty dashed slot; a "DECISIVE" ribbon on the card(s) the reason code requires and "supporting" on the others. Right side: a win gauge 0–6. When the answer lands, the missing-document card pulses and the gauge shows a ghost needle at the "with this document" position.
   - Transaction signals as four chips (device match, IP country match, 16 prior good orders, 0 chargebacks).

3. **Answers and evaluation strip.**
   - `missing_document.NONE` is overloaded: "The current packet is complete, **or** no single missing document would make it viable." Hopeless packets are therefore legitimately NONE by the question's own wording, but are labelled with a specific document (CB-0002: AVS_CVV) and ACCEPT_LOSS. Split NONE into COMPLETE and NOT_REPAIRABLE.
   - `next_step.ACCEPT_LOSS` was **never chosen** (0 of 120); all 25 ACCEPT_LOSS labels went to GATHER_MORE. The state gives no rule for "hopeless" (how many missing documents, or what deadline margin, makes a packet not worth it), and no cost of analyst time against the disputed amount. The 0/19 on hopeless packets is as much a specification gap as a model failure. Put the operating rule in the state ("more than one decisive/supporting document missing, or fewer days left than collection time ⇒ accept the loss") or drop the lane.
   - `win_likelihood ≥ 3.5 ⇒ WIN` (`demo.js:8`) is an arbitrary cut. The score ranks wins almost perfectly (AUC **0.961**) but is pessimistic: accuracy is 99/120 at 3.5, **107/120 (89.2%) at 2.5**. "21 labelled wins scored below threshold" is a threshold defect the page presents as a model defect. Let the report pick (and show) the best threshold, or anchor the scale ("3 = even odds").
   - Generator defect that contaminates the questions: **95 of 120 packets contain documents marked `present: false` that still carry full contents** (CB-0001: terms acceptance `present:false` with `acceptedAt`, `version`, `sourceIp`; CB-0002: delivery proof `present:false` with tracking number, `signedBy`, `gpsAddressMatch:true`). An absent document must be `{present:false}` only. Also implausible timestamps: AVS `checkedAt` two months after the order was placed; a PROCESSED partial refund of $554.29 on a packet disputing the full $1,273.04 and labelled WIN.
   - Verdict card: "SUBMIT · 4.8/6 · nothing missing" + truth chip + "$1,273 defended" + "2 days left — inside the 3-day collection window". `Flagged` = GATHER_MORE is an odd use of the flag.

4. **Report, charts and metrics.**
   - **The reliability chart is drawn wrong.** `reliability()` returns per-bin counts (`reviewed` = packets in bin, `caught` = wins in bin; `demo.js:136-143`) but the shared curve plots `reviewed` on x and `caught` on y as if cumulative. Bin counts are non-monotonic (0, 38, 39, 18, …), so the line loops back on itself (`chargeback-evidence-6-report.png`, the scribble under "Win-score reliability"). A reliability diagram needs x = score bin (or mean predicted), y = observed win rate, diagonal reference, bin counts as bar heights. From the data: bin 1 → 0% of 38, bin 2 → 20.5% of 39, bin 3 → 72.2% of 18. That is a lovely S-curve and the PRP's second video beat; it needs its own widget.
   - "Calibration" is against deterministic generator labels (WIN = rule satisfied), not outcomes with noise; call it "score vs rule", or make outcomes probabilistic in the generator (win probability per packet, outcome sampled with a seed) so ECE/Brier mean something.
   - "Gather-more value $64,329.73" toned **good** (`demo.js:117`) is 65% of all disputed money and includes **$19,083 on the 19 hopeless packets** (wasted effort) and $23,275 on mixed; only $21,972 is on the 31 one-document-away packets where gathering actually flips the result. Split the tile into "recoverable if gathered", "wasted on hopeless", and show "labelled-win value submitted: $34,944 of $38,603".
   - "Next-step accuracy 77.5%" has the context "25 predicted wins · 46 labelled wins", which is about a different metric; the `actualWins` arithmetic (`demo.js:111-112`) is a convoluted way of counting labelled wins.
   - The 31/31 on one-document-away packets (outcome, document and step all right) is the strongest result in the file and is a green tick in the middle of the checks list. Lead with it.
   - Matrix: the only off-diagonal mass is the NONE row (7 → delivery proof, 10 → comms log, 2, 2): complete packets for which the model still asks for something. That is over-gathering, a cost in days; say it in money/days.
   - Hidden sections: `flips` = 31 rows {id, expectedDocument, namedDocument, gathered, currentScore} — draw as a dumbbell chart: one row per packet, left dot = current score (0.95–2.34), right dot = score with the document added, coloured by whether the right document was named. The right dot needs a counterfactual re-ask with the document added (a second recorded pass over 31 items); without it the PRP's "2 of 6 jumps to 5 of 6" beat cannot be shown. `money` = {gatherMore 64,329.73, totalDisputed 99,273.84} — a single stacked bar of disputed value by lane (submit / gather-recoverable / gather-hopeless). `deadlineAccuracy` = 97.5% (117/120, with 14 true positives labelled) — a KPI tile with precision/recall since positives are 12%.
   - Missing: precision/recall for WIN, threshold-selected accuracy, majority baseline (LOSS = 61.7%), rule baseline ("decisive document present ⇒ WIN") which will likely score ~100% — i.e. the outcome label is a lookup of `present` flags against `reason_requirements` that are *in the state*. The model is being graded on re-deriving a rule it was handed.

5. **Bespoke Present screen** (4 beats).
   1. *A packet that loses today.* CB-0003, product not received, $1,889.26: four cards filled, the DECISIVE delivery-proof slot empty; gauge 1.6/6.
   2. *The one document.* The model names DELIVERY PROOF; the empty card pulses; the card flips in and the ghost needle moves (needs the counterfactual pass). Caption: "31 packets like this. 31 of 31 named correctly."
   3. *The clock.* CB-0001: complete packet, 2 days to deadline, 3-day collection time → SUBMIT now, do not gather.
   4. *The money board.* Stacked bar of $99,274 disputed: $34,944 submitted as winners, $21,972 one document from winning, $19,083 the model would still chase although it is lost. Then the reliability S-curve.
   Closing number: **$21,972 moves from lost to winnable by fetching one named document per packet.**

6. **Re-runnable model test.** Card: WIN AUC, accuracy at the chosen threshold (and the threshold), Brier/ECE on sampled outcomes, missing-document accuracy + over-gathering rate on complete packets (21 of 46 today), next-step per-class recall (ACCEPT_LOSS 0/25 is the gate that fails), deadline-risk precision/recall, $ by lane, flip delta (mean score lift when the named document is added), per-slice (4 cohorts × 5–6 reason codes), baselines (majority, presence-rule). Gates: one-document-away all-three-right ≥ 95%; ACCEPT_LOSS recall ≥ 70%; over-gathering ≤ 15%. Dataset: strip contents from absent documents; fix timestamp order; add *quality* variation within present documents (delivery proof to the wrong address, AVS partial match, comms log that concedes the point) so the task is judgement rather than presence-lookup; state the hopeless rule; probabilistic outcomes; 300+ packets.

7. **Bugs and defects seen.**
   - Reliability chart loops back on itself (`chargeback-evidence-6-report.png`).
   - Entire stage is raw JSON (`-3-stage-scored.png`, `-7-present.png`).
   - Distribution bar: five identical amber segments + one green; it shows *named document* mix, which is not a good/bad quantity at all.
   - "$64,329. / 73" wraps mid-number; toned good.
   - "Worth opening" rows have no packet id in the label ("subscription cancelled · terms acceptance"), and the top row CB-0104 ($2,400, 1.0/6) cannot be told from CB-0061.
   - Check labels lower-case ("strong packets with any wrong decision").
   - Absent documents shown with full contents on the stage, so even a careful human reads TERMS_ACCEPTANCE as present.

8. **Top 5 actions.**
   1. Evidence-packet board view (document cards, decisive ribbon, deadline bar, win gauge). [M] [demo-only]
   2. Real reliability-diagram widget (x = score bin, y = observed rate, counts as bars, diagonal) and stop feeding bin counts to the coverage curve. [M] [shared-runtime]
   3. Fix the generator: empty absent documents, timestamp order, quality variation; state the hopeless rule; split NONE. Re-record. [L] [demo-only]
   4. Record the counterfactual pass for the 31 flip packets and draw the `flips` dumbbell; render `money` as a stacked lane bar and `deadlineAccuracy` as a tile. [M] [demo-only + shared widget]
   5. Choose the win threshold from the data (2.5 → 89.2%) or anchor the scale; split the gather-more tile into recoverable vs wasted. [S] [demo-only]

---

### 115 · Merchant onboarding risk (`merchant-onboarding`)

**Scores (0–10):** Story clarity 7 · Item stage 4 · Answers-to-decision legibility 5 · Report and charts 6 · Presenter readiness 2 · Evaluation rigour 5 · Re-run/benchmark readiness 5

1. **The one-sentence value.** "Underwriting is pricing, not refusing: read the application, the website and the documents, and set the reserve that makes the merchant takeable." The report's second finding says exactly this and it is the best single sentence in the domain — but first paint is a 20-row key/value table for an unremarkable stationery shop (APP-001), and the sentence is 3,000px away.

2. **Item stage review.** TableView is at least readable here because most fields are scalar (`merchant-onboarding-3-stage-scored.png`), but the two things an underwriter actually reads — the website excerpt and the document notes — are rows 18–20, and `documents` is raw JSON. The acquirer's prohibited list, category rules and reserve guidance (all in the state) are never shown, so the "matching line highlighted" video beat is impossible.
   - Bespoke visual — **the underwriting file**: left, a browser-frame mock of the merchant's site holding `websiteExcerpt` and `refundPolicy` as the page copy, with the delivery promise as a shipping banner ("Delivery in 37 days"). Centre, the company card: legal vs trading name (mismatch flagged), months registered as an age bar, directors, director history, bank vs trading country, previous processor, declared chargeback rate. Right, the document checklist: four rows with a status dot and the reviewer note ("Company number does not exist on the register" in red). Bottom: a **settlement bar** — one month of expected volume as a full-width bar with the proposed reserve carved out of it in a second colour and the £ amount, so "rolling hold ≈ a third of a month = £96,910" is a picture. In graded mode, overlay the label's `chargebacksLater` as a marker on the same bar: reserve short of the marker = under-reserved.
   - For prohibited cases, show the acquirer's "does not accept" list beside the site and highlight the matching line and the matching phrase (APP-086: "reverses joint damage and cures inflammation").
   - Hide `documentsClear` / `documentsExpected` (derived counts, not in the state — the viewer should not see what the model did not).

3. **Answers and evaluation strip.**
   - `reserve` collapsed to a binary: NONE ×109, ROLLING_HOLD ×31; the 5/10/20% bands were never chosen. The notes own this. The fix proposed there (reserve as a score) is right; better still, ask for the reserve as a share of monthly volume with anchors tied to the guidance in the state, and grade it against `chargebacksLater / volume` (which ranges 0.12–0.39 for the 11 bad merchants).
   - `RESERVE_SHARE.ROLLING_HOLD = 0.3` (`demo.js:12`) is a constant that decides the headline: bad merchants cost 12–39% of a month's volume, so a 30% hold over-covers six and under-covers five by construction. "111.1%" is an artefact of that constant, not evidence of pricing skill.
   - Coherence: APP-087 is APPROVE + MEDIUM + ROLLING_HOLD (approve without a person but hold a third of a month) and 8 applications are LOW tier yet REVIEW. Worth a label-free check row.
   - `document_doubt` works (all 5 forged files at 3.5–4.9, the top of the file) but did not drive the decision for 3 of them — the report says so, good.
   - Verdict card: "REVIEW · high risk · rolling hold £96,910 of £323,034/month" + truth "went on to £116,292 of chargebacks — £19,382 short" or, for a decoy, "turned out fine — £42,066 of a good merchant's cash held". `Approved ⚠ Yes` / `Boarded ⚠ Yes` are amber on a correct clean approval (`merchant-onboarding-5-evaluation.png`).

4. **Report, charts and metrics.**
   - Six KPIs, four of them "0 of N / 6 of 6" perfects. 0 bad approved and 0 good declined is achieved by routing everything uncertain to REVIEW (37, of which 23 were good). With no cost on review, REVIEW is a free action and the test cannot be failed on the two headline axes. Give review a cost (hours, days-to-board, abandonment of good merchants) and report it.
   - **Aggregate coverage hides per-merchant shortfall**: "111.1% — £460,445 held against £414,610" is toned good while the next tile says 5 of 11 are under-reserved by £47,878. Surplus on APP-107 (held £70,335 vs cost £28,134) cannot pay for APP-027's gap. Headline the per-merchant coverage: 6 of 11 fully covered; uncovered loss £47,878 (11.5% of the total).
   - **Missing cost of caution:** reserves were also placed on 9 *good* merchants, locking **£149,456** of their money (3 of the 9 look-risky decoys got a rolling hold: APP-048, APP-069, APP-117, all travel). That is the counterweight to "pricing, not refusing" and belongs next to it.
   - A two-field rules baseline (delivery promise ≥ 14 days and registered < 18 months) flags 14 applications and captures 11 of 11 chargeback-heavy merchants. 10 of the 11 are dropshipping/digital with 25–44-day promises. The planted pattern is one template.
   - Forgery detection is a string lookup: the five forged files are exactly the five with non-benign document notes ("Company number does not exist on the register" ×2, "mail forwarding office… logo is the wrong shape" ×2, "expired in 2023… photograph looks reused" ×1) and all five also have `names_differ: true` (5 of 17 mismatches). The curve (5 of 5 at doubt ≥ 3, 100% precision) is perfect because the note states the verdict. Make the notes observational ("issuer logo differs from the 2025 template", "registry lookup returned no match for 0912…") and add benign look-alikes.
   - Matrix: 4×3 outcome × decision; header still says "Planted ↓ · Called →", which is wrong for this table. The screenshot puts Prohibited "6" under Review (layout bug; true value: Decline 6). Replace with a **Sankey / alluvial**: outcome (good 118, chargeback-heavy 11, prohibited 6, fraud 5) → lane (approve 95, review 37, decline 8), ribbon width by count, second view by monthly volume.
   - Right charts: **reserve vs realised loss scatter** for the 11 bad merchants (x = chargebacks later as % of monthly volume, y = reserve held %, diagonal = exactly covered; points under the line are the 5 under-reserved), plus the same strip for good merchants on y only. Document-doubt strip plot by group.
   - Missing: precision/recall of "not approved" for problem files (22/22 recall, 22/45 = 48.9% precision), review-queue yield (14/37 = 37.8%), time-to-board cost, baselines.

5. **Bespoke Present screen** (5 beats).
   1. *The dropshipper.* APP-062 Beacon Direct: site frame with "delivery in 27 days", young company, £146,615/month. Verdict REVIEW · HIGH · rolling hold; the settlement bar carves out £43,984.
   2. *What happened next.* Truth marker slides onto the bar: £52,781 of chargebacks — held 83% of it. "Not refused. Priced — and slightly under-priced."
   3. *Declined on the list.* APP-086 Meridian Trading, supplements: the acquirer's list beside the site, the matching line highlighted against "cures inflammation in fourteen days". PROHIBITED, decline. 6 of 6.
   4. *Looks risky, was fine.* APP-100 (crypto-adjacent hardware wallets): LOW, approve, no reserve — turned out fine. 9 of 9 decoys never refused.
   5. *The portfolio.* Reserve-vs-loss scatter: 6 above the line, 5 below, £47,878 short; then the counterweight — £149,456 held on good merchants.
   Closing number: **0 good merchants refused, 0 unacceptable ones approved, and 88.5% of the eventual losses already held in reserve.** (Use the per-merchant covered share, not 111%.)

6. **Re-runnable model test.** Card: never-acceptable approved (gate = 0), good declined (count and £ volume), review rate and review yield, per-merchant reserve coverage (share covered, uncovered £), over-reserve on good merchants (£), prohibited exact-match precision/recall, document-doubt AUC, tier × decision coherence violations, reserve band usage (flag collapse to two values), per-slice by category and by kind, rules baselines, delta vs last run. Gates: bad approved = 0; good declined ≤ 1%; uncovered loss ≤ 10%; review rate ≤ 25%; at least 3 reserve bands used. Dataset: more and more varied bad merchants (11/6/5 are tiny; all heavy ones share one template), bad merchants that do not look bad (established company, 2-day delivery, went bad on a product recall), document notes that describe rather than conclude, unique trading names (82 distinct names over 140 applications; "Bluewater Supply" is both APP-001 stationery and APP-009 adult-adjacent; "Meridian Group" is APP-031 and APP-078), outcomes sampled from a loss distribution with multiple seeds.

7. **Bugs and defects seen.**
   - Data contradictions: APP-001 `deliveryPromiseDays: 1` while its website says "Lead time is five to seven working days" (4 such applications); APP-086's supplements site reads "Our **lighting** formula reverses joint damage" (template slip).
   - `documents` as raw JSON; sticky header painted over the table (`merchant-onboarding-3-stage-scored.png`).
   - `Expected Monthly Volume 48,983.19` no currency; `Documents Clear 3 / Documents Expected 4` shown though not part of the state.
   - Matrix header "Planted ↓ · Called →" on an outcome × decision table; Prohibited count lands in the Review column (`merchant-onboarding-6-report.png`).
   - Risk-tier distribution: medium / high / prohibited all the same amber.
   - "Worth opening" lists trading names without ids, and names repeat.

8. **Top 5 actions.**
   1. Underwriting-file view: site frame, company card, document checklist, settlement bar with the reserve carved out and the later loss overlaid. [M] [demo-only]
   2. Replace "111.1%" with per-merchant coverage and add "£149,456 held on good merchants"; reserve-vs-loss scatter. [S/M] [demo-only + shared scatter widget]
   3. Make reserve a graded quantity (score or % of volume) instead of five bands that collapse to two; remove the 0.3 constant from the headline. Re-record. [M] [demo-only]
   4. Harden the dataset: descriptive document notes, bad merchants outside the long-delivery template, unique names, fix the delivery-promise and "lighting formula" slips. [L] [demo-only]
   5. Outcome → lane alluvial in counts and in monthly volume, with a cost on the review lane. [M] [shared-runtime]

---

### 116 · Delivery exceptions (`delivery-exceptions`)

**Scores (0–10):** Story clarity 5 · Item stage 0 · Answers-to-decision legibility 4 · Report and charts 3 · Presenter readiness 0 · Evaluation rigour 2 · Re-run/benchmark readiness 3

1. **The one-sentence value.** "From raw scans, the address and the contact log, say who caused the failed delivery and what to do with the parcel — including catching the courier who 'attempted' delivery at 03:10 from the depot." First paint shows the item title twice and one field: `Order Id ORD-D-00001` (`delivery-exceptions-3-stage-scored.png`, `-7-present.png`). Nothing else. The value cannot land because the item is, in effect, not rendered.

2. **Item stage review.** `view: 'queue'` keeps only scalar top-level fields; every useful field here is nested (`customer`, `shipment`, `address`, `trackingEvents`, `contactLog`, `courierServiceNotes`, `sameAddressHistory`, `operatingContext`), so QueueView renders exactly one fact. The Present screen is an empty card above a Run button.
   - Bespoke visual — **the parcel journey**: a horizontal scan timeline (pickup → depot → attempt 1 → attempt 2 → …) on a real time axis with the courier's delivery window (09:00–21:00) drawn as a daylight band, so a 03:10 attempt sits alone in the dark. Each attempt node carries reason, scan source icon (driver app vs depot handheld) and a GPS-distance bar ("24.6 km from the address" against "0.23 km"). Under the timeline, a contact-log lane (SMS / call markers) aligned to the same axis. Left panel: the **address card** as a form with validation-style slots — line 1, district, city, postcode, floor, unit, access instructions — missing slots outlined in red ("Floor —") and the model's address-quality score as a 0–6 meter beside the label's. Right panel: shipment facts (courier, service level, COD yes/no, order value, "3 failed attempts × $7.50 = $22.50"), same-address history ("0 delivered / 1 failed") and operating context chips.
   - Do not show `customer.linkedToDemo`.

3. **Answers and evaluation strip.**
   - **The fault label is leaked verbatim by the state.** Tracking-event `reason` maps one-to-one onto the planted fault across all 250 shipments: ADDRESS_INCOMPLETE ↔ address quality (73/73), NO_ANSWER ↔ customer unavailable (74/74), RECIPIENT_REFUSED ↔ refusal (11/11), NO_REASON_RECORDED ↔ unclear (14/14), no reason ↔ courier (78/78). `sameAddressHistory.lastOutcome: "ADDRESS_CORRECTION_REQUIRED"` repeats it. "Fault accuracy 100% · 250 of 250" is a five-row lookup table, not inference. The notes' claim that "no precomputed invalid-scan field enters the model state" is true for the night scan but irrelevant: the driver's reason code *is* the answer. Real reason codes are noisy and self-serving (drivers mark "address incomplete" to cover a missed route) — that is exactly the judgement the demo's title promises, and it is not tested.
   - A second leak: `customer: item.customer` (`demo.js:21`) passes `linkedToDemo: "cod-abuse"` into the model state for the 11 refusal customers. A cross-demo bookkeeping field is sitting in the prompt, literally containing the word "abuse".
   - **The action label is a lookup of the fault** (address → REROUTE_PICKUP 73/73, unavailable → CONTACT_CUSTOMER 74/74, courier → RETRY 78/78, unclear → RETRY 14/14, refusal → RETURN_TO_SENDER 11/11), and that mapping is not in the state. So "Next-action accuracy 46.8%" measures whether the model guesses an unstated house policy. Its disagreements are defensible: for an incomplete address it prefers CONTACT_CUSTOMER (73×) — you cannot validate a pickup reroute without talking to the customer; for courier failures it prefers REROUTE_PICKUP (45×) over retrying with a courier that just faked a scan. Either put the playbook in the state (then grade compliance) or grade actions with an acceptable-set per fault.
   - `preventable` is over-asserted: the model says yes on all 11 refusals, all 14 unclear cases and 47 courier faults; labels say only address + unavailable (147). Agreement 71.2%. The question's "could a better … customer-contact rule have prevented this" invites yes for almost anything.
   - `address_quality` is the healthy part: MAE 0.63 on a 0–6 scale against the label's numeric grade, and ≤ 3 isolates 73 of 74 — though with the reason code leaking, that too is partly read off the scan.
   - Verdict card: "COURIER at fault · attempt logged 03:10 at the depot, 24.6 km from the door, outside the 09:00–21:00 window" + action + "$7.50 attempt billed for a visit that did not happen" + truth chips for fault and action separately.

4. **Report, charts and metrics.**
   - 100% is a red flag, not a headline; see above. The matrix is a pure diagonal with no information.
   - **"Avoidable attempt cost $3,787.50"** is the *model's* attribution presented as fact (`demo.js:62`, summed at `:88`). The labels' own avoidable total is **$2,550.00**; the model overstates by 48.5% because of the preventable over-calls, and claims 90% of all failed-attempt cost ($4,195) was avoidable. The tile's context ("71.2% preventability agreement") is the only hint. Show label value, model value and the gap.
   - Cohort check rows read as disasters that are not: "address-quality cases with fault or action wrong — 38 of 38" is 38/38 fault-right, 0/38 action-match. Split fault and action into two bars per cohort.
   - "Unclear calls 14 of 250 · 14 genuinely unclear" compares counts, not identity (it happens to be 14/14 on the diagonal; the tile's tone logic `Math.abs(predicted − planted) > 5` would stay green with 14 wrong ones).
   - Hidden sections: `courierRanking` = [{Northstar Delivery, 20 failures, 3 unexplained scans}, {Falcon Express 18, 2}, {CitySprint 16, 2}, {Blue Mile 15, 2}, {Arrow Parcel 9, 1}] — the PRP's third video beat, never drawn. It ranks raw counts with no denominator (`demo.js:142-152`); per shipment handled the order changes: Northstar 20/56 = 35.7%, Falcon 18/52 = 34.6%, CitySprint 16/47 = 34.0%, Blue Mile 15/52 = 28.8%, Arrow 9/43 = 20.9% — the top three are indistinguishable. Draw as a **league table with rate bars and Wilson intervals**, columns: shipments, courier-fault exceptions, rate, invalid-scan count, billed-but-invalid attempts in $. `money` = {avoidable 3,787.50, all failed attempts 4,195.00} — a split bar by fault owner (customer address / customer availability / courier / refusal / unclear) in $, which is the operations manager's real chart: "who is costing us the redelivery fees". `unclear` = {predicted 14, planted 14} — fold into a precision/recall tile for UNCLEAR.
   - Curve: "Address-quality review threshold" is near-perfect (≤ 3 → 74 reviewed, 73 caught) — again suspiciously easy; present it as an address-score histogram by fault with the label grade overlaid rather than a coverage curve.
   - Missing: action accuracy per fault with acceptable sets, cost-weighted action error (a wrong RETRY costs another $7.50–$10; a wrong RETURN costs the order), address-score MAE (0.63), baselines (reason-code lookup = 100% fault; fault→action lookup).

5. **Bespoke Present screen** (4 beats).
   1. *The 03:10 attempt.* SHP-0007, Northstar Delivery, Abu Dhabi: timeline builds; the third node drops into the night outside the daylight band, scan source "depot handheld", 24.6 km from 31 Corniche Road. Verdict: COURIER. "Nobody knocked. The scan says they did." 10 of 10 caught.
   2. *The address that cannot be delivered.* SHP-0004: address card with the Floor slot empty, three ADDRESS_INCOMPLETE attempts, graded 2.1/6 (label 1.5); pickup point available. Show the action disagreement honestly: policy says reroute to pickup, the model says contact the customer first.
   3. *Same customer, other demo.* SHP-0022 is C-0001 Amina Moussa — the serial refuser from demo 112 — refusing a COD parcel at the door. Fault: customer refusal. The model wants a pickup reroute; policy says return to sender. One line: "112 would have stopped this parcel before it shipped."
   4. *The league table.* Five couriers by courier-fault rate with intervals, and the $ split bar by fault owner.
   Closing number: **10 of 10 fake delivery attempts caught from raw scans** (do not close on "100% fault accuracy" until the reason-code leak is removed).

6. **Re-runnable model test.** Card: fault accuracy *with reason codes withheld or noised* (the real test), fault accuracy with codes (sanity), invalid-scan recall and false-alarm rate, UNCLEAR precision/recall, action accuracy against acceptable sets + cost-weighted action error, address-score MAE and rank correlation, preventable precision/recall, $ avoidable: label vs model, courier-table stability (rank correlation vs label-derived table), per-slice by courier/city/COD, lookup baselines, delta vs last run. Gates: invalid-scan recall ≥ 90% with ≤ 5% false alarms on legitimate early/late scans; fault accuracy ≥ 85% on the noised split; UNCLEAR recall ≥ 70%. Dataset: drop or corrupt the `reason` field on a large share of events (wrong code on ≥ 20%, including couriers mis-blaming the address), remove `lastOutcome` strings that name the fault, remove `linkedToDemo` from the state, vary the night-scan time (all ten are exactly 03:10, all HANDHELD, all at the depot), add legitimate out-of-window attempts (customer-requested evening slot), add conflicts (NO_ANSWER but the contact log shows the customer answered), put the action playbook in the state or grade with acceptable sets, unify geography (Alexandria, Abu Dhabi, Dubai and "River Road, London" with +971 phones and USD).

7. **Bugs and defects seen.**
   - Stage renders one field (`delivery-exceptions-3-stage-scored.png`); presenter first screen is an empty card (`-7-present.png`).
   - `linkedToDemo` in the model state (`demo.js:21`).
   - `Flagged ⚠ Yes` = "fault is not UNCLEAR", amber on a confident correct call; `Preventable Probability 0.90`, `Avoidable Cost 22.50` unformatted (`delivery-exceptions-5-evaluation.png`).
   - "$3,787.5 / 0" and "14 of / 250" wrap inside the KPI tiles (`delivery-exceptions-6-report.png`).
   - Matrix: with the layout bug every diagonal count appears in the second column; the repaired matrix is a pure diagonal.
   - "Worth opening" rows are all "… · contact customer" with near-identical scores and no shipment id or courier in the label; addresses repeat street names ("River Road" ×6 of 10).
   - Findings array is empty, so the report has no narrative at all.

8. **Top 5 actions.**
   1. Parcel-journey view (time-axis scans with the delivery-window band, GPS distance bars, address-slot card, contact lane). Without it the demo has no stage. [M] [demo-only; shares the ribbon component with 112]
   2. Remove the reason-code and `linkedToDemo` leaks, noise the codes, vary the night scans; re-record; report fault accuracy on the noised split. [L] [demo-only]
   3. Render the courier league table with rates and intervals and the $ split by fault owner (both already computed, never drawn). [M] [shared-runtime widget + demo-only denominators]
   4. Put the action playbook in the state or grade against acceptable action sets; split fault/action in the cohort checks. [M] [demo-only]
   5. Show avoidable cost as label $2,550 vs model $3,787.50 and tighten the `preventable` question. [S] [demo-only]

---

## Domain summary

**Cross-demo patterns.**

1. **The stage is the domain's weakest surface, and it fails in three different ways.** Queue demos lose their evidence to the 12-scalar cap (111 hides the reshipper's tell; 113 hides the partial-refund flags), table demos print arrays as JSON (112, 114), and 116 renders a single field. These items are all *stories over time or over a checklist* — an order history, a scan trail, an evidence packet, an application file, a ticket — and none of them is a bag of key/values. Two reusable components would cover four demos: an **event ribbon on a time axis with shaded context bands** (112 orders + outage days, 116 scans + delivery window) and a **slot checklist against a rule** (114 documents vs reason-code requirements, 115 documents + prohibited list, 116 address slots, 113 policy rules).
2. **Headline numbers flatter the run while the real finding sits in a context string or is absent.** 111: "83 sent to a person" toned good while £56,480 of good orders wait and stop precision is 10.2%. 112: 96.1% is mostly the 80% majority class; macro recall is 80%. 113: amber tile saying "£0.00 against policy"; the "generous" narrative when the model under-refunds by £2,477 vs £212 over. 114: $64k "gather-more value" toned good including $19k on hopeless packets. 115: 111.1% aggregate coverage next to 5 of 11 under-reserved, and £149,456 held on good merchants unreported. 116: 100% from a leaked field; $3,787.50 avoidable vs $2,550 by the labels.
3. **Labels are often a lookup of something in the state, so "accuracy" measures reading, not judgement.** 116 fault = reason code (100%); 116 action = f(fault); 114 outcome = presence flags against rules in the state; 115 forgery = the document note; 112 courier fault = `COURIER_OUTAGE` code; 111 fraud = two-field conjunctions (rules get 9/9 at 100% precision). Every benchmark card in this domain needs a rules/lookup baseline row, and the generators need noise, conflict and adversarial cases.
4. **Unstated policy graded as if stated.** 116 next action (46.8%), 114 ACCEPT_LOSS (0 of 25), 112 promo abusers → PREPAY_ONLY (0 of 6), 113 shipping add-back (42 band errors) and the DENY reason-code convention. In each, the model's answer is defensible and the label encodes a house rule the state never gives. Decide per demo: put the playbook in the state and grade compliance, or grade against acceptable sets.
5. **Cross-answer coherence is this domain's most original evaluation idea and only 113 uses it.** Label-free checks exist everywhere: 111 pattern named but approved (7) / pattern on good orders (34); 112 PROMO_ABUSER + CIRCUMSTANTIAL + ALLOW (6); 113 REFUND_NOW + NONE (27) and policy_allows < 0.5 + refund (7); 115 APPROVE + ROLLING_HOLD, LOW + REVIEW (9); 116 fault = courier but preventable = yes (47). A shared "coherence" row type in the report would be a differentiator for typed answers: it is a test you can run in production with no labels.
6. **Tiny denominators and dead options.** 9 frauds, 10 innocents, 5 photo cases, 6 expired, 5 forgeries, 11 bad merchants; CARELESS 0/180, ACCEPT_LOSS 0/120, three reserve bands 0/140. Report intervals, enlarge the planted groups, and surface "option never chosen" as a benchmark warning.
7. **Locale incoherence** across 112/114/116 (UAE phones, English place names, Alexandria/London mixed, USD) weakens the otherwise strong 112 ↔ 116 shared-customer link, which is a genuinely good idea that the UI never shows.

**Flagship pick: 113 · Dispute and refund routing.** It is the only demo in the domain whose output is already a *thing* (a rendered backend call) rather than a row of fields; its story is the product's thesis in one screen (typed answers become typed arguments); its result is honest and interesting (90% pick the tool, 57% fill every argument, 27 self-contradicting calls caught with no labels); the dataset is the least leaky of the six; and its fixes are mostly small (narrative, tones, DSP-0052, the `{id}` placeholder) plus one medium view. 115 is the runner-up on story ("pricing, not refusing") but needs a re-record to make the reserve a real quantity. 111 has the most recognisable use case but currently loses to a four-line rules filter, which is not what a homepage should invite people to check.

**Signature visual for the domain: the case file that resolves into a stamped decision.** Left, the evidence as a time-axis ribbon or slot checklist (orders, scans, documents, policy rules) with context bands (outage days, delivery window, deadline); right, a decision card that fills in argument by argument — action, amount, reason — each with its own confidence bar, ending in a stamp (APPROVE / HOLD £96,910 / REFUND £134.50 / BLOCK COD / RETURN) and, in graded mode, a truth chip and the money at stake. Domain colour logic: money kept vs money at risk as the two constant hues, so every demo's closing number is the same kind of object — pounds or dollars moved from the wrong column to the right one.
