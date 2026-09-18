# 162 · Fundamental read

**Domain:** Screening · **Data:** cached-real fundamentals · **View:** table (statements) · **Items:** 16 symbols × 4 years · **Questions:** 6

## Value

Read a company's statements the way an analyst would, and get a graded view of quality, leverage and direction.

## Demo flow

1. A symbol opens with four years of statements side by side, changes highlighted.
2. The model grades quality, leverage and earnings quality, and calls the direction of travel.
3. Symbols sort by quality, and the selected one shows the lines that drove the grade.
4. The report puts all 16 on one grid, and compares the model's grades with simple computed ratios.

## Data

- **Cached-real:** four years of annual statements per symbol, plus eight quarters where available: revenue, gross and operating margin, net income, operating cash flow, capital expenditure, total debt, cash and short-term investments, receivables, inventory, shares outstanding, dividends paid.
- **Computed by the demo, not the model:** debt to equity, net debt to EBITDA proxy, cash conversion, margin trend. These are shown beside the answers as a cross-check.
- No outcome labels; the check is agreement with the computed ratios and internal consistency across the four years.

## State

The statements as given, with units and currency, the fiscal year ends, and the sector. No computed ratios, so the model does the reading itself.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `quality` | score 0–6 | Very poor · Poor · Below average · Average · Good · Very good · Excellent |
| `leverage_risk` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Severe |
| `earnings_quality` | choice | `CASH_BACKED` · `MIXED` · `ACCRUAL_HEAVY` |
| `direction` | choice | `IMPROVING` · `STABLE` · `DETERIORATING` |
| `capex_discipline` | yes/no | – |
| `statement_gap` | choice | `NONE` · `MISSING_CASH_FLOW` · `MISSING_BALANCE_SHEET` · `SHORT_HISTORY` |

## Report

A grid of all 16 symbols by quality and leverage, agreement between `earnings_quality` and computed cash conversion, direction against the four-year revenue and margin trend, and a list of statement gaps in the cached data.

## Files

Standard demo folder plus `src/services/ratios.js` for the computed cross-checks.

## Acceptance

Template list, plus:

- [ ] Computed ratios live in one small module, shown in How it works, and are never sent in the state.
- [ ] Where the model and the ratio disagree, the report shows both and marks the disagreement.
- [ ] Missing statements are reported through `statement_gap`, not by silently dropping the symbol.

## Video beats

- A company with rising net income and falling operating cash flow, answered as accrual-heavy.
- The grid: quality against leverage, all 16 symbols.
- One disagreement between the model and the computed ratio, examined.

## Notes

Feeds 163, 164 and 166, which reuse the same cached statements. Build the loader once here.
