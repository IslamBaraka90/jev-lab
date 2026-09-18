# 182 · Setup timing

**Domain:** Strategy · **Data:** cached-real prices · **View:** table (grid) · **Items:** 480 setup instances · **Questions:** 5

## Value

For one setup on one instrument, find when it works: which weekday, which part of the month, and whether long and short differ.

## Demo flow

1. Pick a setup and an instrument; every instance in the history is listed with its calendar slot.
2. The model judges each instance in its own context, and says whether the timing helps or hurts.
3. A grid fills in: weekday against month-phase, coloured by what the model expected.
4. The report puts the model's expectation next to what actually happened in the real bars.

## Data

- **Cached-real:** daily candles for four instruments with different characters: a high-beta stock, a bank, an ETF and Bitcoin, which trades every day and so has a different weekday profile.
- **Setups:** two, shipped as readable modules — a moving-average pullback and a range break — detected over ten years, giving about 480 instances.
- No labels; the truth is the forward return in the real bars, used only in the report.

## Note on timeframe

The cached data is daily, so "time of day" is out of scope and the page says so. The grid is weekday, month-phase (start, middle, end) and days since the last earnings-shaped gap. If intraday data is added later, it is a new PRP.

## State

The candles up to the setup bar, the setup's own conditions, the calendar slot (weekday, month phase, days since the last large gap), the instrument's typical behaviour in that slot, and the direction being considered. No forward bars.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `timing_favourable` | yes/no | – |
| `best_slot` | choice | `MONDAY` · `MIDWEEK` · `FRIDAY` · `MONTH_START` · `MONTH_END` · `NO_PREFERENCE` |
| `direction_bias` | choice | `LONG` · `SHORT` · `EITHER` · `NEITHER` |
| `expected_hold` | choice | `ONE_BAR` · `TWO_TO_THREE` · `FOUR_TO_FIVE` · `SIX_TO_EIGHT` |
| `setup_quality` | score 0–6 | Worthless · Very poor · Poor · Fair · Good · Very good · Excellent |

## Report

The grid of expectation against realised return, per instrument and per direction; hold length answered against the bar count that actually captured the move; and a plain statement of where the sample is too small to say anything, which is most of the grid.

## Files

Standard demo folder plus `src/strategies/{pullback,range-break}.js`.

## Acceptance

Template list, plus:

- [ ] Cells with fewer than 20 instances are marked as insufficient and excluded from claims.
- [ ] Long and short are reported separately everywhere.
- [ ] The page states that daily data means no intraday timing.

## Video beats

- The Bitcoin weekday profile, which exists because it trades on weekends.
- A grid cell with four instances, greyed out and labelled insufficient.
- Expectation against reality for the one slot that has enough data.

## Notes

The honest finding here may be "not much signal". Design the report so that reads as a result, not a failure.
