# 135 · Sybil clusters

**Domain:** Crypto · **Data:** synthetic (seed 1135) · **View:** graph · **Items:** 150 wallets · **Questions:** 4

## Value

Find the wallets that are really one person before an allocation goes out.

## Demo flow

1. Wallets appear with their funding sources, timing patterns and route similarity.
2. The model judges whether a wallet belongs to a cluster and what links it.
3. Clusters form on the graph as the run proceeds.
4. The report compares the clusters found with the planted ones and shows the allocation saved.

## Data

- `demos/sybil-clusters/data.json` — 150 fictional wallets, of which 62 belong to 8 planted clusters built with the signals farmers actually leave: funded from one source, created minutes apart, identical action sequences, gas prices copied to the wei, and withdrawal to a shared endpoint.
- Decoys: 12 unrelated wallets that share a funding exchange, and 6 genuinely independent users with similar behaviour because they followed the same guide.
- Labels: `{ wallet, clusterId | null, linkingSignal }`.

## State

The wallet's funding path, creation time, action sequence, gas statistics, and a similarity summary against the population (not against specific wallets, so the model has to reason from the pattern). No label, no cluster id.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `sybil_likelihood` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `linking_signal` | choice | `FUNDING_SOURCE` · `CREATION_TIMING` · `ACTION_SEQUENCE` · `GAS_PATTERN` · `WITHDRAWAL_ENDPOINT` · `NONE` |
| `exclude_from_allocation` | yes/no | – |
| `independent_user` | yes/no | – |

## Report

Cluster recovery against labels (wallets found per planted cluster), false exclusions among the decoys, linking-signal accuracy, allocation saved at the chosen threshold, and the tradeoff curve between savings and wrongly excluded users.

## Files

Standard demo folder plus `scripts/generate/sybil-clusters.js`; reuses the graph view.

## Acceptance

Template list, plus:

- [ ] The graph groups wallets by the cluster the model assigns, not by the label.
- [ ] Decoy exclusions are counted and shown next to the savings.
- [ ] `notes.md` explains why "followed the same guide" is the hardest case.

## Video beats

- Eight clusters forming as wallets are classified.
- The shared-exchange decoy staying independent.
- Savings against wrongly excluded users, as one number each.

## Notes

Closes the crypto block. Between 131, 132, 133 and this, the graph view earns its keep, so build it once and well in 125.
