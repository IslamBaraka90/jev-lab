# 185 · Strategy correlation

**Domain:** Strategy · **Data:** synthetic backtests (seed 1185) · **View:** curve (stacked) · **Items:** 60 strategy pairs · **Questions:** 4

## Value

Find out whether a book of five strategies is really five bets or one bet wearing five names.

## Demo flow

1. A pair of strategies opens with their daily results side by side and their rules summarised.
2. The model judges overlap, says whether the pair diversifies, and proposes an allocation change.
3. Pairs collect into a matrix across the book.
4. The report compares the judgements with the computed correlations and shows the book's real concentration.

## Data

- `demos/strategy-correlation/data.json` — 12 synthetic strategies with daily results over three years, arranged into 60 pairs. Planted: 4 pairs that are the same strategy with different parameters, 5 that trade different instruments but the same factor, 6 genuinely independent, and 3 that look unrelated until a stress window where they move together.
- Each strategy: rule summary, instruments, average hold, trade count, daily result series.
- Labels: `{ pairId, relation, stressCorrelation }`.

## State

Both strategies' rule summaries, instruments, hold lengths, trade counts and daily result series, plus the market context for the period. No computed correlation.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `overlap` | score 0–6 | Independent · Very low · Low · Moderate · High · Very high · Identical |
| `diversifying` | yes/no | – |
| `same_underlying_bet` | choice | `SAME_FACTOR` · `SAME_INSTRUMENT` · `SAME_TIMING` · `DIFFERENT` |
| `allocation_change` | choice | `INCREASE` · `KEEP` · `REDUCE` · `DROP_ONE` |

## Report

Overlap against computed correlation (the scatter that shows whether the model is reading the series or the words), the stress-window pairs and whether the model caught them, the book's effective number of bets, and the allocation changes as a proposed book.

## Files

Standard demo folder plus `scripts/generate/strategy-correlation.js`.

## Acceptance

Template list, plus:

- [ ] Correlations are computed by the demo and never sent in the state.
- [ ] The three stress-window pairs are reported separately; they are the point of the demo.
- [ ] The effective-number-of-bets figure is defined on the page in one sentence.

## Video beats

- Two strategies with different rules and a 0.86 correlation, answered as the same factor.
- The pair that decouples until the stress window.
- The book going from "five strategies" to "two and a half bets".

## Notes

Closes the strategy block and the series. It is also the natural closing argument of the long video: the model is reading data, not reading labels.
