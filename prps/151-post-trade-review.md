# 151 · Post-trade lesson review

**Domain:** Trades · **Data:** cached-real prices + synthetic trades (seed 1151) · **View:** candles · **Items:** 220 closed trades · **Questions:** 6

## Value

Take a closed trade apart: was there a plan, was the target set, was the stop honoured, and what should be learned.

## Demo flow

1. A closed trade is drawn on the real chart: entry, exit, stop and target levels, and the bars in between.
2. The model reviews the anatomy of the trade and names the lesson.
3. Trades sort by discipline score, worst first.
4. The report ranks the repeating mistakes across the whole history.

## Data

- **Cached-real:** daily candles from `data/market/candles` for 12 symbols, so every price, gap and wick is genuine.
- **Synthetic:** 220 trades placed on that history by a generator that writes plans on purpose — some complete, some missing a stop, some with a target that was never reachable in the horizon, some where the stop was moved after entry, some closed early for no reason.
- Each trade: symbol, direction, entry date and price, planned stop and target, actual exit date, price and reason, size, and any stop moves with timestamps.
- Labels: `{ tradeId, lesson, planComplete }`.

## State

The trade's plan and fills, the candles from 90 bars before entry to the exit bar, the stop and target as levels, the stop-move log, and the instrument's average range. Bars after the exit are not included.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `plan_complete` | yes/no | Were direction, stop, target and holding period all set before entry? |
| `target_realistic` | yes/no | Was the target reachable within the planned horizon, given the instrument's range? |
| `stop_honoured` | yes/no | – |
| `exit_discipline` | score 0–6 | Abandoned · Very poor · Poor · Acceptable · Good · Very good · Textbook |
| `lesson` | choice | `NO_STOP` · `TARGET_TOO_FAR` · `EXITED_EARLY` · `MOVED_STOP` · `CHASED_ENTRY` · `PLAN_FOLLOWED` |
| `repeatable_setup` | yes/no | Would this setup be worth taking again? |

## Report

Lesson distribution against labels, discipline score against outcome, the share of trades with a complete plan, stop-move frequency, the ten worst-discipline trades, and a "if the stop had been honoured" figure computed from the real bars.

## Files

Standard demo folder plus `scripts/generate/post-trade-review.js`; reuses the lab's candle chart and trade overlay.

## Acceptance

Template list, plus:

- [ ] Post-exit bars never enter the state; a contract test asserts it.
- [ ] The "if the stop had been honoured" number is computed from real candles and shown as a counterfactual, clearly labelled.
- [ ] Discipline score is charted against actual return, so the video can say whether discipline paid.

## Video beats

- A trade with no stop that ran for eight bars, and the counterfactual number beside it.
- A moved stop, shown as two dashed levels on the chart.
- The repeating-mistake ranking across 220 trades.

## Notes

This is the demo that grew out of the full-suite video, so it should feel familiar and go deeper. Link it to the lab run in the header.
