# Filings and calls

Ninety invented documents, 450 answers, 86,412 tokens in and 13,116 out on `jev-1.13.0`.

Thirty results releases, thirty risk-factor sections and thirty call excerpts, from twelve fictional
companies. Every company, person, number and sentence is written for this demo. No real filing or
transcript is copied, quoted or paraphrased, and nothing here is a statement about any real company.

## What a document costs

The brief asked for this on the page, so it is a KPI: the average state sent for one document is
**1,716 characters**, and the longest is 3,059. Ninety of them came to 86,412 input tokens. That is
the honest cost of reading, and it is why the risk sections are fifteen to eighteen lines rather than
the forty a real annual report carries.

## The recorded run

| | |
|---|---|
| Guidance read correctly | 90 of 90 |
| Guidance that actually moved, caught | 38 of 38 |
| New risk found, buried two thirds down | 9 of 9 |
| New risk found, near the top | 8 of 8 |
| New risk claimed where the list was unchanged | 0 of 13 |
| Numbers beat and the tone dropped, spotted | 8 of 12 |
| Tone off by | 0.60 points on a seven-point scale |

## The burial made no difference

The demo was built on the assumption that a risk buried two thirds of the way down a list of sixteen
would be missed more often than the same risk in the first three lines. It planted nine buried and
eight obvious so the two could be scored apart.

Both were found every time — 9 of 9 and 8 of 8 — and not one of the thirteen unchanged lists was
reported as carrying something new. Position did not matter. The report says so rather than quietly
reporting the combined number, and the finding on the page is written for the outcome that actually
happened rather than the one that was expected.

## Where it is weak

**Numbers beating while the language gets worse: 8 of 12.** A third of the documents where revenue
and margin both improved, the chief executive said conditions had deteriorated, and the order book
was lower than a year ago were read as telling one consistent story. That is the hardest thing on the
page and the most useful, because it is the pattern a reader is employed to notice.

**Every insider sale was called significant.** Three of the five were meant to be — over half a
holding, disposed of days before the announcement, outside any plan. The other two were pre-arranged
sales of under a tenth of a holding. Four of the five got a yes.

But the strength behind the answer separates them cleanly: **0.95 on the ones that mattered against
0.52 on the routine ones**. The model does tell them apart and the yes-or-no question throws that
away. Both numbers are on the page, because reporting only the first one would be reporting a failure
that is really a limitation of the question.

## Six wrong answers that turned out to be mine

The first recording scored 84 of 90 on guidance. Six documents were marked wrong, and one of them was
worth looking at: FD-0047 said "full-year revenue guidance is reduced to between 2,571 and 2,849
million", and the model called it a raise.

It was right to. The prior period's stated guidance, printed directly beneath, was 2,343 to 2,589
million. The generator was building the new range from the current quarter's revenue and the old
range from the previous quarter's, so a company that grew could print a "reduced to" sentence with
numbers above the range it claimed to be reducing. The words said cut and the arithmetic said raise,
and reading the arithmetic is the better instinct.

The generator now moves the new range off the old one — up four to nine per cent for a raise, down
four to ten for a cut, unchanged for a maintain — and a test asserts the two never contradict each
other. On the re-recorded run, guidance is 90 of 90. **All six errors were in the data.**

## Caveats

- The risk pool is eighteen standard statements and the new risks are five. Ninety documents drawn
  from that is a lot of repetition, and a model that saw the pool would do better than one that did
  not. Nothing here tests recognition of a genuinely unfamiliar risk.
- The tone score is graded against a planted value that follows mechanically from the guidance
  direction, softened for the beat-but-worse dozen. It measures agreement with a rule, not a
  judgement about prose.
- Real filings are longer than these by a factor of ten or more, and the buried-risk result should not
  be read as holding at that length. What this demo shows is that burial at this length does nothing.
