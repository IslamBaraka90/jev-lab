# 183 · Regime classification

**Domain:** Strategy · **Data:** cached-real prices · **View:** candles + curve · **Items:** 520 weeks · **Questions:** 5

## Value

Decide what kind of market this is, then let that decide which strategy is allowed to trade.

## Demo flow

1. Each item is one week of one instrument, drawn with the weeks before it.
2. The model names the regime and says which strategy family fits.
3. The regime timeline fills in under the chart, colour-coded.
4. The report re-runs two shipped strategies with the model's gate applied, against running them always.

## Data

- **Cached-real:** ten years of daily candles for four instruments, grouped into weeks: about 520 items.
- **Strategies:** the pullback and range-break modules from 182, plus the golden cross from 181.
- No labels; the comparison is the strategies' own results on the same real bars, with and without the gate.

## State

The last 60 bars, weekly summaries for the last year (range, direction, gap count), the instrument's long-run volatility, and the current week's bars. No forward data.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `regime` | choice | `TREND_UP` · `TREND_DOWN` · `RANGE` · `HIGH_VOLATILITY` · `EVENT_DRIVEN` |
| `regime_clarity` | score 0–6 | Unclear · Very unclear · Unclear-ish · Mixed · Clear · Very clear · Unmistakable |
| `strategy_fit` | choice | `TREND_FOLLOWING` · `MEAN_REVERSION` · `BREAKOUT` · `STAY_OUT` |
| `risk_scaling` | choice | `NONE` · `HALF` · `NORMAL` · `INCREASED` |
| `regime_changing` | yes/no | Is the regime turning over right now? |

## Report

Strategy results with and without the gate, on the same bars and costs; the regime timeline against realised volatility and trend measures computed by the demo; how often the model called a change the week before one happened; and the share of weeks it said stay out.

## Files

Standard demo folder; reuses the strategy modules and the lab's equity curve.

## Acceptance

Template list, plus:

- [ ] Gated and ungated runs use identical entry rules, bars and costs; only the gate differs.
- [ ] The demo's own volatility and trend measures are shown beside the regime calls as a cross-check.
- [ ] Weeks where the gate says stay out are visible on the equity chart as flat sections.

## Video beats

- A high-volatility week where the gate turns everything off, and the drawdown that avoided.
- The regime timeline under the price chart.
- The two equity curves, gated and ungated.

## Notes

The gate can easily flatter itself by hindsight; make sure the state ends at the week being judged, and say that on camera.
