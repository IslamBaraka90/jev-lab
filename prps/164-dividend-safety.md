# 164 · Dividend safety

**Domain:** Screening · **Data:** cached-real fundamentals and prices · **View:** table · **Items:** 16 symbols · **Questions:** 5

## Value

Judge whether a payout survives a bad year, and name what would break it first.

## Demo flow

1. A symbol opens with its dividend history, payout ratios and the cash flow behind them.
2. The model grades safety, names the first thing to break, and estimates cut risk.
3. Symbols sort by safety, with yield shown beside it so the trade-off is visible.
4. The report plots safety against yield and marks the names where high yield comes with low safety.

## Data

- **Cached-real:** four years of dividends paid, net income, operating cash flow, capital expenditure, total debt and cash, plus the price history for yield.
- **Computed by the demo:** payout ratio on earnings and on free cash flow, dividend growth, and yield. Shown as a cross-check, not sent in the state.
- No outcome labels; where a cached history contains an actual cut, the report uses it as a natural test case and says so.

## State

The dividend history, the statement lines behind it, the debt maturity profile where available, the sector, and the share count trend. No computed ratio, no yield.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `safety` | score 0–6 | Unsustainable · Very weak · Weak · Adequate · Strong · Very strong · Fortress |
| `first_to_break` | choice | `EARNINGS_COVER` · `CASH_COVER` · `DEBT_MATURITIES` · `CYCLICALITY` · `SHARE_BUYBACKS` · `NONE` |
| `cut_risk_12m` | choice | `VERY_LOW` · `LOW` · `MODERATE` · `HIGH` · `VERY_HIGH` |
| `growth_sustainable` | yes/no | – |
| `payout_funded_by_debt` | yes/no | – |

## Report

Safety against computed cover ratios, yield against safety as a scatter, the historical cuts in the cached data with what the model said, and the names where payout appears debt-funded.

## Files

Standard demo folder; reuses `src/services/ratios.js`.

## Acceptance

Template list, plus:

- [ ] Any real dividend cut in the cached history is used as a test case and reported honestly, whichever way the answer went.
- [ ] Yield is computed by the demo and never asked of the model.
- [ ] The scatter has a table alternative.

## Video beats

- A high yield with a 1-of-6 safety score, and the cash-cover line that explains it.
- A fortress payout with modest yield, for contrast.
- The historical cut, and what the model said about the year before it.

## Notes

Real companies, real dividends, no advice. The research-only line stays visible on this page.
