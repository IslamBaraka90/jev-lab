# 113 · Dispute and refund routing

**Domain:** Orders · **Data:** synthetic (seed 1113) · **View:** queue · **Items:** 220 disputes · **Questions:** 5

## Value

Pick the action and its arguments in one call, so a dispute queue turns into a list of backend calls.

## Demo flow

1. A dispute opens with the customer's message, the order, delivery evidence and refund history.
2. The model chooses the action, the refund band and the reason code.
3. The panel shows the resulting call exactly as the backend would receive it.
4. The report shows the action mix, the money auto-refunded, and where a human is still needed.

## Data

- `demos/dispute-routing/data.json` — 220 disputes: item not received, item not as described, duplicate charge, subscription not cancelled, friendly fraud, and courier damage. Each has the customer message in plain language, the order, tracking events, prior disputes, and the merchant's refund policy.
- Planted: 18 friendly-fraud cases with delivery proof, 12 genuine non-deliveries, 8 duplicate charges, 6 policy-expired requests, and 5 cases where the right answer is to ask for one piece of evidence rather than decide.
- Labels: `{ disputeId, correctAction, reasonCode }`.

## State

The message, the order and its tracking, the customer's dispute history, the refund policy as rules, and the available actions with their argument shapes. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `action` | choice | `REFUND_NOW` · `REQUEST_EVIDENCE` · `ESCALATE` · `DENY` |
| `refund_band` | choice | `NONE` · `PARTIAL_25` · `PARTIAL_50` · `FULL` · `FULL_PLUS_SHIPPING` |
| `reason_code` | choice | `NOT_RECEIVED` · `NOT_AS_DESCRIBED` · `DUPLICATE` · `SUBSCRIPTION` · `DAMAGE` · `NO_FAULT_FOUND` |
| `policy_allows` | yes/no | – |
| `confidence_to_automate` | score 0–6 | Never · Very low · Low · Moderate · High · Very high · Always |

## Report

Action mix, agreement with labelled actions, money auto-refunded against money held, the share of queue that needs a human, and a routing table of reason code against action.

## Files

Standard demo folder plus `scripts/generate/dispute-routing.js`.

## Acceptance

Template list, plus:

- [ ] The rendered call shows the exact JSON body the backend would receive, built from the answers only.
- [ ] Policy-expired cases are graded separately, because the right answer there is a denial with a reason.
- [ ] No action is taken anywhere in the demo; it is a routing view only.

## Video beats

- One dispute, the message, and the call that comes out of it.
- The friendly-fraud case with delivery proof, denied with a reason code.
- The case where the model asks for a photo instead of deciding.

## Notes

This is the tool-call episode. Keep the argument questions narrow, so the point lands: the arguments are typed too.
