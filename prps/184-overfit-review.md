# 184 · Overfit review

**Domain:** Strategy · **Data:** synthetic backtests (seed 1184) · **View:** curve · **Items:** 140 backtests · **Questions:** 5

## Value

Look at a backtest report the way a sceptic would, and say how much of it to believe.

## Demo flow

1. A backtest opens: equity curve, parameter set, trade count, and the parameter sensitivity grid.
2. The model grades overfitting risk, names the symptom, and says how much trust the result deserves.
3. Backtests sort by risk, with the worst curves first.
4. The report grades the calls against how each backtest was generated.

## Data

- `demos/overfit-review/data.json` — 140 synthetic backtest reports. Planted kinds: 22 parameter-cliff results (great at one setting, awful one step away), 18 with too few trades, 14 with look-ahead built in (entries at the same bar's close as the signal), 11 survivorship-flattered, 9 with costs omitted, and 66 honest ones with modest curves.
- Each report includes the equity curve points, the parameter grid with neighbouring results, trade count, cost assumptions, the universe, and the date range.
- Labels: `{ backtestId, kind }`.

## State

The curve, the parameter grid, the trade count and distribution, the cost assumptions as stated, the universe description, and the period. No label, no verdict.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `overfit_risk` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `symptom` | choice | `PARAMETER_CLIFF` · `FEW_TRADES` · `LOOK_AHEAD` · `SURVIVORSHIP` · `COSTS_OMITTED` · `NONE` |
| `trust` | score 0–6 | None · Very little · Little · Some · Fair · High · Full |
| `worth_forward_testing` | yes/no | – |
| `curve_too_smooth` | yes/no | – |

## Report

Symptom accuracy, trust against the planted kind, the honest backtests and how many were wrongly doubted, and a gallery of curves sorted by the model's trust score — which should look obviously right at a glance.

## Files

Standard demo folder plus `scripts/generate/overfit-review.js`.

## Acceptance

Template list, plus:

- [ ] The parameter grid is in the state, because the cliff is invisible without it.
- [ ] Honest backtests are reported as a false-doubt rate.
- [ ] The gallery sorts by the model's trust score, so the video can show it unedited.

## Video beats

- A perfect curve graded 1 of 6 on trust, with the neighbouring parameters that collapse.
- A modest curve graded 5 of 6.
- The gallery, sorted, with no commentary needed.

## Notes

This is the most opinionated demo in the set, and the one most likely to be quoted. Keep the rubric wording tight.
