# 141 · Portfolio health

**Domain:** Portfolio · **Data:** synthetic holdings + cached-real prices (seed 1141) · **View:** table · **Items:** 24 portfolios · **Questions:** 5

## Value

Hand over a list of holdings and get back the problems, ranked, with what to do about each.

## Demo flow

1. A portfolio opens: holdings with weights, sectors, currencies and liquidity, plus a stated objective.
2. The model names the biggest risk, grades it, and proposes an action.
3. Portfolios sort by severity, and the selected one shows its weights and overlaps.
4. The report shows which risks the model found across all 24, against the ones the generator built in.

## Data

- **Cached-real:** prices, sectors and average volumes from `data/market` for the symbols used, so weights, volatility and liquidity are genuine.
- **Synthetic:** 24 portfolios built to carry specific problems — 5 concentrated in one name, 4 with hidden correlation (different tickers, one factor), 3 with an illiquid tail, 4 with an unintended currency bet, 3 that drifted far from their stated targets, and 5 healthy ones.
- Labels: `{ portfolioId, plantedRisk }`.

## State

Holdings with weights, sector and currency, each position's share of average daily volume, the portfolio's stated objective and target allocation, and 12-month return and volatility per holding computed from the cached prices. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `main_risk` | choice | `CONCENTRATION` · `CORRELATION` · `LIQUIDITY` · `CURRENCY` · `DRIFT` · `NONE` |
| `severity` | score 0–6 | None · Slight · Mild · Notable · Serious · Severe · Critical |
| `action` | choice | `HOLD` · `TRIM` · `HEDGE` · `REBALANCE` |
| `fits_objective` | yes/no | – |
| `diversified_in_name_only` | yes/no | – |

## Report

Risk identification against labels, severity distribution, the five healthy portfolios and whether they were left alone, and a table of every portfolio with its found risk and action.

## Files

Standard demo folder plus `scripts/generate/portfolio-health.js`.

## Acceptance

Template list, plus:

- [ ] Volatility, correlation inputs and liquidity come from cached real prices, and the page badges them as such.
- [ ] The correlation portfolios are genuinely correlated in the price data, not just labelled that way.
- [ ] Healthy portfolios are graded separately, as a false-alarm rate.

## Video beats

- A portfolio with ten holdings that is really one bet, answered as "diversified in name only".
- The illiquid tail: one position at 4 days of average volume.
- The healthy portfolio that gets a clean read.

## Notes

This is the first demo that mixes real and synthetic data; the two data chips appear side by side and the video explains the split once.
