# 116 · Delivery exceptions

**Domain:** Orders · **Data:** synthetic (seed 1116) · **View:** queue · **Items:** 250 shipments · **Questions:** 4

## Value

Work out who caused a failed delivery, and what to do with the parcel next.

## Demo flow

1. A failed shipment opens with its tracking history, address, courier notes and customer contact attempts.
2. The model assigns fault, grades the address, and picks the next move.
3. Shipments sort into retry, reroute, hold for pickup and cancel.
4. The report totals avoidable cost and lists the addresses and couriers that keep failing.

## Data

- `demos/delivery-exceptions/data.json` — 250 failed or delayed shipments. Each: tracking events with timestamps and scan locations, address text with quality problems (missing floor, ambiguous district, wrong postcode), phone contact attempts, courier notes, previous deliveries to the same address, weather or outage context.
- Planted: 38 address-quality failures, 22 customer-unavailable cases, 19 courier-side failures (misrouted, never attempted despite the scan), 11 refusals that are really COD abuse, and 14 where the cause is genuinely unclear.
- Labels: `{ shipmentId, fault, bestAction, addressQuality, preventable, kind, avoidableCost, neverAttemptedScan }`.

## State

The tracking history, the address with its components, the contact log, the courier's service-level notes, and the same address's delivery history. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `fault` | choice | `ADDRESS_QUALITY` · `CUSTOMER_UNAVAILABLE` · `COURIER` · `CUSTOMER_REFUSAL` · `UNCLEAR` |
| `address_quality` | score 0–6 | Unusable · Very poor · Poor · Workable · Good · Very good · Precise |
| `next_action` | choice | `RETRY` · `REROUTE_PICKUP` · `CONTACT_CUSTOMER` · `RETURN_TO_SENDER` |
| `preventable` | yes/no | Could a better address or a contact rule have prevented this? |

## Report

Fault split against labels, avoidable cost (failed attempts × cost per attempt), courier ranking by unexplained failures, the worst addresses, and the share of cases where the model said unclear — which should be close to the planted 14.

## Files

Standard demo folder plus `scripts/generate/delivery-exceptions.js`.

## Acceptance

Template list, plus:

- [x] The "never attempted despite the scan" cases are detectable from timestamps alone.
- [x] The unclear share is reported, not hidden, and compared with the planted count.
- [x] Avoidable cost uses a cost-per-attempt value that is visible in the state.

## Video beats

- A parcel scanned as attempted at 03:10, with the courier blamed.
- An address missing a floor number, graded 2 of 6, rerouted to a pickup point.
- The courier league table.

## Notes

This closes the orders block and hands over to fraud; the COD refusals here are the same customers as 112, so the two demos can be shown back to back.

Implemented and recorded on 2026-09-19 with `jev-1.13.0`: 250 of 250 shipment responses cached,
100% fault accuracy, and 46.8% next-action accuracy. The exact policy disagreements are preserved in
`demos/delivery-exceptions/notes.md`.
