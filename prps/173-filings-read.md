# 173 · Filings and calls

**Domain:** News · **Data:** synthetic (seed 1173) · **View:** table (document) · **Items:** 90 documents · **Questions:** 5

## Value

Read a filing or a call transcript and pull out the parts that change the story: guidance, tone, new risks, insider activity.

## Demo flow

1. A document opens: a results release, a risk-factor section, or a call transcript excerpt.
2. The model classifies the guidance change, grades the tone shift, and picks out the new risk.
3. Documents sort by how much they change the picture.
4. The report grades the reads against the planted content and shows where tone and numbers disagreed.

## Data

- `demos/filings-read/data.json` — 90 synthetic documents for 12 fictional companies: 30 results releases with prior-quarter comparisons, 30 risk-factor sections with one or two genuinely new risks, 30 call excerpts with management answers.
- Planted: 18 guidance raises, 14 cuts, 22 maintained, 12 documents where the numbers beat but the tone deteriorates, 9 with a new risk factor buried mid-list, and 5 with insider transactions disclosed in passing.
- Labels: `{ documentId, guidance, toneShift, newRisk, insider }`.

## State

The document text, the prior period's equivalent where relevant, the company's fictional profile, and the date. No label, no summary.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `guidance_change` | choice | `RAISED` · `MAINTAINED` · `CUT` · `WITHDRAWN` · `NOT_MENTIONED` |
| `tone_shift` | score 0–6 | Much worse · Worse · Slightly worse · Unchanged · Slightly better · Better · Much better |
| `new_risk_factor` | yes/no | – |
| `insider_transaction_significant` | yes/no | – |
| `numbers_and_tone_agree` | yes/no | – |

## Report

Guidance accuracy, tone against the planted shift, new-risk recall (the buried ones are the test), insider mentions found, and the twelve beat-but-worse-tone documents as their own section.

## Files

Standard demo folder plus `scripts/generate/filings-read.js`.

## Acceptance

Template list, plus:

- [ ] The buried new-risk documents are recalled separately from the obvious ones.
- [ ] Company names, people and numbers are fictional, and the page says so.
- [ ] Document text is long enough to be realistic but capped so the state stays under the token budget noted in `notes.md`.

## Video beats

- A release where the numbers beat and the tone drops, with both quotes on screen.
- A new risk factor found in position 14 of 19.
- The guidance grid across 90 documents.

## Notes

This demo is where the token budget bites first. Record the state size on the page so viewers see the cost of long documents.
