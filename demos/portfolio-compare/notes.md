# Portfolio compare

Eighteen fictional portfolio pairs built from invented weights over the repository's committed market
cache. Every holding carries its cached price-derived 12-month return, volatility and drawdown plus its
cached sector and currency. The goal and its hard constraints are prominent above the aligned columns.

The file contains twelve ordinary decisive pairs, four deliberately close calls and two traps. In each
trap, the side with the stronger 12-month return breaches the low-drawdown goal and should lose.

## Recorded run

The final 18-item dataset was recorded in full with `jev-1.13.0` on 19 September 2026: 42,261 input
tokens and 3,485 output tokens, with no missing, extra or malformed records.

- All 18 preferred-side calls agreed with the labels.
- All four marginal comparisons were called `TOO_CLOSE`; no decisive pair was refused.
- Both return traps were avoided: the stronger recent return did not override the drawdown rule.
- Both explicit currency pairs were named as currency differences, so all six report dimensions now
  have a real cohort rather than an empty decorative row.
