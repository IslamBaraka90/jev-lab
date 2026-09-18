# 111 · Order risk at checkout

**Domain:** Orders · **Data:** synthetic (seed 1111) · **View:** queue · **Items:** 300 orders · **Questions:** 5

## Value

Approve, review or decline a checkout in one call, with the reason attached to the order.

## Demo flow

1. Orders arrive in a queue with basket, customer age, device, address and payment signals.
2. Each one gets a decision with its probabilities, and drops into Approve, Review or Decline.
3. A threshold slider moves the boundary between review and approve.
4. The report shows what was caught, what was let through, and what the false declines cost in basket value.

## Data

- `demos/order-risk/data.json` — 300 orders from an electronics and fashion store. Each: basket lines, totals, currency, customer tenure, prior order count, chargeback history, device fingerprint id, IP country, billing and shipping countries, address-match flags, card mask, BIN country, hour of day, checkout duration, coupon use.
- Planted: 9 fraudulent orders (0.5% would be too few to show) across four patterns — card testing with small baskets, reshipper address, account takeover with a changed address, and first-time high-value with mismatched countries. Plus 12 legitimate orders that look terrible: a genuine gift shipment abroad, a returning customer on a new device, a big-ticket first order from a corporate buyer.
- Labels: `{ orderId, fraud: true|false, pattern }`.

## State

The order, the customer's own history summarised (orders, refunds, chargebacks, lifetime value), the store's baseline rates, and the device and address signals. No label, no risk score from a rules engine.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `decision` | choice | `APPROVE` · `REVIEW` · `DECLINE` |
| `fraud_pattern` | choice | `CARD_TESTING` · `RESHIPPER` · `ACCOUNT_TAKEOVER` · `FIRST_PARTY_MISUSE` · `NONE` |
| `risk` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `address_consistent` | yes/no | – |
| `step_up_would_help` | yes/no | – |

## Report

Catch rate and false-decline rate against labels, basket value approved and declined, pattern distribution, the decision threshold curve, and the twelve decoys with whether each was approved.

## Files

Standard demo folder plus `scripts/generate/order-risk.js`.

## Acceptance

Template list, plus:

- [ ] False declines are reported in money as well as count.
- [ ] Every planted pattern appears at least twice in the dataset.
- [ ] The decoys are listed in `notes.md` with why they look risky.

## Video beats

- The corporate first order: high value, mismatched countries, approved with a reason.
- Card testing: five small orders, one device, caught as a pattern.
- The threshold slider trading catch rate against false declines, in money.

## Notes

Fraud rates here are deliberately higher than production so a 300-item demo has something to show; say that on the page.
