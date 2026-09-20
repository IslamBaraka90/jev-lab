# Golden cross review

Seventy-one crossovers, 355 answers, 367,928 tokens in and 13,922 out on `jev-1.13.0`.

Every cross on the page is one the rule in [`src/strategies/golden-cross.js`](../../src/strategies/golden-cross.js)
really found in the cached bars. None were chosen, none were dropped, and the trade scored against
each one — in at the cross close, out twenty sessions later, a tenth of a per cent of cost — is
applied identically to every approach the report compares.

There are no labels. The price is the answer.

## Seventy-one, not two hundred and forty

The brief expected roughly 240 crossovers from ten years of daily history. The cached data is six
years — 1,506 bars per symbol — and a fifty-over-two-hundred cross is a rare event: between two and
seven per instrument over that span, seventy-one in total across the sixteen.

There are ways to get the count up. Running the detector with other pairs, or on weekly bars, or
adding the downward cross, would all produce more items. None of them would be the golden cross, and
this is the demo people ask for by name. Seventy-one real events beats two hundred and forty
manufactured ones.

## The recorded run

| | |
|---|---|
| Taking every cross | +14.77% over 71 trades, 38 up |
| Taking only the ones it kept | +4.74% over 49 trades, 23 up |
| What the filter was worth | **−10.04%** |
| Average trade, kept against all | +0.10% against +0.21% |
| Filtering on the quality score instead | +22.21% over 44 trades, +0.50% each |

## The filter lost money, and the score only looked better

**The take-or-leave answer made things worse.** Taking all seventy-one crosses returned 14.77 per
cent. Taking the forty-nine it kept returned 4.74. Per trade that is +0.10% against +0.21% — the
judgement halved the edge, and there was not much edge to halve.

**The quality score, on the same answers, came out ahead of both — because of Bitcoin.** The
forty-four crosses graded three or better on the nought-to-six scale averaged +0.50% a trade, against
+0.10% for the ones it chose to take. But the five BTC-USD crosses add up to +41.75 points in a book
that totals +14.77. Without them every cross averages −0.41%, the score filter −0.50% and the kept
trades −0.84%: the score filter does nothing. One trade varies by about 7.1 points, so the average of
seventy-one is only known to within 0.84, and every difference in the table above is inside that.

Three is the midpoint of the scale, chosen because it is the midpoint and for no other reason.
Thresholds fitted to the outcomes look far better than this — the twenty crosses graded 3.5 or above
averaged +3.8% a trade — and that number is not on the page, because picking the cut-off that pays
best on the sample you have is precisely the mistake this demo exists to warn about. It is written
here, in the notes, so that nobody has to rediscover it by accident.

**The validity question separated too.** The twenty-five crosses called an artefact of a flat market
averaged −0.18%, against +0.42% for the forty-six called real. That is a working judgement. It just
did not survive being turned into take-or-leave: of the twenty-five called artefacts, four were taken
anyway, and of the forty-six called real, only one was skipped.

## What that adds up to

The rule is the easy part, exactly as the brief said. Seventy-one signals over six years across
sixteen large instruments produced 14.8 per cent in total before any judgement was applied — a little
over two tenths of a per cent a trade, which does not pay for the attention.

What the reading was worth is visible in the score and the validity call, and lost in the decision.
If there is one thing to take from this page it is that the shape of the question changes the answer:
ask for a grade and you get one that carries information; ask for a yes or a no and you get a coin
with a slight tilt.

## Where the reading is weak

**Every skip named a stop.** All twenty-two of them answered the stop question with a real placement
rather than "no stop, because there is no trade". That is partly the question's fault — "where does
the stop go" invites an answer whether or not you are trading — but the criterion for `NONE` says so
explicitly and it was not used once.

**Ten crosses were read as reversal risk** and those did the worst of any group, averaging −0.32%.
Only a small sample, but it is the one context label that pointed the right way.

## Caveats

- Seventy-one trades is a small sample and a twenty-session hold is one arbitrary choice among many.
  The same crosses held five sessions or sixty would give different numbers.
- Sixteen large, liquid instruments over one six-year stretch that contained a crash, a bull run and a
  rate cycle. Nothing here generalises to small caps or to another decade.
- The cost is a flat tenth of a per cent per trade, applied identically to every comparison. Real
  costs are not flat and would hurt the approach that trades more, which here is taking everything.
- No stop is ever actually applied. Every trade is held the full twenty sessions whatever it does in
  between, so the stop question is graded on consistency rather than on money.
