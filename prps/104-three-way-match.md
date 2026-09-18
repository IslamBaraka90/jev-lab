# 104 · Three-way match

**Domain:** Books · **Data:** synthetic (seed 1104) · **View:** table (three panes) · **Items:** 150 packets · **Questions:** 4

## Value

Catch the invoices that don't agree with the purchase order or the goods receipt, before payment runs.

## Demo flow

1. Each item is a packet: purchase order, goods receipt and invoice, side by side.
2. The model reads all three and names the mismatch, if any.
3. Payment holds appear in a queue with the money at risk.
4. The report totals what was held, what was released, and what the holds were worth.

## Data

- `demos/three-way-match/data.json` — 150 packets from 40 suppliers. Each packet: PO lines (item, quantity, unit price, currency, incoterm), receipt lines (quantity received, date, condition), invoice lines (quantity billed, unit price, tax, freight, total).
- Planted: 9 unit-price increases above tolerance, 7 over-billed quantities, 5 tax errors, 4 currency mismatches, 3 duplicate invoices for one receipt, 6 partial deliveries billed in full, and 8 within-tolerance differences that must not be flagged.
- Tolerances live in `context`: 2% on price, 1 unit on quantity, and they are part of the state.
- Labels: `{ packetId, mismatch, amountAtRisk }`.

## State

The three documents in full, the supplier's agreed tolerances and payment terms, and the last two packets from the same supplier. No label, no computed difference — the arithmetic is part of what is being tested.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `mismatch` | choice | `PRICE` · `QUANTITY` · `TAX` · `CURRENCY` · `DUPLICATE` · `PARTIAL_DELIVERY` · `NONE` |
| `within_tolerance` | yes/no | – |
| `overbilling_risk` | score 0–6 | None · Negligible · Low · Moderate · High · Severe · Certain |
| `hold_payment` | yes/no | – |

## Report

Holds and releases against labels, money at risk held versus missed, mismatch types as a distribution, supplier ranking by trouble, and the false-hold rate — the number that decides whether accounts payable would tolerate this.

## Files

Standard demo folder plus `scripts/generate/three-way-match.js`.

## Acceptance

Template list, plus:

- [ ] Within-tolerance packets are not flagged, and that count is reported separately.
- [ ] Money at risk is computed from the documents, and shown next to the model's own risk score.
- [ ] Duplicates are only detectable from the supplier history in the state, and `notes.md` says so.

## Video beats

- A 3% unit-price rise against a 2% tolerance, held.
- A 1.4% rise, released, and the false-hold counter staying at zero.
- The duplicate invoice caught through supplier history.

## Notes

Keep the three-pane view aligned line by line; misaligned panes make the demo unreadable on camera.
