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

Pending. This section will be replaced after all 120 Jev responses are cached.

