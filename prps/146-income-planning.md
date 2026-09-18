# 146 · Income and cash planning

**Domain:** Portfolio · **Data:** synthetic (seed 1146) · **View:** curve (calendar) · **Items:** 40 accounts · **Questions:** 4

## Value

Check whether the income a portfolio produces actually lands when the money is needed.

## Demo flow

1. An account opens as a 12-month calendar: expected dividends and coupons against planned commitments.
2. The model grades coverage, names the tight month, and flags cash drag.
3. Accounts sort by the size of the worst gap.
4. The report shows coverage across the book and the accounts that need a change.

## Data

- `demos/income-planning/data.json` — 40 accounts with holdings that pay on real-world-shaped schedules (quarterly equity dividends, semi-annual coupons, monthly funds), plus commitments: school fees, a tax payment, a property instalment, regular withdrawals.
- Planted: 9 accounts with a genuine shortfall month, 6 with enough income but badly timed, 5 carrying heavy idle cash, and 20 that are fine.
- Labels: `{ accountId, issue, worstMonth }`.

## State

The income schedule by month, the commitment schedule by month, the cash balance, the account's rules about selling to raise cash, and the payment dates' reliability (declared versus estimated). No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `coverage` | score 0–6 | None · Severe shortfall · Shortfall · Tight · Adequate · Comfortable · Ample |
| `problem` | choice | `SHORTFALL` · `TIMING` · `CASH_DRAG` · `NONE` |
| `worst_month` | choice | `JAN` … `DEC` · `NONE` |
| `sell_needed` | yes/no | – |

## Report

Coverage accuracy, worst-month accuracy, cash drag identified, a stacked calendar chart of income against commitments for the selected account, and the accounts needing action.

## Files

Standard demo folder plus `scripts/generate/income-planning.js` and the `curve` calendar view.

## Acceptance

Template list, plus:

- [ ] Worst-month answers are graded exactly against the labels.
- [ ] Timing problems are distinguishable from shortfalls in the report, not merged.
- [ ] The calendar chart shows both series and the gap, with a text alternative.

## Video beats

- An account with enough annual income and an empty March, answered as a timing problem.
- The cash-drag account with six months of idle balance.
- The calendar chart with the gap shaded.

## Notes

Closes the portfolio block. Nothing here is advice; the page carries the standard research-only line.
