# Rumour grading

Two hundred and forty claims about twenty invented companies. 1,200 answers, 202,056 tokens in and
30,000 out on `jev-1.13.0`.

Every company, account and claim is invented. No real platform is named anywhere, because the
question this demo asks is what the evidence supports, not where somebody posted it.

## What is planted

Twenty-two claims were later confirmed, thirty-eight later denied, and a hundred and eighty never
resolved either way. That last group is three quarters of the file and it is deliberate: most rumours
simply stop being talked about, and a demo that dropped them would be reporting on a world that does
not exist.

Fourteen are coordinated pushes — twenty-eight to fifty-four accounts, eight to thirty-five minutes,
eighty-four to ninety-seven per cent of the wording shared. Twelve more travelled just as far and
just as fast with nine to thirty-one per cent shared wording: a real crowd, in its own words. **Reach
and speed overlap completely between those two groups**, by construction, so the only thing that can
separate them is the phrasing. Nine claims cite a document somebody could go and read.

## The recorded run

| | |
|---|---|
| Coordinated pushes caught | 14 of 14 |
| Organic spread mistaken for a push | 1 of 12 |
| Checkable claims spotted | 9 of 9, with no phantoms in the other 231 |
| Sent to somebody to check | 112 of 240 |
| Confirmed claims ignored | 0 of 22 |
| Denied claims called act-worthy | 0 of 38 |
| Reliability gap, true sources against false | 0.8 points |

## What it shows

**The coordination test works, and works on the right signal.** Every one of the fourteen pushes was
caught, and only one of the twelve organic crowds was mistaken for one. Since the two groups are
indistinguishable on how many accounts and how fast, the shared wording is the only thing that could
have done it. The strength behind the answer separates the groups by 0.38 even before it is turned
into a yes or a no.

**It reads documents.** All nine claims citing something checkable were spotted, and not one of the
other 231 was claimed to cite anything. That is a clean result on a question with an unambiguous
answer.

**Reliability tracks truth, weakly but in the right direction.** Of the resolved claims graded two of
six or above, 59 per cent turned out true; at three of six, 68 per cent; against a base rate of 37
per cent. The curve rises, which is the thing worth having.

## What the two zeroes actually mean

"Confirmed claims ignored: 0 of 22" and "denied claims called act-worthy: 0 of 38" look like perfect
scores. They are not results at all.

The dispositions came back as: **ignore 1, watch 127, verify 112, act-worthy 0**. Two of the four
options were effectively unused, so the two error counts built on them could only ever have been
zero. The report says so on the page rather than letting the zeroes stand as achievements.

The number that does mean something is the one added after seeing this: **112 of 240 claims were sent
for somebody to check**. Eleven of those turned out to be true and sixteen turned out to be false;
the rest never resolved. Just under half the file going to a verification queue is the real cost of
this policy, and it is the figure to put beside the price of the team that would work it.

## Caveats

- Three quarters of the claims never resolve, so every accuracy number here rests on sixty items. The
  calibration curve in particular is built on those sixty and should be read as indicative.
- The wording-similarity figure is given directly in the data. A real system would have to compute it
  from the posts themselves, and the demo says so in the state rather than pretending otherwise.
- Source track records correlate with outcome by construction — confirmed claims come from accounts
  with better histories about seventy per cent of the time. That is realistic but it is also a signal
  the generator put there, and the 0.8-point reliability gap should be read with that in mind.
- The claims are drawn from twelve templates across twenty companies. Nothing here tests a claim
  phrased in a way the reader has never seen.
