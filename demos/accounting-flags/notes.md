# Accounting red flags

A hundred and twenty invented company-years, three years of statements each, 600 answers, 191,240
tokens in and 27,842 out on `jev-1.13.0`.

This is the weakest result of the screening demos, and the page says so. It is worth keeping for
exactly that reason: it shows a model that reads statements well and decides about them badly, and
those are separable.

## What is planted

Forty-seven of the hundred and twenty carry a pattern: 12 receivables running ahead of revenue, 9
inventory building while sales fall, 8 revenue recognised ahead of the cash, 7 with a sudden jump in
capitalised costs, 6 with a related-party concentration, 5 with a restatement. Ten of those
forty-seven are decoys — the pattern is really there in the numbers, and a note explains it in prose.
The remaining seventy-three are clean.

Everything is fictional and the statements are built from sector-typical shapes, so each pattern is
visible in the numbers rather than asserted anywhere.

## The recorded run

| | |
|---|---|
| Patterns named correctly | 33 of 47 |
| Clean years accused of something | 58 of 73 |
| Clean years held up for review | 51 of 73 |
| Severity gap, planted against clean | 1.2 points |
| Decoy explanation found in the notes | 7 of 10 |
| Decoys let through | 0 of 10 |
| Second pattern found | 9 of 14 |

## The finding that matters

**The ranking works and the decision does not.** A planted year is scored 3.8 of 6 on severity and a
clean one 2.6 — a consistent 1.2-point gap, which is enough to sort by. Sort by severity: take
the years scored 3 and above and you review 58 of 120 and catch 35 of the 37 unexplained ones. That is a
usable triage.

The yes-or-no is a different story. Fifty-one of the seventy-three clean years were held up for
review. The model almost never says "sign it off". If you read this page as an accuracy number you
would call it a failure; if you read it as a queue order you would ship it. Both readings are on the
page and neither is hidden.

## The other findings

- **Receivables swallow everything.** RECEIVABLES was named 77 times out of 120. Fourteen real
  patterns were spotted and then called receivables — inventory builds, related-party concentrations
  and revenue-timing gaps all read as "receivables" to this model. Six of the eight revenue-timing
  plants are in that pile, which is the single worst cell in the matrix.
- **Restatements are missed.** Three of five. The signal is entirely in the notes and the auditor
  history, and there is nothing in the numbers to notice, so a reader working from the statements will
  walk past it.
- **The decoys were read, and it changed nothing.** Seven of ten explanations were found in the notes
  — so the prose was read — and then every one of those years was held up anyway. The severity gap
  between a real pattern and an explained one is 0.2 points, which is to say none. Finding an
  explanation and acting on it are separate, and only the first one happened.

## Three recordings, and why

The first run was against data where every clean company was a perfect geometric progression:
receivables grew at exactly the revenue rate, to three decimals, in all seventy-three of them. That is
not what statements look like, and a demo cannot claim a false-alarm rate on data that has no noise in
it. Year-to-year wobble was added to the growth rate, the working-capital days, the margin and the
cash conversion.

The same pass found two other data defects, both of which had been counted against the answers:

- Three of the nine inventory plants had landed on software companies with **no inventory at all** in
  any of the three years. The demo was asking for a stock build in a business that holds no stock.
  Inventory now only plants on sectors that carry it.
- Some inventory plants also carried revenue-timing as a second pattern. One scales the revenue line
  down and the other scales it up, so a company with both showed neither. Second patterns are now
  drawn only from those that leave revenue alone.

The third recording followed a change to the `investigate` question. As first written it asked whether
a year should "go to somebody" and set no bar, and the answer came back yes for every graded item —
a question with no discrimination in it measures nothing. It now states the standard in the state
("most years are unremarkable; hold one up only where somebody relying on these numbers would be
misled") and asks whether to hold up the sign-off. That moved the clean-year holds from 73 of 73 to 51
of 73. Still too many, and now at least a number that means something.

The pattern-naming result barely moved across all three runs (37, 31, 33 of 47), which is worth saying
plainly: the data fixes changed what the demo could fairly claim, not what the model could do.

## Caveats

- The severity gap between real patterns and decoys is 0.2 points, so this demo cannot claim the model
  distinguishes an explained pattern from an unexplained one. It reads the explanation and then treats
  both the same.
- Seventy-three clean years is a lot of clean years, and the accusation count is sensitive to that
  ratio. A file with fewer clean years would look better for no better reason.
- The severity bands in the coverage curve are mine. The curve is honest about what it shows; the
  choice of where to draw the line is a decision for whoever runs the review, not for this page.
