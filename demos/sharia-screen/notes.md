# Sharia screening, three rule sets

Sixteen real instruments run against three named rule sets: forty-eight screenings, 288 answers,
47,161 tokens in and 8,581 out on `jev-1.13.0`.

## What is real and what is not

The companies, the balance sheets, the share counts and the prices are real, cached once from Yahoo
Finance and committed. The business descriptions are written here in plain words from what each
company actually does.

**The rule sets are not.** They were written for this demo from published screening standards,
simplified down to four limits and a denominator each, and they are not any standards body's text.
Nothing on the page is a fatwa or a compliance opinion. What the demo is showing is not "is this
company halal" — it is "does a model apply a stated rule set to a filed balance sheet correctly, and
does the answer move when the rule set moves". Those are different questions and only the second one
is checkable.

The three sets differ in the way the real ones differ: one divides by market capitalisation, one by
total assets, and one is a stricter in-house set. That is enough to make the same company pass and
fail in the same afternoon.

## No labels, arithmetic instead

There is no labels file. Ground truth here is the demo's own sum: every ratio the model is asked to
judge is computed in `evaluate` from the same filed lines the state showed, and the report puts the
two side by side. The state contains the lines and the limits and no ratios — working them out is the
task.

## The recorded run

| | |
|---|---|
| Ratio calls that match the arithmetic | 98 of 105 |
| Interest income band named correctly | 46 of 48 |
| Missing lines admitted rather than guessed | 37 of 39 |
| Conventional banks refused on activity | 5 of 6 |
| Same business, same activity answer | 14 of 16 |
| Verdicts that follow their own answers | 98% |

Verdicts: 16 pass, 13 fail, 19 sent to a person.

## The seven ratio calls that disagree

Worth naming individually, because they are not all the same kind of error.

**Three are plain arithmetic, all in the same direction** — a limit called clear when it is not:
NVDA's cash at 30.3% against a 25% house limit, JPM's at 36.9% against 33%, BAC's at 59.3% against
33%. All three are the liquid-assets ratio. A screen that waves through a bank holding 59% of its
market value in cash and securities is not screening.

**Three look like the wrong denominator or the wrong limit.** PEP's debt is 28.2% of market
capitalisation and was called a fail — 46.5% of total assets, which is the *other* rule set's
denominator, would indeed fail. PG's debt was called a fail at 27.7% of total assets against a 33%
limit, which is what the house set's 25% would have said. JNJ's 24.06% against a 25% limit is a fail
call on a pass by a fifth of a point. These are the interesting ones: the model is doing the sum, but
on the wrong pair of numbers.

**One is arguably better than the arithmetic.** JPM's debt at 11.3% of total assets clears the house
limit comfortably, and the answer said it fails. For a universal bank, the filed `totalDebt` line
leaves out the deposits, which are interest-bearing liabilities and most of the balance sheet. The
demo counts this as a wrong answer because the demo only knows the line it was given. A person doing
this properly would agree with the model and not with the demo.

## The activity check was added after the run

The first version of the report only asked whether the two conventional banks were refused. The
recorded answers showed something the report was not looking for: JPM passed the activity screen
under the total-assets rule set and failed it under the other two, and SPY moved the same way. The
activity list is word for word the same in all three states — only the ratio limits differ — so the
answer cannot legitimately move. The report now checks for that across all sixteen instruments and
found two. This is a report change, not a re-record: the answers on file are the same ones.

## What the demo does not grade

The activity screen is a judgement and mostly not gradeable. Two answers are stated outright by the
screen itself (a conventional bank fails), and those are counted. Six instruments are deliberately
left ungraded because reasonable people differ: an index fund that holds banks, a retailer that sells
alcohol and pork as a small share of turnover, a snack maker using pork gelatine in some markets, and
a digital asset with no issuer. The report says how many of these were decided outright rather than
sent to a person — 5 of 12 — without saying which way is right.

## Caveats

- The market-capitalisation standard in the real world averages the denominator over trailing months.
  This demo uses the latest close, which makes the ratio move more than it should.
- `marketCap` is not in the cached files, so it is share count times last close. Share counts are as
  of the fetch date, not the fiscal year end.
- Four of the sixteen instruments are funds or a digital asset with no statements at all. Their
  ratios are ungradeable by construction, and the demo counts whether that was admitted rather than
  guessed. Two of 39 such calls were not admitted, both GLD receivables.
- Interest income is only on file for seven of the twelve operating companies. `NOT_IN_THE_DATA` is
  the right answer for the rest, and this is why AAPL and XOM are sent for review under all three
  standards rather than passed.

## A bug this demo surfaced elsewhere

Building it turned up that the cached `annual` statement arrays were not in year order — the fetcher
sorted `Date` objects as strings, so a January filer's newest year was not first. Every generator
reading `annual[0]` was reading an arbitrary year. Fixed in `scripts/generate/lib/market.js` (sorted
on load) and in `scripts/fetch-market.js` (sorted on the ISO day). Demo 161 was built on the wrong
year for five of its sixteen companies and has been regenerated and re-recorded.
