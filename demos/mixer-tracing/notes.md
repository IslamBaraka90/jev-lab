# Tracing and mixer exposure

Ninety traces on a fictional graph. Each one follows a wallet's funding back up to five hops and lists
the labelled entities it passed. **Every address is invented and the entity names are placeholders**
(`MIXER_A`, `EXCHANGE_C`) that match no real service.

What makes this demo gradeable is that **the desk's rules are in the state**:

1. Taint is followed for five hops and acted on within three.
2. A deposit into an exchange that checks identity breaks the chain; what comes out is treated as clean.
3. A bridge does not break the chain. It only changes which chain the money is on.
4. Amounts have to add up along a path. A hop that passes on more than it received means the path is
   not what it claims to be.

## The data

`scripts/generate/mixer-tracing.js`, seed 1133. Twelve traces sit one hop from a mixer, fourteen two or
three hops back, **nine have an exchange between the subject and the mixer** — clean under rule two —
and **eight carry a hop holding less than it went on to pass**, which breaks rule four. The other
forty-seven reach nothing at all.

## What the recorded run found

90 answers, model `jev-1.13.0`, 137,434 input and 14,403 output tokens, about three minutes.

- **All thirty-four tainted traces were found**, including **all eight** whose amounts do not add up.
  That last one is the quietest case in the file — it needs the arithmetic walked backwards, hop by
  hop — and it was caught every time.
- **The exchange rule was not applied once.** All nine traces with an exchange in the way were called
  tainted. And it is not that the break was missed: **on all nine it answered yes to "does an exchange
  sit between the subject and the source"**, and then said the funds were tainted anyway. It reports
  the fact and declines to let the desk's rule change its answer.
- **Twenty-four of the fifty-six clean traces were called tainted**, $5.7m held up for nothing,
  including fifteen where nothing was found on any path at all.

## The useful part: the score separates where the yes/no does not

The yes/no is liberal. The score is not:

| Exposure bar | Traces held | Tainted among them |
|---|---:|---|
| 2 of 6 | 62 | 34 (55%) |
| 3 of 6 | 39 | 34 (87%) |
| **4 of 6** | **34** | **34 (100%)** |

Clean traces score 2.02 at the median; tainted ones score 4.61. **At an exposure of four the file
splits perfectly** — every tainted trace, nothing else. So the operating advice this run supports is to
act on the score and treat the yes/no as a first pass, which is the opposite of how a desk would
normally wire it.

## The honest caveat

A demo that puts four rules in the state and finds one of them ignored has either found something real
about the model or written the rule badly. The rule here is one sentence in a list, and the state does
not repeat it next to the path where the exchange appears. A second version should put the rule beside
the evidence — and if the answer does not move, that is a much stronger finding than this one.
