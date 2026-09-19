# Regime classification

Three hundred and twelve weeks — four instruments over eighteen months — judged one at a time. 1,560
answers, 1,151,794 tokens in and 66,361 out on `jev-1.13.0`. By some distance the most expensive demo
in the set.

There are no labels. The comparison is the three shipped strategies' own results on these same bars,
run twice.

## The gate cost 78 points

| | |
|---|---|
| Strategies always on | **+95.25%** over 118 trades |
| Strategies gated by the weekly call | **+16.74%** |
| What the gate was worth | **−78.51%** |
| Trades the gate refused | 104 of 118, worth +69.19% between them |
| Weeks it said stay out | 52 of 312 |

Both runs use the same signals, the same bars and the same tenth of a per cent per trade. The only
difference is whether the week's answer named that strategy's family, and the size answer scaling
what got through. A test asserts the curves are identical when the gate allows everything.

## Why, and it is not simply "the calls were wrong"

Break it down by strategy and the mechanism is plain:

| Strategy | Always on | Gated | Trades allowed |
|---|---|---|---|
| Twenty-day range break | +62.84% | **0.00%** | 0 of 89 |
| Pullback to the fifty | +28.92% | +13.25% | 11 of 26 |
| Fifty over two hundred | +3.49% | +3.49% | 3 of 3 |

**The range break is 75 per cent of the trades in this book, and `BREAKOUT` was the answer in two
weeks out of three hundred and twelve.** The strategy that does three quarters of the trading was
switched off for the entire period by an answer the model almost never gives.

That is as much a fact about the book as about the gate. A gate that assigns one strategy to each
family only works if the families are roughly balanced in the book, and this one is not. The report
puts that concentration on the page as its own figure, because without it the −78.51% looks like a
verdict on the regime calls when it is mostly a verdict on the pairing.

It is worth being clear about what was *not* done here: the obvious way to improve this number is to
re-label the range break as trend following, since buying a twenty-day high is arguably that. It
would have handed most of the trades back and the gate would have looked far better. Changing the
mapping after seeing the results is the fitting error these demos exist to warn about, so the mapping
stands as it was written.

## What the calls themselves look like

- **The regimes are distributed sensibly**: 90 trend up, 67 trend down, 69 range, 66 high volatility,
  20 event driven. Nothing is stuck.
- **The demo's own arithmetic agrees 60 times in 312.** That is a low number and the page says it is
  a disagreement rather than an error: naming a regime from thirteen weeks of drift, spread and a gap
  count is crude, and neither reading is authoritative. The cross-check is there so a viewer can see
  both and judge, not so one can mark the other.
- **It never raised size into a volatile week.** Zero of the thirty-five weeks the arithmetic calls
  high volatility got an increased size. The risk answer was half in 168 weeks and normal in 139.
- **Eighty weeks were called a turning point, and 72 of those were also called unclear.** The two
  answers move together, which is what you would hope for.
- **It refused 27 of the 32 trades that made over three per cent, and let through 1 of the 23 that
  lost over three.** With 104 of 118 trades refused, both of those follow from refusing nearly
  everything rather than from picking well.

## The cost

1.15 million input tokens for three hundred and twelve weekly judgements. Each state carries
forty-five daily bars and thirty-nine weekly summaries, which is about 3,300 characters, and the
questions add another 1,500. If this page has a practical lesson beside the strategy one, it is that
a weekly gate over a handful of instruments is not a cheap thing to run.

The daily and weekly series live once each in the dataset's context and the items point into them by
index; four hundred copies of the same sixty-bar window would have been most of a megabyte of
duplicated numbers.

## Caveats

- Eighteen months, four instruments, three rules. The gate has not been tested on a book that is
  balanced across families, which on this evidence is the thing that would matter most.
- The family each strategy belongs to is a judgement written into `src/strategies/index.js`. A
  different reasonable assignment would give a different answer, as above.
- The golden cross fires three times in the whole window. Its numbers are noise and should be read as
  such.
- Trades are held ten sessions regardless of anything that happens in between, and the size answer
  scales the result linearly. No stop is ever applied.
