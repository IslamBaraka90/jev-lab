# 161 · Screening for a goal

**Domain:** Screening · **Data:** cached-real fundamentals and prices · **View:** table · **Items:** 16 symbols × 6 goals · **Questions:** 5

## Value

Say the goal in words, and get candidates judged against it, with the reason each one made or missed the list.

## Demo flow

1. Pick a goal from six written briefs: income with shallow drawdowns, quality compounding, deep value, inflation hedge, low-volatility defensive, turnaround.
2. Every symbol in the universe is judged against that brief.
3. A shortlist forms, with the disqualifier shown for everything excluded.
4. The report compares the six goals: how the same universe reorders when the brief changes.

## Data

- **Cached-real:** `data/market/fundamentals/<SYMBOL>.json` and `candles/<SYMBOL>.json` for the 16 symbols in the manifest, covering four years of annual statements and ten years of prices.
- **Synthetic:** only the six goal briefs, written for the demo.
- No labels; this demo has no ground truth and the report says so. The check is consistency: does the same symbol move as the brief changes, and do the disqualifiers match the numbers?

## State

The symbol's statements (revenue, margins, debt, cash, cash flow, dividends, shares outstanding), price-derived measures (drawdown, volatility, trend), sector and size, and the goal brief in full. Nothing about the other candidates.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `fit_to_goal` | score 0–6 | Unsuitable · Poor · Weak · Acceptable · Good · Very good · Ideal |
| `disqualifier` | choice | `LEVERAGE` · `LIQUIDITY` · `EARNINGS_QUALITY` · `VALUATION` · `VOLATILITY` · `NONE` |
| `shortlist` | yes/no | – |
| `evidence_strength` | score 0–6 | None · Very weak · Weak · Moderate · Strong · Very strong · Conclusive |
| `data_sufficient` | yes/no | Is there enough in the statements to judge this? |

## Report

The shortlist per goal, the same 16 symbols ranked six ways, disqualifier distribution, a consistency check (a symbol that is ideal for income and ideal for deep value gets flagged for review), and the symbols where data was insufficient.

## Files

Standard demo folder plus a goals file `demos/goal-screening/goals.json`.

## Acceptance

Template list, plus:

- [ ] The page says clearly that there is no ground truth here, and what is checked instead.
- [ ] Missing fundamental fields are handled and surfaced through `data_sufficient`, not silently zeroed.
- [ ] Switching goals re-runs from recorded fixtures with no network call.

## Video beats

- One symbol, two goals, two opposite verdicts, with the briefs on screen.
- The consistency check catching a symbol that claims to fit everything.
- A symbol excluded for leverage, with the debt line highlighted.

## Notes

Real company data with no outcome labels: the page must not imply a recommendation. The standard research-only line applies.
