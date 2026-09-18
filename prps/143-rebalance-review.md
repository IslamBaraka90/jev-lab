# 143 · Rebalance review

**Domain:** Portfolio · **Data:** synthetic proposals + cached-real prices (seed 1143) · **View:** queue · **Items:** 200 proposed trades · **Questions:** 5

## Value

Review a rebalancing proposal trade by trade, and let the approved ones fall out as an order list.

## Demo flow

1. A proposal opens: current weights, target weights, and the trades a rebalancer generated.
2. The model approves, resizes or rejects each trade and flags sequencing and tax problems.
3. Approved trades collect into an order list with sizes.
4. The report shows how much of the proposal survived, and what the rejections were about.

## Data

- **Cached-real:** prices and average volumes for sizing and liquidity checks.
- **Synthetic:** 12 rebalancing runs producing 200 trades. Planted problems: 14 trades above a sensible share of daily volume, 11 that trigger a wash-sale-style repurchase inside 30 days, 9 that cross the same name in both directions across accounts, 7 too small to be worth the cost, and 6 that undo a deliberate tactical overweight noted in the mandate.
- Labels: `{ tradeId, verdict, issue }`.

## State

The trade, the position before and after, the target and tolerance band, the instrument's liquidity, the recent trade history in that name, the account's tax lots summary, and the mandate notes. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `verdict` | choice | `APPROVE` · `RESIZE` · `DEFER` · `REJECT` |
| `size_band` | choice | `AS_PROPOSED` · `HALF` · `QUARTER` · `SPLIT_OVER_DAYS` |
| `issue` | choice | `LIQUIDITY` · `TAX_LOT` · `CROSSING` · `TOO_SMALL` · `MANDATE_CONFLICT` · `NONE` |
| `execution_risk` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Severe |
| `needs_pm_sign_off` | yes/no | – |

## Report

Verdicts against labels, issue accuracy, the share of proposal value approved, the order list as it would be sent, and turnover before and after the review.

## Files

Standard demo folder plus `scripts/generate/rebalance-review.js`.

## Acceptance

Template list, plus:

- [ ] Liquidity checks use cached real volumes and the page says so.
- [ ] The order list is built only from approved and resized trades.
- [ ] Mandate conflicts are only findable from the mandate notes in the state.

## Video beats

- A trade at 3 days of volume, resized to split over days.
- The repurchase inside 30 days, deferred.
- The order list shrinking from 200 trades to 163, with turnover down.

## Notes

This is the portfolio block's tool-call demo: the answers become an order list, but nothing is sent anywhere.
