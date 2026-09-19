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

Pending. This section will be replaced with the measured Jev results after all 180 responses are
cached in `fixtures.json`.
