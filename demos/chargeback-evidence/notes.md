# Chargeback evidence

One hundred and twenty invented dispute packets across fraud, product-not-received,
product-unacceptable, cancelled-subscription and duplicate-charge claims. The rules shown to the
model are deliberately labelled illustrative because real card-network and acquirer requirements
vary.

## What was planted

`scripts/generate/chargeback-evidence.js`, seed 1114, creates 22 strong packets, 31 packets exactly
one document away from viability, 19 hopeless packets and 48 mixed packets. Labels are stored
outside the demo directory and include the current outcome, decisive missing document, intended
next step, deadline risk and cohort.

## What the model sees

Each state contains the order and dispute amounts, reason-code requirement, raw evidence checklist,
transaction signals, as-of day, response deadline and the stated three-day evidence-collection
assumption. It never receives the planted outcome or the missing-document label.

## How the report values the decision

The report grades the current win/loss classification, missing document and operating step
separately. Its reliability curve groups the model's 0–6 score and measures the labelled win rate in
each bin. The gather-more value is the disputed amount in packets the model chose to improve; it is
not presented as guaranteed recovery.

## Recorded run

All 120 responses were recorded on 2026-09-19 with `jev-1.13.0` and cached in `fixtures.json`. The
run used 185,757 input tokens and 19,404 output tokens. Every packet ID has all four answers; there
are no missing, extra or malformed records.

The model classified the current win/loss outcome correctly for 99 of 120 packets (82.5%), named the
decisive missing document for 98 of 120 (81.7%), and chose the intended next step for 93 of 120
(77.5%). Deadline risk matched 117 of 120 labels (97.5%). It chose `GATHER_MORE` for $64,329.73 of
the $99,273.84 disputed amount; this is work-in-progress value, not guaranteed recovery.

All 31 one-document-away packets received the correct outcome, document and next step. The main
weakness was stopping: all 19 hopeless packets were sent to `GATHER_MORE` rather than
`ACCEPT_LOSS`. The model also scored 21 labelled wins below the 3.5/6 win threshold, and ten of the
22 missing-document errors were complete packets for which it requested a communications log.
Those answers remain unchanged in the fixture and appear in the reliability curve and checks.
