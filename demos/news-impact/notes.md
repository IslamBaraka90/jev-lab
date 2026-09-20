# News impact

Three hundred headlines against the charts they landed on. 1,500 answers, 517,953 tokens in and 47,930
out on `jev-1.13.0`. The largest run in the set.

## The companies are invented on purpose

The brief called for invented headlines on the sixteen real symbols in the manifest. That is not
something this repository should publish: an invented headline, on a real company, on a real date,
beside a real chart is fabricated financial news, and a disclaimer at the bottom of a page does not
travel with a screenshot.

So the twelve issuers here are fictional, and each one's price history is a real cached series rebased
to a different level. **Nothing the demo measures is affected.** A forward return does not depend on
the starting price, so every gap, every run, and every move after every headline is one the market
actually made. What changes is only that no invented event is attached to anybody's name.

The headlines themselves are written from templates for this demo. No real article text is copied,
quoted or paraphrased.

## What is planted

Forty headlines sit in front of a real move of six per cent or more within five trading days. Forty
sit in front of a move of one per cent or less. **Both sets are written from the same templates** —
guidance cuts, regulatory reviews, contract losses, finance chiefs leaving. The remaining 220 are
routine: dividends declared, conference slots, broker notes.

That is the design. From the words alone the two dramatic sets are indistinguishable, because they are
drawn from the same pool.

## The recorded run

| | |
|---|---|
| Big news told from small | 1.9 points |
| Materiality gap, real move against none | −0.1 points |
| Direction called at all | 61 of 166 |
| Right when it called one | 52 of 61 |
| Horizon matched | 51 of 300 |
| Pre-news drift noticed | 63 of 97 |
| Acted on | 7 of 300, 43% hit rate against a 29% base |

## What it shows

**The separation that should exist, does.** Dramatic headlines are graded 1.9 points more material
than routine ones. Not one of the 220 routine items was graded as heavily as the average dramatic one.

**The separation that should not exist, does not.** The forty headlines followed by a six per cent
move and the forty followed by nothing were graded within a tenth of a point of each other. This is
the demo working rather than failing: the text does not know what happens next, and neither does
anybody reading it. Any demo that showed a model picking the real ones out of identical wording would
be showing a leak.

**It knows when not to answer.** 178 of 300 headlines got no directional read at all. On the 61 where
it did commit, it was right 52 times — 85 per cent. That is not a forecast: the headlines in front of
a real move were written to point the way the price went, so the number mostly repeats the reading of
the words. Against the direction each template was written with, 294 of 300 were read as written, and
two lists of verbs get all 300. An earlier version of this report counted every
neutral answer as a wrong direction and reported 31 per cent, which said more about the measure than
the model. Declining to call a direction is now reported separately from calling one wrongly.

**The chart is not read.** 63 of the 97 headlines whose price had already moved three per cent in the
week before were called already priced, but so were 149 of the 203 whose price had not: 65 per cent
against 73. An earlier version of these notes reported the first number alone and called it the chart
doing its work. Most of those answers sit within a few points of a coin flip.

**It almost never says trade.** Seven of three hundred. Three of those seven were followed by a move
over four per cent, a 43 per cent hit rate against 29 per cent for acting on everything. Seven is too
few to lean on, but it points the right way, and a model that says "nothing to do here" 293 times out
of 300 is behaving the way the task deserves.

## Where it is weak

**The horizon question.** 51 of 300. The model answers `SAME_DAY` 174 times; only 27 headlines were
followed by a same-day move of three per cent or more. It expects news to be repriced immediately, and
this market mostly does nothing at all — 153 of the 300 never produced a move of size at any horizon.

The ground truth for that question is the weakest thing on the page, and it was rewritten once. The
first version compared the one-day move with the twenty-day move, which on a random walk mostly
measures how a random walk spreads out: it labelled 139 of 300 "weeks" for no better reason than that
twenty days is longer than one. It now asks when a move of any size **first** showed up, which is
concrete and explainable, but "when did the news land" is not really recoverable from a price series
and this number should be read with that in mind.

**The scale is compressed.** Nothing in three hundred headlines scored above 3.9 of 6. The bottom two
thirds of the scale does all the work. The report therefore compares groups against each other rather
than against fixed bars — an earlier version used an absolute threshold of 4 and reported "40 of 40
real moves graded immaterial", which was an artefact of the bar, not a finding.

## Caveats

- A five-day forward return is one definition of "did it matter". Twenty days would give a different
  answer for a different set of headlines, and both are on the label.
- The routine headlines are drawn from four templates, so 220 items carry a lot of repetition. The
  separation from the dramatic set is therefore easier than it would be on real newsflow.
- Every issuer's series comes from a large, liquid instrument. Nothing here says how this reads on a
  small cap where a single headline moves the price ten per cent for reasons of liquidity alone.
