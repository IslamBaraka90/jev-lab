# Repeat non-fulfilment abuse

One hundred and eighty invented customer histories covering eighteen months. Each customer has four
to thirty orders, and every order keeps the fields an operations team actually sees: account, date,
value, payment method, delivery outcome, courier attempts, reason code, address, promotion, refund and
any successful reshipment.

## What was planted

`scripts/generate/cod-abuse.js`, seed 1112, creates four repeated abuse patterns and two innocent
counterexamples. Labels live outside the demo folder.

| Group | Count | Evidence in the history |
|---|---:|---|
| Serial refusers | 14 | Most cash-on-delivery parcels are refused; one has exactly 11 refusals in 14 orders |
| Serial returners | 9 | Delivered card orders repeatedly come back for change of mind |
| Address hoppers | 7 | One phone links several accounts and six changing delivery addresses |
| Promotion abusers | 6 | A first-order promotion repeats across a new account for nearly every order |
| Innocent outage/address streaks | 10 | Three failures during the documented outage, or a wrong address followed by successful reshipments |
| Normal customers | 134 | Mostly delivered orders with at most an isolated refusal or damaged return |

## What the model sees

The model receives the raw history, the customer identity linking its accounts, the store's refusal
and return baselines, the seven documented courier outage days, the reason-code glossary and average
shipping cost. It does not receive refusal rates, return rates, a rules-engine score, the planted
pattern or the intended restriction.

The negative controls matter. Three refusals are suspicious when spread across ordinary weeks; the
same three on consecutive outage days with `COURIER_OUTAGE` reason codes should not cost an innocent
customer access. The wrong-address cases similarly include successful reshipments to the corrected
address.

## How the report values the decision

Pattern accuracy and access-lane accuracy are separate. A correct pattern with the wrong action is not
counted as a correct restriction. Shipping cost avoided is the restricted histories' cash-on-delivery
refusals multiplied by the store's average shipping cost. Beside it, the report shows accepted,
non-refunded order value behind every restricted lane. That second number prevents an attractive cost
saving from hiding the value of customers the policy inconveniences.

## Recorded run

All 180 responses were recorded on 2026-09-19 with `jev-1.13.0` and cached in `fixtures.json`. The
run used 453,620 input tokens and 33,601 output tokens. Every customer ID has all five answers; there
are no missing or extra records.

The model named 173 of 180 planted patterns correctly (96.1%) and chose the intended access lane for
172 of 180 customers (95.6%). It restricted 32 customers, avoiding an estimated $2,225.00 of repeat
shipping cost while placing $38,855.17 of accepted, non-refunded historical order value behind a
restricted lane. Eight of the ten explainable bad streaks kept normal access, and the courier-fault
answer matched all 180 labels.

The errors reveal two useful policy gaps. All seven address hoppers received the intended
`BLOCK_COD` lane but were named `SERIAL_REFUSER`, so the action was sound while the explanation was
wrong. All six promotion abusers were named correctly but left in `ALLOW` instead of `PREPAY_ONLY`.
Two innocent wrong-address histories were restricted: one to `PREPAY_ONLY`, one to `BLOCK_COD`.
Those mistakes stay in the fixture and in the report rather than being corrected after recording.
