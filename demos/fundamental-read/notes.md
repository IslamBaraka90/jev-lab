# Fundamental read

- Sixteen symbols use the committed Yahoo Finance fundamental cache fetched on 2026-09-19.
- Twelve operating companies have four comparable annual statements. `JPM` and `BAC` are missing required cash-flow lines, and `XOM` is missing required balance-sheet lines, leaving nine fully computable ratio comparisons. `BTC-USD`, `GLD`, `XLE` and `SPY` have no issuer statements in this cache and remain visible as short-history gaps.
- Quarterly statements were unavailable from the cached provider response and are reported as zero cached periods.
- Jev receives raw statement lines, fiscal dates, currency, sector and coverage only. The report-only cross-checks come from `src/services/ratios.js`.
