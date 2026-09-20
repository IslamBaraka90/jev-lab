# AML alert triage

Three hundred transaction-monitoring alerts from an invented bank, and two analysts who can work about
fifty a week properly. The demo closes, monitors or escalates, and names the pattern if there is one.

**Illustrative synthetic data. Not a substitute for a regulated monitoring system, and not a filing
decision.** Nothing here decides that anything is reported to an authority; the wording stops at
escalate, and that line travels with the report on the page.

## The data

`scripts/generate/aml-alert-triage.js`, seed 1123. Every customer, counterparty and payment is invented.
Each alert carries the scenario that fired it, the triggering payments, ninety days of account activity
(counts, totals, counterparties, cash share, corridor), what the customer told the bank they would do,
the onboarding risk rating, earlier alerts and how they ended, and the relationship file note.

**Twelve alerts are worth an analyst's time**, in four patterns: four structuring (eight to eleven cash
credits, each a few hundred under the £3,000 reporting threshold, from customers whose expected monthly
turnover is smaller than the week's takings), three mule accounts (money from a crowd of individuals,
gone again the same day), three trade-based (invoices that do not match the shipping papers, into a
corridor the bank rates high), and two third-party funded (a company nobody can connect to the customer).

**Thirty alerts are spikes with the explanation already in the file**: eight property sales, eight
bonuses or redundancy payments, eight seasonal businesses that triple every August, and six accounts
collecting money for a wedding. Each one is as far above expected turnover as the planted cases, and
each one carries its explanation in the relationship note or the counterparty name.

The other 258 are thresholds doing what thresholds do.

## What the recorded run found

300 answers on 19 September 2026, model `jev-1.13.0`, 390,635 input and 64,807 output tokens, about
seventeen minutes.

- **The queue was cut by 73%, from 300 alerts to 80, keeping all twelve worth working.** Every one of
  the four typologies was named correctly on all twelve.
- **Nothing worth working was closed or left under watch.** All twelve are in the escalated eighty.
- **Twenty-one of the thirty explained spikes were closed.** The nine that stayed are the six weddings and
  three property sales — the cases where the explanation is a pattern of small credits from family names
  rather than a single credit with a solicitor's reference on it.
- **A hundred and eighty-two alerts were left under watch**, neither worked nor closed. That lane is
  free today and it is where the model put most of its doubt; an operation would need a rule for what
  happens to it.
- **Every escalation names what would settle it**, and 74 of the 80 ask for the same thing: the business
  purpose of the payments. That is a request an analyst can send without reading the file first, which
  is the most directly useful thing in this run.

## The honest caveat

The false-positive cost here is 68 alerts escalated alongside the twelve: 63 everyday ones and 5 explained spikes. At 80 alerts against
a stated capacity of fifty a week, this is a workable queue rather than a solved one, and the 73% cut is
the number to quote — never on its own, always with the catch rate beside it.
