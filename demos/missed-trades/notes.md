# Missed trades

- Cached-real daily candles from Yahoo Finance, fixed in the repository; synthetic trade log seed `1156`.
- The displayed shared rule selects the twenty closest qualifying moving-average pullbacks per symbol across the three-year window: 240 setups across twelve symbols.
- Jev receives all 35 candles through the setup bar, every rule condition, account risk, recent results, calendar state and whether the trade log contains an entry. It never receives a later price.
- Ten-session real outcomes live only in labels and are revealed by the report.
- Thirty good-reason skips are split across known next-day earnings, fully used risk limits and material gaps requiring a clearer written exception.

## Recorded run

- Model: `jev-1.13.0`; all 240 setups cached on 2026-09-19.
- Usage: 677,827 input tokens and 37,005 output tokens.
- Jev confirmed mechanical qualification on 240/240 and named all 110 recorded entries `NOT_SKIPPED`.
- It honoured 21/30 good-reason skips; the report exposes the other nine disagreements.
- The real ten-session bars produce $23,260 of positive opportunity cost across 100 avoidable misses and a $5,432 net outcome across 110 taken setups.
