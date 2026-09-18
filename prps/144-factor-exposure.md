# 144 · Factor and sector exposure

**Domain:** Portfolio · **Data:** synthetic holdings + cached-real prices (seed 1144) · **View:** table · **Items:** 30 portfolios · **Questions:** 5

## Value

Say what a portfolio is actually betting on, including the bets nobody meant to make.

## Demo flow

1. A portfolio opens with holdings, sectors and a one-line description of what the owner thinks they hold.
2. The model names the dominant exposure, the unintended one, and how strong each is.
3. Portfolios sort by the gap between belief and exposure.
4. The report checks the calls against the planted exposures and shows the biggest surprises.

## Data

- **Cached-real:** prices, sectors and 12-month behaviour for every holding, so factor talk is grounded in real co-movement.
- **Synthetic:** 30 portfolios, each with a stated belief and a planted true exposure: a "diversified income" book that is a rates bet, a "defensive" book full of momentum, a "domestic" book with half its revenue abroad, a "tech-free" book that still moves with tech.
- Labels: `{ portfolioId, dominantFactor, unintendedFactor }`.

## State

Holdings with weights, sectors, currencies, revenue geography where known, 12-month co-movement summary computed from cached prices, and the owner's stated belief in one sentence. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `dominant_factor` | choice | `MOMENTUM` · `VALUE` · `QUALITY` · `SIZE` · `RATES` · `ENERGY` · `FX` |
| `unintended_exposure` | choice | same list · `NONE` |
| `exposure_strength` | score 0–6 | None · Very weak · Weak · Moderate · Strong · Very strong · Dominant |
| `belief_matches_holdings` | yes/no | – |
| `single_factor_portfolio` | yes/no | – |

## Report

Dominant and unintended factor accuracy, the belief-versus-reality gap per portfolio, exposure strength distribution, and the five portfolios with the widest gap, clickable.

## Files

Standard demo folder plus `scripts/generate/factor-exposure.js`.

## Acceptance

Template list, plus:

- [ ] Co-movement in the state comes from real price history, not a made-up correlation matrix.
- [ ] Both factor answers are graded, and the unintended one is reported separately.
- [ ] "Belief matches holdings" is shown as its own accuracy line.

## Video beats

- The "tech-free" portfolio that still moves with tech, with the co-movement numbers on screen.
- The income book answered as a rates bet.
- The gap chart across 30 portfolios.

## Notes

Factor names here are plain-language buckets, not a commercial risk model. Say that on the page so nobody reads it as a licensed factor decomposition.
