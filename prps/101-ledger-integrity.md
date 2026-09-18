# 101 · Ledger integrity review

**Domain:** Books · **Data:** synthetic (seed 1101) · **View:** ledger · **Items:** 500 lines · **Questions:** 5

## Value

Find the journal lines that don't reconcile, and say why each one is wrong.

## Demo flow

1. The month's ledger opens as a table, with document groups shaded and balances in the header.
2. Play runs line by line: the state panel shows one line plus its document siblings, the answers land, the flag appears.
3. Flagged lines collect in a side list, sorted by severity.
4. The report grades the run against the planted issues: caught, missed, false alarms.

## Data

- `demos/ledger-integrity/data.json` — one entity, one month, 500 lines in ~180 documents. Each line: `id`, `documentId`, `date`, `account` (code and name), `accountType`, `normalBalance`, `debit`, `credit`, `currency`, `memo`, `reference`, `postedBy`, `postedAt`.
- Generator `scripts/generate/ledger-integrity.js` plants 11 issues (~2%): 2 duplicate postings, 2 reversed signs, 2 documents missing a counter-entry, 2 lines dated outside the period, 3 misclassified accounts (capex booked as opex, owner draw as salary, deposit as revenue).
- Three deliberately ambiguous lines: a legitimate reversal, a genuine round-number payment, and a correct but unusual prepayment.
- Labels in `data/synthetic/ledger-integrity.labels.json`: `{ lineId, issue, note }`.

## State

Per line: the line itself, every other line of the same document, the account's rolling stats for the period (count, median amount, usual counterparty accounts), the period window, and the document's debit and credit totals. No labels, no issue counts, no hint that anything is wrong.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `issue_type` | choice | `DUPLICATE_POSTING` · `REVERSED_SIGN` · `MISSING_COUNTER_ENTRY` · `PERIOD_CUTOFF` · `MISCLASSIFIED_ACCOUNT` · `NONE` |
| `document_balances` | yes/no | Do this document's lines balance? |
| `memo_matches_posting` | yes/no | Does the memo describe what was posted? |
| `severity` | score 0–6 | None · Cosmetic · Minor · Notable · Material · Serious · Critical |
| `needs_human_review` | yes/no | – |

## Report

Caught, missed and false alarms against the labels; a confusion matrix of issue types; severity distribution; a review-threshold slider showing how many lines a human would read and what share of planted issues that catches; the ten highest-severity lines, clickable.

## Files

Standard demo folder (000) plus `scripts/generate/ledger-integrity.js` and a `ledger` view registration.

## Acceptance

Template list, plus:

- [ ] All 11 planted issues appear in the labels file and none appear in any state.
- [ ] The report's caught count is computed from labels, not from the model's own confidence.
- [ ] The three ambiguous lines are visible in the demo and discussed in `notes.md`.

## Video beats

- One duplicate posting: the state shows both lines of the document, the answer names it.
- The misclassified capex line, where the memo and the account disagree.
- The threshold slider: "read 40 lines, catch 9 of 11".

## Notes

This is the runtime's first proving ground (see README order). Keep `buildState` under 30 lines; it is the first code the video shows.
