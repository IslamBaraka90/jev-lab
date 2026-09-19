# Insider trading surveillance

The daily OHLCV prices in this demonstration are cached Yahoo Finance bars. Every employee, role,
access list, trade and calendar event is synthetic and fictional. This is an evaluation of structured
surveillance reasoning, not an allegation about any real person or issuer.

Jev receives all 60 cached sessions through the trade-date close, the complete fictional trade,
employee history, access scope, recent colleague context, nearby fictional event and blackout rules.
The ten bars after the trade are withheld from the state and revealed only after the answer.

## Recorded run

Recorded on 2026-09-19 with `jev-1.13.0`. The complete pass cached all 180 trades and all five typed
answers per trade (1,144,440 input tokens and 31,767 output tokens). The fixture audit found no
missing, extra or malformed records.

Jev opened all 9 planted suspicious trades, opened no innocent trade, and cleared all 8 scheduled
purchase lookalikes plus all 7 sector-move lookalikes. Disposition accuracy was 180/180. Pattern
accuracy was 164/180: both unusual-size cases and the first-time-instrument case were opened but
named `PRE_ANNOUNCEMENT`; one of four colleague-cluster cases was also named that way. Eleven benign
trades were called `PRE_ANNOUNCEMENT` and one was called `UNUSUAL_SIZE`, but all twelve still received
`NO_ACTION`. Blackout-rule accuracy was 179/180; `TRD-0130` was the sole miss.

The ten-session outcome moves shown after scoring come directly from the cached bars. They were not
available in any Jev state, and no answer was retried or edited after the audit.
