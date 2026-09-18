# 121 · Card fraud triage

**Domain:** Fraud · **Data:** synthetic (seed 1121) · **View:** queue · **Items:** 400 alerts · **Questions:** 5

## Value

Re-rank a rules-engine alert queue so the hour a human has goes to the alerts that are actually fraud.

## Demo flow

1. The queue opens as the rules engine left it: 400 alerts, ordered by rule score.
2. The model reads each alert with its transaction and customer context and gives its own read.
3. The queue re-sorts, and a marker shows where the human's hour now runs out.
4. The report compares the two orderings: fraud caught in the first 50 alerts, before and after.

## Data

- `demos/card-fraud-triage/data.json` — 400 alerts fired by named rules (velocity, high amount, new device, foreign BIN, night-time, MCC risk). Each alert carries the transaction, the last 20 transactions for that card, the customer's tenure and usual countries, and the rule that fired with its historical precision.
- Planted: 16 genuine frauds (4%), spread so that half sit low in the rule ordering. Plus 25 loud false positives: a holiday abroad, a wedding purchase, a genuine large electronics buy, a subscription renewal storm.
- Labels: `{ alertId, fraud: true|false, type }`.

## State

The alert with its rule and that rule's precision, the transaction, the card's recent history summarised, the customer's profile, and the merchant's category. No label and no rules-engine score ranking.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `fraud_likelihood` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `fraud_type` | choice | `CARD_TESTING` · `STOLEN_CARD` · `ACCOUNT_TAKEOVER` · `FRIENDLY_FRAUD` · `MERCHANT_COLLUSION` · `NONE` |
| `action` | choice | `BLOCK` · `STEP_UP` · `WATCH` · `CLOSE_ALERT` |
| `explains_itself` | yes/no | Does the customer's own history explain this transaction? |
| `contact_customer` | yes/no | – |

## Report

Fraud found in the top 50 alerts under the rule ordering against the model's ordering, a lift curve, false-positive reduction at equal catch rate, alert-type distribution, and the loud decoys with what the model did with them.

## Files

Standard demo folder plus `scripts/generate/card-fraud-triage.js`.

## Acceptance

Template list, plus:

- [ ] The rule ordering is stored in the dataset so the comparison is fair and reproducible.
- [ ] The lift curve is computed from labels and shown next to the queue.
- [ ] Both orderings are playable on screen, not just summarised.

## Video beats

- The queue re-sorting, with two fraud cases jumping from rank 180 to the top ten.
- The holiday-abroad decoy closed with "the customer's own history explains this".
- The lift curve: fraud caught in the first 50, before and after.

## Notes

Alert precision per rule is the state's most useful field; keep it, and point it out in the walkthrough.
