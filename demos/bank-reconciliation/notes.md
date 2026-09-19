# Bank reconciliation

One synthetic USD bank account for May 2026, reconciled from the statement back to the cash ledger.
The names, account reference and transactions are invented. Nothing in this dataset belongs to a real
company, person or bank.

## The data

`scripts/generate/bank-reconciliation.js`, seed 1102, creates **240 statement lines and 232 ledger
entries**. A strict rule clears a line only when it has one unique ledger entry with the same direction
and amount, dated no more than one day away. That removes 180 obvious pairs and leaves the 60 statement
lines used by this demo.

The generator plants and labels every open line. Labels live in
`data/synthetic/bank-reconciliation.labels.json`, outside the demo folder:

| Break reason | Open lines | What makes the line stay open |
|---|---:|---|
| Timing | 12 | The amount agrees, but the ledger date is five or six days away |
| Unbooked bank fee | 9 | The bank charged a fee and no ledger entry exists |
| FX difference | 7 | The EUR amount agrees, while the USD amount uses a different rate |
| Partial payment | 8 | The bank amount is only part of the booked invoice or receipt |
| Duplicate | 6 | One bank movement has two ledger postings |
| Missing in books | 5 | A non-fee bank movement has no ledger entry |
| Matched | 13 | The amount agrees, but the date and remittance reference are messy |

The six duplicates are why the ledger has eight fewer rows than the statement rather than fourteen:
each duplicated case contributes one statement line and two book entries.

## Candidate rule

Candidate search is completed before the model is called. For every open statement line, the generator
ranks the 52 ledger entries left after pre-clearing and stores the best five. Same-direction entries
come first; within that group the score combines relative amount difference and calendar-day distance,
then uses the stable ledger id as a tie-breaker. The rule never reads a label, and generation fails if
the planted counterpart falls outside the five candidates.

That separation matters: Jev judges a short, reproducible list. It is not being asked to search an
entire ledger, and recording the same seed always sends the same state.

## What the model sees

For one open line: the complete statement record, five complete candidate ledger entries, May's
opening and closing balances, the period, currency, masked demo account reference, and the bank's
reference format. It does not see the intended entry, break label, planted counts or problem id.

## The three hardest cases

- **Partial payments.** The counterparty, date and reference point to the right entry, but the bank
  amount is deliberately 4–12% below the booked amount. A pure exact-amount matcher cannot clear it.
- **FX differences.** Both records carry the same EUR amount and reference, while the USD amounts use
  different booking and settlement rates. Comparing only the account currency makes this look wrong.
- **Duplicates.** Two book entries have the same amount and reference for one bank movement. Picking
  the original candidate is not enough; the line must also be named as a duplicate and kept out of
  auto-clear.

The 13 messy matches are the counterweight. They are safe matches despite a two- or three-day date
gap and reformatted remittance reference, so sending every non-exact line to a person is not useful.

## How the report is graded

A result is exact only when both the selected ledger id and the break reason agree with the label.
Auto-clear additionally requires `MATCHED`, a match-quality score of at least 4 of 6, and a yes
probability of at least 0.5. Precision uses labelled auto-clears only. The coverage curve moves the
quality threshold from 0 to 6 and shows the resulting human workload.

The money-left KPI is the gross value of statement lines not auto-cleared. The report also proves the
net reconciliation equation on every partial or complete run:

`opening balance + pre-cleared net + auto-cleared net + remaining net = statement closing balance`

## What the recorded run found

All 60 items were recorded on 19 September 2026 with `jev-1.13.0`: 103,814 input tokens and 12,298
output tokens.

- All 60 planted problems were resolved with both the intended ledger entry and break reason.
- All 13 messy-but-valid matches cleared automatically at the 4-of-6 quality threshold: a 22%
  auto-clear rate with 100% precision.
- No valid messy match became a false alarm, and no incorrect line was sent through auto-clear.
- The remaining 47 statement lines represent $190,466.32 of gross human workload.
- The report reconciles exactly to the $256,894.94 statement close, with a zero difference.
