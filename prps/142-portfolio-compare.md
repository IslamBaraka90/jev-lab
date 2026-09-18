# 142 · Portfolio compare

**Domain:** Portfolio · **Data:** synthetic holdings + cached-real prices (seed 1142) · **View:** table (two columns) · **Items:** 18 pairs · **Questions:** 5

## Value

Put two portfolios side by side against one goal and get a reasoned pick, not a performance table.

## Demo flow

1. Two portfolios open side by side with a stated goal above them.
2. The model answers which fits the goal better, where they differ most, and what the loser would need to change.
3. Pairs sort by how decisive the answer was.
4. The report shows the picks against the generator's intended answer, and the pairs where the model refused to be decisive.

## Data

- **Cached-real:** prices and sectors for every holding.
- **Synthetic:** 18 pairs with a stated goal each — income, capital preservation, growth, inflation hedge, low drawdown. Twelve pairs have a defensible right answer built in; four are close calls; two are traps where the better-looking returns come with a risk the goal forbids.
- Labels: `{ pairId, betterFit, reason }`.

## State

Both portfolios with weights, sectors, currencies and liquidity, the goal in words with its constraints, and 12-month return, volatility and drawdown per holding from the cached prices. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `better_fit` | choice | `PORTFOLIO_A` · `PORTFOLIO_B` · `TOO_CLOSE` |
| `biggest_difference` | choice | `CONCENTRATION` · `SECTOR_MIX` · `CURRENCY` · `LIQUIDITY` · `INCOME` · `DRAWDOWN_RISK` |
| `decisiveness` | score 0–6 | Indistinguishable · Marginal · Slight · Clear · Strong · Very strong · Overwhelming |
| `goal_constraint_breached` | yes/no | Does either portfolio break a constraint in the goal? |
| `one_change_would_flip_it` | yes/no | – |

## Report

Picks against labels, the close calls and whether the model said "too close", the two traps, and a difference matrix showing which dimension separated each pair.

## Files

Standard demo folder plus `scripts/generate/portfolio-compare.js`; reuses the lab's compare layout.

## Acceptance

Template list, plus:

- [ ] "Too close" counts as correct on the four close calls and wrong on the twelve decisive ones.
- [ ] The goal's constraints are explicit in the state, so a breach is checkable.
- [ ] The two columns stay aligned row by row at 1080p.

## Video beats

- The trap pair: better returns, breaks the drawdown constraint, loses.
- A close call answered as "too close", with the decisiveness score at 1 of 6.
- The difference matrix across all 18 pairs.

## Notes

This is the demo people asked for by name; keep the goal sentence prominent on screen, since it is what the answer hangs on.
