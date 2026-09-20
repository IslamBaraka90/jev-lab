# Strategy correlation

Sixty pairs from a book of twelve invented strategies, three years of daily results each. 240
answers, 441,428 tokens in and 8,776 out on `jev-1.13.0`.

No correlation, covariance or summary statistic is in the state. Both daily series are, in full —
756 numbers each — and reading them is the task. The demo computes every correlation itself and the
report puts its number beside the answer, which is the only way to tell whether a pair was judged on
its results or on its description.

## The recorded run

| | |
|---|---|
| Overlap graded, correlated against uncorrelated | 2.2 points apart |
| Correlated pairs called out (0.6+, graded 4 of 6+) | 2 of 8 |
| Uncorrelated pairs accused (under 0.2) | 0 of 47 |
| Stress-only pairs caught | **0 of 3** |
| Different instruments hiding a high correlation | 5 of 5 missed |
| Effective number of bets | **3.92 of 12** |

## Sure when it speaks, and it rarely speaks

The coverage curve is the clearest thing on the page. Of the seven pairs graded three of six or
higher on overlap, **seven correlate above 0.6**. Of the two graded four or higher, both do. There
is not one false alarm in forty-seven uncorrelated pairs.

The cost of that is recall. Only two of the eight genuinely correlated pairs cleared the four-of-six
bar the KPI uses, and only seven cleared three. Six pairs that really are the same bet were graded
below moderate overlap and would have stayed in the book.

The bar is stated on the page as four of six because that is "high" on the scale. At three of six —
"moderate" — the recall is seven of eight with precision still at a hundred per cent. Both readings
are visible in the curve, and which one to use is a decision about how much redundancy a book can
carry, not something this page should settle.

## The stress pairs were all missed, and that is the demo

Three pairs sit at essentially zero correlation for three years and then move hard together in one
forty-session window:

| Pair | Calm | Under stress |
|---|---|---|
| S07 / S10 — short volatility and sector pairs | 0.005 | 0.517 |
| S07 / S12 — short volatility and index-rebalance flow | −0.012 | 0.809 |
| S08 / S11 — credit spread and seasonal energy | 0.003 | 0.715 |

All three were read as diversifying. Whole-period correlation would have hidden them too — the
overall figures are 0.19 to 0.32, which is exactly why they are in the file. Finding them means
noticing that two flat series move together for forty days in the middle, and that did not happen.

These are the pairs a book finds out about on the worst day it has, and the demo exists to show that
the reading which catches everything else does not catch these.

## Different instruments hid the correlation

Seven pairs correlate above 0.7. Two trade the same instruments and were both graded four of six or
higher. Five trade different instruments — index futures against large-cap equities, government bonds
against currencies. **All five were graded below four of six on overlap.** Two strategies described in different words, trading different books, with a 0.8
correlation between their results, read as largely separate things.

That is the single most useful line in this demo, and it is the closing argument for the whole set:
where the description and the data disagree, the description won.

## The book is smaller than it looks

Twelve strategies, an effective number of bets of **3.92**. The figure is twelve squared over the sum
of every correlation in the book including each strategy with itself — twelve uncorrelated strategies
would give twelve, twelve identical ones would give one. Nearly seventy per cent of the apparent
diversification is not there, and that is before the stress window, where it gets worse.

## Caveats

- The correlations are computed with equal weights across a book of twelve. A real book is not
  equally weighted and the effective-bets figure moves a great deal with the weights.
- The stress window is one forty-session block in a three-year file. One crisis is one observation.
- Results are invented, so the correlations are the ones the generator built in. What is being tested
  is whether they can be read off two series, not whether these particular relationships occur.
- Forty of the sixty pairs were answered "reduce". A recommendation given to two thirds of a book is
  closer to a default than to advice, and the allocation question should be read with that in mind.
