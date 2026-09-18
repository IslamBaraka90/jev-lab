# 153 · Execution quality

**Domain:** Trades · **Data:** cached-real prices + synthetic fills (seed 1153) · **View:** candles · **Items:** 260 fills · **Questions:** 5

## Value

Measure the distance between the signal and the fill, and say what caused it.

## Demo flow

1. A fill opens on the chart with the signal bar, the intended price and the actual fill marked.
2. The model grades the fill and names the cause of the slippage.
3. Fills sort by cost, worst first.
4. The report totals slippage by cause, by hour and by instrument.

## Data

- **Cached-real:** candles with genuine gaps, wide-range days and quiet sessions.
- **Synthetic:** 260 fills with the signal bar, intended price, actual fill price, size, order type and timestamp. Planted causes: 40 gap fills (the price opened past the intended level), 35 chase fills (entered several bars after the signal), 25 size-driven fills on thin days, 30 spread-driven fills at the open or close, and 130 clean fills.
- Labels: `{ fillId, cause, costBps }`.

## State

The signal bar and the ten bars around it, the intended price, the fill price and time, the order type, the size against the instrument's average volume, and the session context (open, mid, close). No label, no cost calculation.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `fill_quality` | score 0–6 | Unacceptable · Very poor · Poor · Fair · Good · Very good · Perfect |
| `cause` | choice | `GAP` · `CHASE` · `SIZE` · `SPREAD` · `CLEAN` |
| `avoidable` | yes/no | – |
| `fix` | choice | `EARLIER_ORDER` · `LIMIT_ORDER` · `SMALLER_SIZE` · `AVOID_SESSION` · `NONE` |
| `worth_chasing` | yes/no | Given the setup, was entering late still justified? |

## Report

Cost in basis points by cause against labels, avoidable cost as a total, slippage by hour and by instrument, fill-quality distribution, and the fixes ranked by the money they would have saved.

## Files

Standard demo folder plus `scripts/generate/execution-quality.js`.

## Acceptance

Template list, plus:

- [ ] Cost in basis points is computed by the demo, never asked of the model, and shown beside the model's quality score.
- [ ] Gap fills are genuinely gaps in the cached price data.
- [ ] The fixes table sums to the avoidable cost total.

## Video beats

- A gap fill: the chart shows the intended level inside the gap.
- A chase fill four bars late, graded 2 of 6.
- The fixes table: "limit orders would have saved the most".

## Notes

Slippage is arithmetic; the model's job here is attribution. Keep that distinction loud in the walkthrough.
