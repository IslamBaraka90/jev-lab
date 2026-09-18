# 125 · Mule networks

**Domain:** Fraud · **Data:** synthetic (seed 1125) · **View:** graph · **Items:** 120 accounts · **Questions:** 5

## Value

Find the accounts that only exist to move other people's money, and the role each one plays.

## Demo flow

1. A transfer graph opens: accounts as nodes, transfers as edges, sized by amount.
2. Selecting an account shows its neighbourhood and a fan-in and fan-out summary.
3. The model assigns a role and a confidence, and the graph colours in as the run proceeds.
4. The report reconstructs the planted networks and shows which ones were found whole.

## Data

- `demos/mule-network/data.json` — 120 accounts, 900 transfers over 30 days. Three planted networks: a classic fan-in to one collector, a two-layer chain with pass-through timing, and a payroll-shaped decoy that looks like fan-out but is a legitimate small employer.
- Each account: opening date, KYC level, declared income, device overlaps, and its transfers with timestamps, amounts and channels.
- Planted roles: 3 collectors, 14 mules, 4 originators, and 99 ordinary accounts, 12 of which touch a network innocently.
- Labels: `{ accountId, role, networkId }`.

## State

The account, its counterparties with amounts and timing, aggregate fan-in and fan-out, the time between money in and money out, device and address overlaps with other accounts, and the bank's baseline for accounts of that age. No label, no network id.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `role` | choice | `COLLECTOR` · `MULE` · `ORIGINATOR` · `UNRELATED` |
| `pass_through` | yes/no | Does money leave almost as fast as it arrives? |
| `network_confidence` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `action` | choice | `MONITOR` · `RESTRICT_OUTBOUND` · `FREEZE` · `NO_ACTION` |
| `income_consistent` | yes/no | Is the flow consistent with the declared income? |

## Report

Roles against labels, networks recovered whole or in part, the payroll decoy and whether it was left alone, pass-through timing distribution, and the money that would have been held under the model's actions.

## Files

Standard demo folder plus `scripts/generate/mule-network.js` and the `graph` view.

## Acceptance

Template list, plus:

- [ ] The graph view highlights the selected account's neighbourhood and dims the rest.
- [ ] Network recovery is measured per network, not only per account.
- [ ] The payroll decoy is described in `notes.md` and shown in the video beats.

## Video beats

- The fan-in collector lighting up as its mules are classified.
- The payroll decoy staying grey.
- Pass-through timing: money in at 10:02, out at 10:09.

## Notes

The graph view is shared with 133 and 174. Build it here, keep it generic: nodes, edges, one selection, one highlight.
