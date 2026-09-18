# 166 · Peer valuation

**Domain:** Screening · **Data:** cached-real fundamentals and prices · **View:** table (peer grid) · **Items:** 4 peer sets · **Questions:** 5

## Value

Ask which name in a peer group is actually cheap, and whether the premium or discount is deserved.

## Demo flow

1. A peer set opens as a grid: four to five companies, their multiples and the fundamentals behind them.
2. The model picks the best value in the set, judges whether the premium is earned, and names the reason for the discount.
3. Peer sets cycle, and each answer carries its probabilities.
4. The report lays the four sets side by side with the reasoning summarised.

## Data

- **Cached-real:** statements and prices for four peer sets built from the manifest symbols: large-cap tech, banks, energy, staples.
- **Computed by the demo:** price to earnings, price to book, price to free cash flow, EV proxy, margin and growth — displayed, but not sent in the state, so the model reads statements rather than multiples.
- No outcome labels; the check is internal consistency and agreement with the computed multiples where the reasoning claims cheapness.

## State

Each peer's statements, share count and price, the sector, and the set's membership. No multiples, no rankings.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `best_value` | choice | the peers in the set |
| `premium_justified` | yes/no | For the most expensive peer |
| `discount_reason` | choice | `GOVERNANCE` · `GROWTH` · `CYCLICAL_TROUGH` · `BALANCE_SHEET` · `NO_DISCOUNT` |
| `confidence_in_ranking` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |
| `comparable_set` | yes/no | Are these companies genuinely comparable? |

## Report

The pick per set against the computed cheapest on each multiple, where the model's pick differs from the raw multiples and why, discount reasons, and the sets the model said were not comparable.

## Files

Standard demo folder plus `demos/peer-valuation/sets.json`; reuses `src/services/ratios.js`.

## Acceptance

Template list, plus:

- [ ] The state contains no multiple, and a contract test asserts it.
- [ ] Every pick is shown beside the computed cheapest, with the disagreements listed.
- [ ] "Comparable set" is asked, because one of the four sets is deliberately loose.

## Video beats

- The cheapest on price to earnings that the model does not pick, and its reason.
- The premium peer judged as earning it, with the margin trend beside it.
- The loose peer set, called out as not comparable.

## Notes

Closes the screening block. Real companies, no recommendation: the research-only line stays on the page.
