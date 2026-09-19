# Screening for a goal

Sixteen real companies and funds read against six goals written the way somebody actually describes what
they want: ninety-six judgements. **Everything about the companies is real** — four years of statements
and six years of prices, cached once and committed. The goals are the only invented thing.

**There are no labels.** Nobody can label the right answer to "does this suit what I want", and this
demo does not pretend otherwise. What the report grades is consistency:

1. does the same company get read differently as the brief changes;
2. is every disqualifier supported by a number in that company's own file;
3. are the instruments with no statements admitted as unreadable.

## What the recorded run found

96 answers, model `jev-1.13.0`, 155,522 input and 14,200 output tokens, about three minutes.

This is the second recording. The first was made against the wrong fiscal year for five of the sixteen
companies: the cached `annual` arrays were not in year order, because the fetcher sorted `Date` objects
as strings, so a January filer's newest year was not first. The fix is in
`scripts/generate/lib/market.js`, the data was regenerated and the whole run re-recorded. The findings
below barely moved, which is worth saying plainly — but the numbers on the page are now the ones the
companies actually filed.

- **All sixteen companies were read differently by goal.** Fit scores move by more than a point and a
  half across the six briefs — the brief is doing work, which is the whole premise.
- **All twenty-four readings of instruments with no statements said the data was not sufficient.** GLD,
  SPY, XLE and BTC-USD have prices and no revenue, margins or cash flow, and not one reading pretended
  otherwise. That is the single most reassuring number in this run.
- **Thirty-seven of ninety-six readings were shortlisted**, across fourteen different companies.
- **Evidence was claimed at 2.7 of 6 on average** — modest, which fits a file with four years of
  statements and no analyst coverage in it.
- **Just under seven in ten disqualifiers are supported by the numbers** (66 of 96). The rest are almost all "volatility"
  against my own threshold of 25% annualised.

## The caveat on that last number

The support test is mine, not the world's: I decided that "volatility" needs annualised volatility over
25%, "leverage" needs debt above 30% of assets, and so on. A 21%-volatility stock ruled out for money
somebody cannot afford to lose is a perfectly good call that my threshold marks unsupported. Read that
KPI as "how often the stated reason clears a deliberately strict bar", not as an error rate.
