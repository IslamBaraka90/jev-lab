# Sanctions name matching

This demonstration uses a wholly fictional watchlist, fictional program names and invented people.
It is an illustration of structured identity matching, never a screening decision or a substitute
for a regulated screening process.

Seed 1124 creates 200 candidate pairs: 18 true matches, 12 deliberately insufficient records and
170 false positives built from transliteration, common surnames, father-and-son names, one-digit
date differences, same-city/different-country collisions and clear identifier contradictions.

Both records, the screening engine's fuzzy score and the matching policy are sent to Jev in full.
The planted identity, collision cause and deciding field remain only in the labels file.

## Recorded run

Recorded on 2026-09-19 with `jev-1.13.0`. The complete pass cached all 200 candidate pairs and
all five typed answers per pair (224,088 input tokens and 34,400 output tokens). The fixture audit
found no missing, extra or malformed records.

The immutable results are intentionally mixed. Jev kept all 18 true matches, made the correct
same/different call on 170 of 188 candidates with sufficient evidence, and explicitly chose
`INSUFFICIENT` plus `REVIEW` for 10 of the 12 thin records. It cleared 29 of 170 planted false
positives; most of the remaining false positives were conservatively held for review. The main
identity error was the one-digit date-of-birth trap (17 of 28 called the same identity), with one
additional city/country collision called the same identity. Deciding-field accuracy was 89 of 200.

Those disagreements are part of the cached evaluation. They were not retried, edited or hidden.
