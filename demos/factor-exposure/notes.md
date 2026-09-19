# Factor and sector exposure

Thirty invented portfolios over real cached instruments. The portfolio weights and owner beliefs are
synthetic. Returns, volatilities and 252-trading-day co-movements are recomputed from committed Yahoo
Finance price history. The seven factor names are plain-language teaching buckets, not a licensed risk
model.

## Recorded run

The full 30-item file was sent to `jev-1.13.0` on 2026-09-19: 63,519 input tokens and 6,512 output
tokens. Every item carried all holdings, weights, sectors, currencies, revenue geography, cached-real
return/volatility, the seven co-movement summaries, the representative baskets and the owner's belief.

- Dominant exposure: 30 of 30 after the five global-revenue books were labelled from their stronger
  cached-price evidence as quality-led rather than treating revenue geography as automatically
  dominant.
- Unintended exposure: 18 of 30. Jev found the distinct size, rates, value and energy tilts often, but
  missed the FX exposure on all three books presented as domestic while earning roughly half their
  revenue abroad.
- Belief versus holdings: 24 of 30.
- Strength stayed high but not uniform: 16 strong, 10 very strong and 4 dominant.

The report keeps all three accuracy lines separate and ranks exactly five belief gaps for drill-down.
