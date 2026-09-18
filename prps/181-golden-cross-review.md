# 181 · Golden cross review

**Domain:** Strategy · **Data:** cached-real prices · **View:** candles · **Items:** 240 crosses · **Questions:** 5

## Value

Stop asking whether the strategy works. Ask whether *this* signal, on this chart, deserves the trade.

## Demo flow

1. Every 50-over-200 crossover in the cached history is listed, found by a rule the demo ships.
2. Each one opens on the chart at the cross bar, with the moving averages drawn.
3. The model judges validity, context and quality, and says take or skip.
4. The report compares taking every cross with taking only the ones the model kept.

## Data

- **Cached-real:** ten years of daily candles for the 16 manifest symbols; the crossover detector finds roughly 240 events, all reproducible from the data.
- **Synthetic:** nothing. The only thing added is the rule, which lives in a readable module.
- No labels; the ground truth is what the price did afterwards, computed in the report from the real bars.

## State

The candles up to and including the cross bar, both moving averages, the distance between them, the slope of each, the distance from price to the slow average, recent range and volume, and the instrument's context. No future bars.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `valid_signal` | yes/no | Is this a real trend change rather than an artefact of a flat market? |
| `context` | choice | `ESTABLISHED_TREND` · `CHOP` · `POST_GAP` · `RANGE_BREAK` · `REVERSAL_RISK` |
| `signal_quality` | score 0–6 | Worthless · Very poor · Poor · Fair · Good · Very good · Excellent |
| `decision` | choice | `TAKE` · `SKIP` |
| `stop_placement` | choice | `BELOW_SLOW_MA` · `BELOW_SWING_LOW` · `ATR_BASED` · `NONE` |

## Report

Every cross scored over the next 20 bars from real data: take-everything against take-the-kept-ones, hit rate by quality bucket, context distribution, and the equity curve of both approaches.

## Files

Standard demo folder plus `src/strategies/golden-cross.js` (detector and levels), reused by 182 and 183.

## Acceptance

Template list, plus:

- [ ] The detector is a single readable function and is the code the page shows first.
- [ ] No post-cross bars appear in the state; the forward window is report-only.
- [ ] The two equity curves are drawn from the same bars, with costs applied identically.

## Video beats

- A cross in a flat market, judged an artefact and skipped.
- A cross after a range break, taken, with the stop placement answered.
- The two equity curves: every cross against the kept ones.

## Notes

This is the demo people asked for by name. Keep the arithmetic visible, and let the model's job be judgement.
