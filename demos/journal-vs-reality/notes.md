# Journal versus reality

Two hundred journal notes beside the trades they describe. The note is what the trader believes
happened; the record is what happened. Both are invented, and the notes are written the way a journal is
written — short, occasionally defensive.

## The data

`scripts/generate/journal-vs-reality.js`, seed 1155. Seventy-four notes drift: twenty-two call a full
position a "small starter", eighteen say they waited for a pullback the record says was taken at the
breakout, fourteen claim profit "at the target" when the exit was well short of it, eleven name a
different instrument, and nine describe a plan that appeared two days after the trade. The other
hundred and twenty-six say what the record says.

## What the recorded run found

200 answers, model `jev-1.13.0`, 190,754 input and 28,741 output tokens, about seven minutes.

- **Every one of the seventy-four drifting notes was caught.** Not one slipped through as accurate.
- **Four of the five drifts were named exactly**: size 22 of 22, entry 18 of 18, exit 14 of 14,
  instrument 11 of 11.
- **All nine after-the-fact notes were spotted as written after the outcome was known** — the separate
  yes/no caught every one — but none of them was labelled `RATIONALISATION` as the drift. They were
  called exit drift instead, which is defensible: the note does also misdescribe the exit. The two
  questions together get it right; either one alone does not.
- **Thirteen honest notes were called into question**, about one in ten. That is the cost worth
  watching: a journal that is always doubted stops being written.

## What this demo is really testing

Both halves of the same question are asked separately — does the note match the record, and does it
read as written after the fact — and the run shows why that matters. A single "is this honest" question
would have scored the rationalisations as a miss. Two questions show that the model saw exactly what was
wrong with them and filed it under a different heading.
