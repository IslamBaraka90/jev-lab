# 112 · Repeat non-fulfilment abuse

**Domain:** Orders · **Data:** synthetic (seed 1112) · **View:** table (customer history) · **Items:** 180 customers · **Questions:** 5

## Value

Spot the customers who order on delivery and never take the parcel, before the next one ships.

## Demo flow

1. Each item is one customer with their whole order history: placed, delivered, refused, returned, reshipped.
2. The model reads the history and names the behaviour pattern.
3. Customers land in lanes: allow, prepay only, block cash on delivery.
4. The report shows shipping cost saved against customers wrongly restricted.

## Data

- `demos/cod-abuse/data.json` — 180 customers with 4 to 30 orders each, over 18 months. Per order: date, value, payment method, delivery outcome, courier attempts, reason code, address used, refund issued.
- Planted: 14 serial refusers (high refusal rate on cash on delivery), 9 serial returners (accept then return inside the window), 7 address hoppers (same phone, many addresses), 6 promo abusers (first-order discount across accounts), and 10 innocents with one bad streak caused by a wrong address or a courier outage.
- Labels: `{ customerId, pattern }`.

## State

The customer's order history as a compact table, the store's own baselines (average refusal rate, average return rate), the courier's outage days, and the delivery reason codes with their meanings. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `pattern` | choice | `SERIAL_REFUSER` · `SERIAL_RETURNER` · `ADDRESS_HOPPER` · `PROMO_ABUSER` · `NORMAL` |
| `intent` | choice | `DELIBERATE` · `CARELESS` · `CIRCUMSTANTIAL` |
| `restriction` | choice | `ALLOW` · `PREPAY_ONLY` · `BLOCK_COD` |
| `severity` | score 0–6 | None · Slight · Mild · Notable · Serious · Severe · Extreme |
| `courier_at_fault` | yes/no | – |

## Report

Pattern accuracy against labels, shipping cost avoided (refusals × average cost) against restricted customers' past good value, the ten customers with the worst records, and the innocents list with whether each kept its access.

## Files

Standard demo folder plus `scripts/generate/cod-abuse.js`.

## Acceptance

Template list, plus:

- [ ] The courier-outage week is in the data and the state, so the model can excuse it.
- [ ] Restriction decisions are graded separately from pattern accuracy.
- [ ] Money saved and money restricted are both shown; neither appears alone.

## Video beats

- A customer with 11 refusals out of 14 orders, restricted.
- The innocent with 3 refusals in one week, all from the outage, left alone.
- The address hopper caught only because of the shared phone number.

## Notes

This is the example that makes non-fintech e-commerce people care; give it a clear before-and-after on the cost line.
