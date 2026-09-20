# Ledger integrity review

One month of a small company's general ledger, read one line at a time. The question is the one every
month-end has: which of these postings is wrong, and in what way.

## The data

`scripts/generate/ledger-integrity.js`, seed 1101: 502 lines in 197 documents for May 2026 — purchases
with VAT, supplier payments, sales invoices, customer receipts, payroll, rent and bank charges. Names,
amounts and clerks are invented; nothing here belongs to a real company.

**Eleven problems are planted, across thirteen lines.** The planted list lives in
`data/synthetic/ledger-integrity.labels.json`, outside this folder, so a state builder cannot reach it:

| Problem | Count | What was done |
|---|---|---|
| Duplicate posting | 2 | A supplier payment posted a second time days later, under a new document number |
| Reversed sign | 2 | An expense posted as a credit, so its document no longer balances |
| Missing counter-entry | 2 | The bank side of a customer receipt never posted |
| Period cut-off | 2 | An invoice dated 27 April or 3 June, posted in the May ledger |
| Misclassified account | 3 | Equipment posted to office supplies, an owner draw posted as salary, rent posted as travel |

## The three lines that look wrong and are not

The dataset also carries three postings that trip simple rules. None of them is labelled, and a good
review leaves all three alone:

- **A credit note** reversing an earlier sales invoice. Every line is the mirror image of another
  document, which is exactly what a duplicate looks like to a matcher.
- **A round 25,000 payment** to a landlord. Round numbers are a classic flag; this one is the agreed
  figure in a lease.
- **An 18,000 prepayment** for annual insurance, sitting in an asset account rather than an expense.
  Large, unusual for the month, and correct.

## What the model sees

For each line: the line itself, every other line of its document with the document's totals, what that
account normally looks like this month (postings, median and largest amount, the accounts it usually
pairs with), any other posting this month with the same counterparty and the same amount, and the chart
of accounts. No labels, no counts of what is wrong, nothing from outside the month.

The lookalike list is what makes a duplicate findable at all: one line on its own cannot tell you it has
a twin.

## How it is graded

The report counts **problems**, not lines: a duplicate that spans two lines is one problem, caught when
either line is named correctly. It also counts false alarms on the 489 clean lines, because a review that
flags everything is worthless, and it draws the review threshold as a curve — how many lines a person
opens against how many problems that catches.

## What the recorded run found

502 answers, model `jev-1.13.0`, 679K input and 77K output tokens.

- **Nine of the eleven planted problems were caught**, each named with the right issue type: both reversed
  signs, both missing counter-entries, both period cut-offs, two of the three misclassified accounts and
  one of the two duplicate payments.
- **Two were missed.** The second duplicate pair (L-0228 and L-0229) was called clean, even though the
  first pair was caught from the same lookalike list, and one misclassified line (L-0240) was let through.
- **All three decoys were left alone**: the credit note, the round 25,000 payment and the prepayment.
- **Severity tracked seriousness.** Caught problems scored 1.8 to 4.4 of 6; the two documents that no
  longer balance scored highest, at 4.2 to 4.4.

## The VAT objection, which is our fault and not the model's

75 clean lines were flagged, and **68 of them are the same objection**: input VAT posted as a debit to
`2200 VAT payable`, called a reversed sign with 84 to 92 percent confidence.

The model is arguably right. This generator posts purchase VAT into a single VAT control account, which
plenty of small charts of accounts do, and a debit there reduces the liability. A stricter chart puts
reclaimable VAT in its own receivable account, and on that reading a debit to a liability account is
exactly the mistake the model named.

It is left in on purpose, and the report surfaces it as one clustered disagreement rather than 68
separate mistakes. Read the cluster before blaming the model: a repeated objection on one account is
usually a question about the chart of accounts, not a hallucination.

Fixing it means adding a VAT receivable account, regenerating the ledger and re-recording all 502
answers, which costs another full run.

## Review threshold

Opening every line the model scores at 30 percent or more means reading 246 lines and catching all
eleven problems. At 50 percent it is 96 lines and nine problems. At 80 percent, 20 lines and four.
