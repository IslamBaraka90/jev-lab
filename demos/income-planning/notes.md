# Income and cash planning

Forty synthetic accounts are built from monthly fund distributions, quarterly equity dividends,
semi-annual coupons and dated commitments. The calendar keeps annual shortfall, timing-only gaps and
idle cash as three separate outcomes.

## Recorded run

The full 40-account file was sent to `jev-1.13.0` on 2026-09-19: 94,690 input tokens and 7,855 output
tokens. Every request carried the complete holding schedules and reliability, all twelve income and
commitment rows, projected cash, the sale rule, the cash-drag threshold and the interpretation policy.

Jev matched all 40 coverage bands, all 40 planted problems and all 40 exact worst-month labels. It
separated all nine annual shortfalls from all six timing-only gaps, found all five idle-cash accounts,
and left all twenty adequately buffered accounts alone. The implementation audit also fixes these
cohorts as arithmetic invariants so the labels cannot drift away from the visible calendar.
