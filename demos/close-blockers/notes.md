# Close blockers

Sixty trial balance accounts on working day four of a six-day close. The useful question is not "which
account moved a lot" — a spreadsheet does that — but "which of these actually stops the books being
signed off, and whose desk does it go on".

## The data

`scripts/generate/close-blockers.js`, seed 1105: one month for an invented company, Calder Works Ltd,
with its three invented subsidiaries. Every account, balance, note and name is generated. Each line
carries the balance, last month's balance, the movement, the range the controller expects that account
to move in, the reconciliation status, the number of open items, and whatever the preparer wrote in
the note field.

What is planted is in `data/synthetic/close-blockers.labels.json`, outside this folder:

| Blocker | Accounts | What it looks like |
|---|---:|---|
| Unreconciled | 4 | The rec is not done, or it is done and does not agree |
| Missing accrual | 3 | The work happened in August, nothing is booked for it |
| Intercompany | 2 | The balance does not agree with Dublin or Munich |
| FX revaluation | 2 | A euro balance still sits at the rate it went in at |
| Unsupported journal | 2 | A manual entry with no approval and no backup |
| **Looks alarming, is fine** | **6** | A big movement with its paperwork attached |
| Ordinary | 41 | Moves as expected, reconciled, nothing to say |

## The point of the file: a movement threshold is not enough

Fourteen accounts move outside the range the controller expects. **Nine of them are real blockers and
five are not**, so a rule that flags unusual movements is right about two times in three and sends five
fully supported accounts to a partner who then has to explain the bonus pool again.

It cuts the other way too. Four of the thirteen blockers move by a perfectly normal amount: the
receivables control account that does not agree to the aged debt report, the payroll clearing account
that should be nil, the euro balance that has never been revalued, and the legal provision with no
accrual for the firm doing the work. Nothing in the numbers gives those away. **The preparer's note
does**, which is why the note carries most of the signal in this dataset and why it is written the way
a tired accountant writes at 7pm rather than the way documentation is written.

Five accounts have no note at all. They are ordinary, and they are there so that "no note" does not
become a tell.

## What the model sees, and what it does not

The account with its numbers and its note, the close calendar (working day four of six, the deadline,
materiality at £25,000), the comparison period, and the group companies. It does not see the label, the
planted counts, or which team owns the account.

**The teams live in the owner question's own options, not in the state.** That is deliberate: if the
account carried its owning team, four of the questions would collapse into copying a field. Instead the
question lists what each team covers — payables, receivables, treasury, tax, financial control — and
the answer has to come from reading the account and the problem. Three blockers are where that gets
interesting, because the blocker decides the owner rather than the account does: an unsupported journal
is the controller's wherever it sits, a missing invoice is payables', and a revaluation is treasury's
even when the balance belongs to receivables.

## How it is graded

- **Blockers found** only counts an account that was held back *and* named for the right reason.
- **Supported accounts left alone** is the counterweight, and it is reported next to it, always.
- **Owner agreement** is measured on blockers only. Sending a clean account to the right team is not an
  achievement; sending a blocker to the wrong one costs a day of the close.
- **Close readiness** is the share of accounts cleared, with the number of real blockers hiding inside
  that figure printed beside it. A readiness number that quietly includes a missed blocker is worse
  than no number.
- **The severity bar** is the practical output: for each bar from 0 to 6 it shows how many accounts a
  person opens, how many are real, and what share of that queue is worth their time.

## What the recorded run found

Not recorded yet. The estimate for the run is about 60 requests, 42K input and 15K output tokens,
roughly two minutes.
