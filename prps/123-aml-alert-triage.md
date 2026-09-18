# 123 · AML alert triage

**Domain:** Fraud · **Data:** synthetic (seed 1123) · **View:** queue · **Items:** 300 alerts · **Questions:** 5

## Value

Cut a transaction-monitoring queue to the alerts worth an analyst's time, with the typology named.

## Demo flow

1. Alerts arrive from named scenarios: structuring, rapid movement, high-risk corridor, dormant reactivation.
2. The model reads each alert with 90 days of account activity and the customer's profile.
3. Alerts sort into close, monitor and escalate, each with a typology.
4. The report shows the true positives kept, the queue cut, and the escalations a compliance team would sign off.

## Data

- `demos/aml-alert-triage/data.json` — 300 alerts across 210 customers. Each: the scenario that fired, the triggering transactions, 90-day activity summary (counts, amounts, counterparties, channels), the customer's stated business and expected activity, onboarding risk rating, and prior alert outcomes.
- Planted: 12 true positives (4%) across structuring, mule activity, trade-based layering and unexplained third-party funding. Plus 30 explainable spikes: a property sale, a bonus, a business with genuinely lumpy seasonality, a wedding.
- Labels: `{ alertId, truePositive: true|false, typology }`.

## State

The alert and its scenario, the activity summary, the customer profile and expected activity, prior alert history with outcomes, and the corridor's risk rating. No label, no suspicious-activity conclusion.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `typology` | choice | `STRUCTURING` · `LAYERING` · `MULE_ACTIVITY` · `TRADE_BASED` · `THIRD_PARTY_FUNDING` · `NONE` |
| `activity_explained` | yes/no | Does the customer's stated profile explain this? |
| `suspicion` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `disposition` | choice | `CLOSE` · `MONITOR` · `ESCALATE` |
| `information_missing` | choice | `SOURCE_OF_FUNDS` · `COUNTERPARTY_IDENTITY` · `BUSINESS_PURPOSE` · `NONE` |

## Report

Queue reduction at a fixed catch rate, true positives kept and lost, typology accuracy, the explainable spikes and how many were closed, and the "information missing" split, which is the practical output for an analyst.

## Files

Standard demo folder plus `scripts/generate/aml-alert-triage.js`.

## Acceptance

Template list, plus:

- [ ] Nothing in the demo calls an alert a suspicious activity report; the wording stays at escalate or close.
- [ ] Queue reduction is always reported with the catch rate that produced it.
- [ ] The page carries the caveat line from `notes.md` about this being illustrative, not a compliance tool.

## Video beats

- A structuring pattern: nine deposits under a reporting threshold, escalated.
- The property sale that explains a spike, closed with the reason.
- Queue cut from 300 to 41 with 11 of 12 true positives kept.

## Notes

Compliance wording matters. The page must say: illustrative synthetic data, not a substitute for a regulated monitoring system or a filing decision.
