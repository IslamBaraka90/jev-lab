# 114 · Chargeback evidence

**Domain:** Orders · **Data:** synthetic (seed 1114) · **View:** table (packet checklist) · **Items:** 120 packets · **Questions:** 4

## Value

Judge whether an evidence packet can win the case, and name the one document that would change the answer.

## Demo flow

1. A chargeback opens with the network's reason code and the evidence gathered so far.
2. The model grades the packet and names what is missing.
3. Packets sort into submit, gather more, or accept the loss.
4. The report estimates win rate and the money riding on the packets worth improving.

## Data

- `demos/chargeback-evidence/data.json` — 120 packets across reason codes: fraud, product not received, product unacceptable, subscription cancelled, duplicate. Each lists which documents exist: AVS and CVV results, delivery confirmation with signature, tracking, terms acceptance timestamp, customer communications, refund history, device and IP match.
- Planted: 22 strong packets, 31 one-document-away packets, 19 hopeless ones, and the rest mixed. The missing document is recorded in the labels.
- Labels: `{ packetId, outcome, missingDocument, nextStep, deadlineRisk, kind, flipsWithDocument }`.

## State

The reason code with the network's requirements, the evidence present and absent, the order, and the deadline. No label, no prior outcome.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `win_likelihood` | score 0–6 | Hopeless · Very weak · Weak · Even · Strong · Very strong · Certain |
| `missing_document` | choice | `DELIVERY_PROOF` · `AVS_CVV` · `TERMS_ACCEPTANCE` · `COMMS_LOG` · `REFUND_PROOF` · `NONE` |
| `next_step` | choice | `SUBMIT` · `GATHER_MORE` · `ACCEPT_LOSS` |
| `deadline_risk` | yes/no | Is the deadline too close to gather more? |

## Report

Predicted win rate against labelled outcomes, calibration of the score against wins, money recoverable in the gather-more bucket, missing-document distribution, and the packets where one document flips the verdict.

## Files

Standard demo folder plus `scripts/generate/chargeback-evidence.js`.

## Acceptance

Template list, plus:

- [x] The score is calibrated against labelled outcomes and the reliability curve is shown.
- [x] `missing_document` accuracy is reported separately from the win-likelihood score.
- [x] Deadline risk is derived from the dates in the state, not from a label.

## Video beats

- A packet at 2 of 6 that jumps to 5 of 6 once the delivery proof is added.
- The calibration curve on win likelihood.
- The money sitting in the gather-more bucket.

## Notes

Network rules differ by scheme; the page says the requirements here are illustrative and lists the ones used.

Implemented and recorded on 2026-09-19 with `jev-1.13.0`: 120 of 120 packet responses cached,
82.5% outcome accuracy and 81.7% missing-document accuracy. The full immutable result audit is in
`demos/chargeback-evidence/notes.md`.
