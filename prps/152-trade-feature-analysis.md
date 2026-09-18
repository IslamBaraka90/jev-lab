# 152 · Trade feature analysis

**Domain:** Trades · **Data:** cached-real prices + synthetic trades (seed 1152) · **View:** candles · **Items:** 300 trades · **Questions:** 5

## Value

Find which parts of a setup actually separate the winners from the losers, instead of guessing.

## Demo flow

1. Each trade is read at its entry bar only: context, entry quality, setup type.
2. The answers are stored, and the outcome is revealed afterwards.
3. The report splits every answer by winners and losers and ranks the gaps.
4. The biggest gap becomes the headline: the one read that mattered.

## Data

- **Cached-real:** candles for 12 symbols.
- **Synthetic:** 300 trades across four setup families (breakout, pullback, reversal, range fade), placed so that two features genuinely predict outcome (entry distance from the moving average, and whether the entry bar closed in the top third of its range) and three do not (day of week, round-number entry price, symbol).
- Labels: `{ tradeId, outcome, plantedEdgeFeature }`.

## State

The candles up to and including the entry bar, the setup type as the trader labelled it, the entry price and planned levels, and the instrument's recent range and volume. No outcome, no post-entry bars.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `setup_type` | choice | `BREAKOUT` · `PULLBACK` · `REVERSAL` · `RANGE_FADE` |
| `entry_quality` | score 0–6 | Terrible · Very poor · Poor · Fair · Good · Very good · Excellent |
| `context` | choice | `TREND` · `RANGE` · `POST_GAP` · `NEWS_DAY` |
| `extended_entry` | yes/no | Is the entry already far from where the move started? |
| `would_take_again` | yes/no | – |

## Report

Average answers for winners against losers, the same table the lab uses, with the gap sorted; win rate by entry-quality bucket; win rate by setup type; and a check of whether the model's "would take again" beats the base rate. The planted edge features are revealed at the end for comparison.

## Files

Standard demo folder plus `scripts/generate/trade-feature-analysis.js`.

## Acceptance

Template list, plus:

- [ ] Outcomes are never in the state, and the reveal happens only in the report.
- [ ] The planted edge features are shown after the model's ranking, not before.
- [ ] "Would take again" is compared with the actual base rate, with the difference stated.

## Video beats

- Entry quality 5 and 6 against 1 and 2, with the win rates beside them.
- The day-of-week feature showing no gap, as a control.
- The reveal: the two planted edges, next to what the model ranked first.

## Notes

This demo is the honest one about noise; if the model finds nothing, the report says so instead of dressing it up.
