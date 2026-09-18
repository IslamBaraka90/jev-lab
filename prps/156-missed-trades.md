# 156 · Missed trades

**Domain:** Trades · **Data:** cached-real prices (seed 1156 for the taken-trade log) · **View:** candles · **Items:** 240 qualifying setups · **Questions:** 5

## Value

Audit the setups that met the rules and were never taken, and count what the hesitation cost.

## Demo flow

1. Every bar that met the written rules is listed; the ones actually traded are marked.
2. For each untaken setup, the model judges whether it truly qualified and why it might have been skipped.
3. Setups sort by what the market did next.
4. The report totals the cost of misses against the cost of the trades that were taken.

## Data

- **Cached-real:** candles for 12 symbols over three years; the qualifying setups are found by a rule the demo ships (moving-average pullback with a range filter), so they are reproducible from the data.
- **Synthetic:** the trade log saying which setups were taken, built so that misses cluster after losses and on Mondays, with 30 genuinely skipped for good reasons (earnings the next day, a gap that broke the rule's spirit, size limits already used).
- Labels: `{ setupId, taken, goodReasonToSkip }`.

## State

The candles up to the setup bar, the rule's conditions with which ones passed, the account's state at the time (open risk, trades today, recent results), and the calendar (earnings, holidays). No future bars.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `qualified` | yes/no | Did this setup really meet the rules? |
| `skip_reason` | choice | `RISK_LIMIT` · `RECENT_LOSSES` · `CALENDAR_EVENT` · `ATTENTION` · `RULE_AMBIGUITY` · `NOT_SKIPPED` |
| `setup_quality` | score 0–6 | Poor · Weak · Below average · Average · Good · Very good · Excellent |
| `should_have_been_taken` | yes/no | – |
| `rule_needs_clarifying` | yes/no | – |

## Report

Cost of misses computed from the real bars after each setup, misses by weekday and by recent-result state, the good-reason skips honoured, the rules the model thinks are ambiguous, and taken-versus-missed outcomes side by side.

## Files

Standard demo folder plus `scripts/generate/missed-trades.js` and a shared rule module the demo shows in the code panel.

## Acceptance

Template list, plus:

- [ ] The qualifying rule is a single readable function, shown in How it works.
- [ ] Post-setup bars are used only in the report, never in the state.
- [ ] Good-reason skips are excluded from the cost total and reported separately.

## Video beats

- A Monday cluster of misses after a losing Friday.
- A skip before earnings, honoured as a good reason.
- The total: what the missed setups did next, against what the taken ones did.

## Notes

Closes the trades block. The rule module is the cleanest "here is the code" moment in the whole series; keep it under 30 lines.
