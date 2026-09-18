# 165 · Accounting red flags

**Domain:** Screening · **Data:** synthetic (seed 1165) · **View:** table (statements) · **Items:** 120 company-years · **Questions:** 5

## Value

Find the statement patterns that deserve a second look, on data where the answer is known.

## Demo flow

1. A company-year opens with three years of statements and the notes that came with them.
2. The model names the strongest red flag and grades how serious it is.
3. Company-years sort by severity.
4. The report grades the calls against the planted patterns and shows the false alarms.

## Data

- `demos/accounting-flags/data.json` — 120 fictional company-years, built from real-looking statement shapes. Planted patterns: 12 with receivables growing far faster than revenue, 9 with inventory builds against falling sales, 8 with revenue recognised ahead of cash, 7 with capitalised costs rising suddenly, 6 with related-party revenue concentration, 5 with a restatement history, and 73 clean.
- Decoys: 10 companies with a genuine business reason for the pattern, stated in the notes (a new distribution channel with longer terms, a seasonal build before a launch).
- Labels: `{ companyYear, flag, decoy }`.

## Why synthetic here

Real filings can't be redistributed and their "answers" are contested. Synthetic statements let the demo claim accuracy, and 162 covers the real-data case.

## State

Three years of statements, the note disclosures in plain language, the sector's norms for working capital, and the auditor change history. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `flag` | choice | `RECEIVABLES` · `INVENTORY` · `REVENUE_TIMING` · `CAPITALISED_COSTS` · `RELATED_PARTY` · `RESTATEMENT` · `NONE` |
| `severity` | score 0–6 | None · Slight · Mild · Notable · Serious · Severe · Critical |
| `business_explanation_exists` | yes/no | Do the notes explain the pattern? |
| `second_flag` | choice | same list · `NONE` |
| `investigate` | yes/no | – |

## Report

Flag accuracy, severity against the planted seriousness, the decoys and how many were excused, the second-flag hit rate, and the ten most serious company-years.

## Files

Standard demo folder plus `scripts/generate/accounting-flags.js`.

## Acceptance

Template list, plus:

- [ ] Decoy explanations live only in the notes text, so excusing them requires reading.
- [ ] The report separates "found the flag" from "excused the decoy".
- [ ] All company names are fictional, from the shared word list.

## Video beats

- Receivables up 60% on revenue up 8%, flagged.
- The decoy with the new distribution channel, excused, with the note on screen.
- The accuracy split: flags found, decoys excused.

## Notes

Pairs with 162 in the video: the same reading skill, once on real data without labels, once on synthetic data with them.
