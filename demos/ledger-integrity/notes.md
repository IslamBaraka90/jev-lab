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

## Status

The dataset, the questions and the report are built. The answers are recorded once with
`npm run record ledger-integrity` and committed; until then the page shows the data, the state and the
code, and says so.
