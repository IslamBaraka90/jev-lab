# 171 · News impact

**Domain:** News · **Data:** synthetic headlines + cached-real prices (seed 1171) · **View:** candles · **Items:** 300 headlines · **Questions:** 5

## Value

Judge a headline against the chart it belongs to: does it matter, which way, over what horizon, and is it already priced.

## Demo flow

1. A headline appears with the symbol's chart up to that date.
2. The model grades materiality, direction, horizon and whether the market already knew.
3. Headlines sort by materiality, and the chart reveals what happened next once the answer is in.
4. The report compares the grades with the real moves that followed.

## Data

- **Cached-real:** candles for the 16 manifest symbols, so the "what happened next" is genuine.
- **Synthetic:** 300 headlines with bodies of two or three sentences, written for the demo and dated to real trading days: earnings beats and misses, guidance changes, contract wins, regulatory news, management changes, analyst moves, and routine noise.
- Planted: 40 material items placed before real large moves in the cached data, 40 material items placed before nothing much, and 220 routine items, so materiality and outcome are deliberately not the same thing.
- Labels: `{ headlineId, intendedMateriality, actualMovePct }`.

## State

The headline and body, the symbol, the date, the candles up to that date, and the last three headlines for the same symbol. No future bars, no outcome.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `materiality` | score 0–6 | None · Trivial · Minor · Notable · Material · Major · Transformative |
| `direction` | choice | `POSITIVE` · `NEGATIVE` · `MIXED` · `NEUTRAL` |
| `horizon` | choice | `SAME_DAY` · `DAYS` · `WEEKS` · `STRUCTURAL` |
| `already_priced` | yes/no | – |
| `tradeable_now` | yes/no | – |

## Report

Materiality against the actual move that followed (a calibration curve), direction accuracy against the sign of the move, horizon against when the move actually happened, and the "already priced" answers against pre-news drift in the cached bars.

## Files

Standard demo folder plus `scripts/generate/news-impact.js`; reuses the candle chart.

## Acceptance

Template list, plus:

- [ ] Headlines are original text written for the demo; no real article text is copied, and `notes.md` says so.
- [ ] Post-headline bars are excluded from the state and used only in the report.
- [ ] Materiality calibration is shown as a curve, not a single accuracy number.

## Video beats

- A guidance cut before a real 9% drop, graded major.
- An equally dramatic headline before nothing, graded major too — and what that teaches.
- The calibration curve: materiality against what actually happened.

## Notes

The point of this demo is that a good read and a good outcome are different things. Keep that in the copy, not just the chart.
