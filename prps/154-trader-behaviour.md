# 154 · Trader behaviour

**Domain:** Trades · **Data:** synthetic (seed 1154) · **View:** curve (equity and sessions) · **Items:** 120 trading days · **Questions:** 5

## Value

Look at a trading day, not a trade, and name the habit that is costing money.

## Demo flow

1. A day opens: every trade in sequence, sizes, results, and the equity line through the session.
2. The model reads the day and names the pattern.
3. Days sort by damage, and the equity curve marks the worst ones.
4. The report totals the cost of each habit across six months.

## Data

- `demos/trader-behaviour/data.json` — 120 days for one fictional trader, 2 to 14 trades a day. Planted: 11 revenge-trading days (size doubles after a loss, within minutes), 9 overtrading days (three times the usual count, falling average result), 7 early-exit days (winners cut inside half the usual hold), 6 averaging-down days, and the rest ordinary, including 8 good days that happen to have a big loss.
- Labels: `{ date, pattern, costEstimate }`.

## State

The day's trades in order with timestamps, sizes, results and holding times, the trader's 30-day norms for each of those, and the previous day's result. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `pattern` | choice | `REVENGE` · `OVERTRADING` · `EARLY_EXIT` · `AVERAGING_DOWN` · `DISCIPLINED` |
| `severity` | score 0–6 | None · Slight · Mild · Notable · Serious · Severe · Extreme |
| `triggered_by_loss` | yes/no | – |
| `size_discipline` | yes/no | Did sizing stay inside the trader's norms? |
| `stop_trading_advised` | yes/no | – |

## Report

Pattern accuracy, estimated cost per habit over the period, the equity curve with flagged days marked, size against norm as a scatter, and the eight good-but-lossy days with whether they were wrongly flagged.

## Files

Standard demo folder plus `scripts/generate/trader-behaviour.js`.

## Acceptance

Template list, plus:

- [ ] Norms are computed in the generator and included in the state, so judgement is relative, not absolute.
- [ ] The good-but-lossy days are reported as a false-alarm rate.
- [ ] Cost estimates come from the trades, not from the model.

## Video beats

- A revenge day: loss at 10:14, triple size at 10:19.
- A losing day that is graded disciplined, with the reason.
- The six-month cost of each habit, as one bar chart.

## Notes

This one is about a person, so keep the tone in the copy neutral and practical, not judgemental.
