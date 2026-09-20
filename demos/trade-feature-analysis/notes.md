# Trade feature analysis

Three hundred synthetic trades use cached-real candles through the entry bar only. Outcomes remain in
labels and are planted from two entry features; weekday, round-number price and symbol are stratified
negative controls.

## Recorded run

All 300 complete entry states were sent to `jev-1.13.0` on 2026-09-19: 741,568 input tokens and 47,004
output tokens. Each request carried 35 real candles through entry, the labelled setup, planned levels,
moving-average distance, bar close location, range, volume and gap. No outcome or post-entry bar was
sent.

After outcomes were revealed, Jev's “would take again” subset won 55.6% versus a 44.3% base rate, an
11.2-point lift on 54 picks; the 95% interval for that win rate runs from 42% to 68%, which includes
the base. Ranked by how well each answer separates winners from losers, its extended-entry call and its
entry quality lead, each about 0.1 away from the 0.5 of an answer that says nothing. The two planted
data edges measured 50 and 40 percentage points; the weekday, round-number and symbol controls measured
only 1, 6 and 4 points. The report shows the model-answer ranking before that
planted-edge reveal.
