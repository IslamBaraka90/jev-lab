# Fundamental read

- Sixteen symbols use the committed Yahoo Finance fundamental cache fetched on 2026-09-19.
- Twelve operating companies have four comparable annual statements. `JPM` and `BAC` are missing required cash-flow lines, and `XOM` is missing required balance-sheet lines, leaving nine fully computable ratio comparisons. `BTC-USD`, `GLD`, `XLE` and `SPY` have no issuer statements in this cache and remain visible as short-history gaps.
- Quarterly statements were unavailable from the cached provider response and are reported as zero cached periods.
- Jev receives raw statement lines, fiscal dates, currency, sector and coverage only. The report-only cross-checks come from `src/services/ratios.js`.
- Recorded all 16 cases with `jev-1.13.0` on 2026-09-19 (32,685 input tokens and 3,298 output tokens).
- On the nine ratio-complete companies, Jev agreed with the transparent cross-check on 7 earnings-quality categories, 8 direction categories, 8 leverage bands and 8 capex-discipline calls. The report keeps the NVDA, PG and JNJ disagreements visible with both answers.
- Statement-gap classification was exact on 14 of 16 symbols. Jev treated JPM and BAC as usable despite missing cash-flow lines; both remain visibly flagged by the deterministic coverage check.
