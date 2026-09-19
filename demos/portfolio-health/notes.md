# Portfolio health

Twenty-four books of holdings, each built to carry one problem or none. **The weights are invented; the
prices, returns, volatilities, volumes and correlations behind them are real**, cached once from Yahoo
Finance and committed. Nothing is fetched at build time or in the browser, and none of it is advice.

## The data

`scripts/generate/portfolio-health.js`, seed 1141, over sixteen real instruments. Every portfolio's
weights are built from the plan its client agreed, so only the portfolios meant to have drifted have
drifted — the earlier version of this generator put random weights against random objectives and every
portfolio looked like drift, which would have made the whole demo meaningless.

| Planted | Books | How it shows in the numbers |
|---|---:|---|
| Concentration | 5 | One name at 39–48%, against 25% or less everywhere else |
| Correlation | 4 | Three holdings from one group, most-correlated pair above 0.7 |
| Liquidity | 3 | A position worth 0.5–0.8 of a day of its own average volume |
| Currency | 4 | The client earns and spends in GBP, EUR or AED and holds nothing in it |
| Drift | 3 | Equity 29–30 points away from the agreed allocation |
| Healthy | 5 | At plan, spread, liquid, in the client's own currency |

## What the recorded run found

24 answers, model `jev-1.13.0`, 46,059 input and 4,385 output tokens, about a minute.

- **Sixteen of nineteen problems named exactly**, from six options: concentration 5 of 5, correlation 4
  of 4, currency 4 of 4, drift 3 of 3.
- **All four "diversified in name only" portfolios were spotted** — the yes/no that asks whether a long
  holdings list hides a short list of bets.
- **The three liquidity portfolios were read as something else** (concentration twice, drift once). On
  the numbers that is defensible and it is mostly my fault: a position worth 0.8 of a day's volume in a
  large ETF is not a liquidity problem to anybody. A real one is five or twenty days, and the generator
  cannot build that against instruments this liquid without making the portfolio absurd. The fix is a
  thinner instrument in the cache, not a better prompt.
- **Not one portfolio was left alone.** All five healthy books were given a problem, and all 24 got an
  action. The severity scores do separate — healthy books sit at 2.3 to 4.1 against 2.9 to 5.5 for the
  rest — but the choice question has no way to say "nothing worth raising" that the run ever used.

## The honest caveat

This demo makes a model choose the single biggest risk in a portfolio that has several, and then grades
it against one label. On four of the five kinds that works cleanly. On the fifth it does not, and the
run shows both: the problems it reads exactly, and the tendency to find *something* in a portfolio
built to be dull. A version worth re-recording would add a thinly traded instrument to the cache and ask
for the risks present rather than the risk that is biggest.
