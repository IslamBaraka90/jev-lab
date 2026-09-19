# Execution quality

Two hundred and sixty fills, each measured against the price its signal asked for, on **real bars with
real gaps**. The state carries the bars, the intended price, the fill, the order type, the session and
the size — and **no cost**. Working out what the fill cost is part of what is being asked.

## The data

`scripts/generate/execution-quality.js`, seed 1153. Forty fills went in on the open after the market
reopened past the level; thirty-five were sent two to five bars after the signal; thirty went in at the
open or the close; twenty-five were large orders; and a hundred and thirty are where a fill should be,
inside a basis point of the intended price. The planted costs separate cleanly: clean fills cost 0 to 9
basis points, spread fills 15 to 50, and gaps 42 to 630.

## What the recorded run found

260 answers, model `jev-1.13.0`, 514,955 input and 43,189 output tokens, about nine minutes.

- **Every one of the 130 clean fills was called clean.** Nothing was invented to fix.
- **The worst sixty-five fills by grade alone are all fills that really cost something.** The grade was
  given before any cost was worked out, and it sorts the file correctly — which is the practical use
  of this demo: rank the day's fills without computing anything.
- **Chase was caught 35 of 35, spread 29 of 30.** Those two are legible in the record: bars between
  signal and fill, and the session.
- **Gaps were caught 19 of 40 and size 4 of 25.** Most of the misses went to "chase".
- **The fix matched the cause only 37 times of 130.** The cause is the diagnosis and the fix is the
  part a desk acts on, and they came apart here more than anywhere else in this set.

## The size cause is not in the data, and that is my fault

A "size" fill here is $3m to $20m, which sounds large and is **0.02% to 1.1% of these instruments'
average daily volume**. Nothing in the record says this order was big enough to move anything, because
against NVDA or SPY it was not. The label says size; the state cannot support it; the answers went to
chase instead, which is a reasonable reading of an order that filled late and badly.

Fixing it needs a thinner instrument in the cache — the same gap that weakened the liquidity cases in
the portfolio demos. Until then the honest read of this run is: chase and spread are found reliably,
gaps about half the time, the clean majority is left alone, and the grade ranks the file better than
the cause names it.
