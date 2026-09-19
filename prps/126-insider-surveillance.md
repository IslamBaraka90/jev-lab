# 126 · Insider trading surveillance

**Domain:** Fraud · **Data:** synthetic trades + cached-real prices (seed 1126) · **View:** candles · **Items:** 180 employee trades · **Questions:** 5

## Value

Look at an employee's trade against what the market did next, and decide whether it deserves a case.

## Demo flow

1. Each item is one employee trade drawn on the real price chart, with the announcement window marked.
2. The model reads the trade, the employee's history and the event calendar, and grades suspicion.
3. Trades sort into no action, monitor and open a case.
4. The report shows cases opened against the planted ones, and the patterns behind them.

## Data

- **Cached-real:** daily candles from `data/market/candles` for the symbols used, so the price moves are genuine.
- **Synthetic:** 180 trades by 40 fictional employees, their roles and access levels, plus an event calendar of earnings and announcements aligned to real dates in the price history.
- Planted: 9 suspicious trades — first-time instrument bought three days before a gap up, unusual size against the employee's own history, a cluster of colleagues trading the same name, and an options-style leverage proxy. Plus 15 innocent lookalikes: a scheduled monthly purchase that happened to precede news, and a sector-wide move.
- Labels: `{ tradeId, suspicious: true|false, pattern }`.

## State

The trade, the employee's own trading history and access level, the instrument's candles up to and including the trade date, the event calendar entries within 30 days, and the firm's blackout rules. The bars after the trade are **not** in the state; they are only used in the report.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `suspicion` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `pattern` | choice | `PRE_ANNOUNCEMENT` · `UNUSUAL_SIZE` · `FIRST_TIME_INSTRUMENT` · `CLUSTERED_WITH_COLLEAGUES` · `ROUTINE` |
| `blackout_breach` | yes/no | – |
| `disposition` | choice | `NO_ACTION` · `MONITOR` · `OPEN_CASE` |
| `explained_by_history` | yes/no | – |

## Report

Cases opened against labels, the outcome window drawn on the chart (what the price did after each flagged trade), pattern distribution, blackout breaches, and the innocent lookalikes with their disposition.

## Files

Standard demo folder plus `scripts/generate/insider-surveillance.js`; reuses the lab's candle chart.

## Acceptance

Template list, plus:

- [x] No post-trade bars appear in any state; a contract test asserts it.
- [x] Employees, roles and the event calendar are fictional, and the page says which part is real (prices) and which is invented.
- [x] The chart marks the trade date, the announcement date and the outcome window distinctly.

## Video beats

- A buy three days before a gap up, with the announcement marker on the chart.
- The scheduled monthly purchase that sits in the same window and is cleared.
- The colleague cluster: four employees, one week, one instrument.

## Notes

Real prices with invented people is the pattern the whole trades block uses. Say it once here, clearly, and the later demos can move faster.

Implemented and recorded on 2026-09-19. Jev `jev-1.13.0` received every complete 60-session
pre-trade window plus the fictional trade, history, access, colleague, calendar and blackout context:
180/180 fixture records, five answers each, no missing or malformed entries. The audited replay
opened 9/9 planted cases, opened 0/171 benign trades, cleared all 15 lookalikes, named the planted
pattern on 164/180 trades, and made 179/180 blackout calls correctly. See the demo notes for the
immutable disagreements.
