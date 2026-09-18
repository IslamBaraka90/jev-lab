# 163 · Sharia screen

**Domain:** Screening · **Data:** cached-real fundamentals · **View:** table (ratio checklist) · **Items:** 16 symbols · **Questions:** 6

## Value

Run a company through an activity screen and the financial ratios of a chosen standard, and show every step of the verdict.

## Demo flow

1. Pick a standard from the ones the demo ships, each with its own thresholds and denominator choice.
2. A symbol opens with its business description and the balance-sheet lines each ratio needs.
3. The model judges the activity screen and each ratio, then gives an overall verdict.
4. The report shows the verdict per symbol per standard, and where the standards disagree.

## Data

- **Cached-real:** business description, revenue split where available, total debt, cash and interest-bearing securities, receivables, total assets and market capitalisation.
- **Shipped with the demo:** two or three named rule sets as JSON — thresholds and denominators — written from published standards and clearly attributed in `notes.md`, plus a "house rules" set the viewer can read.
- No outcome labels. The check is arithmetic: every ratio the model judges is also computed by the demo, and the two are shown together.

## State

The business description and revenue lines, the balance-sheet items, the market capitalisation, and the selected standard's rules in full, including which denominator to use. No precomputed ratio.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `activity_compliant` | yes/no | Does the core business pass the activity screen? |
| `debt_ratio_pass` | yes/no | – |
| `interest_securities_pass` | yes/no | – |
| `receivables_pass` | yes/no | – |
| `impure_income_band` | choice | `NONE` · `UNDER_1_PERCENT` · `1_TO_5_PERCENT` · `OVER_5_PERCENT` · `UNKNOWN` |
| `verdict` | choice | `COMPLIANT` · `NON_COMPLIANT` · `NEEDS_SCHOLAR_REVIEW` |

## Report

Verdicts per symbol per standard, agreement between the model's ratio answers and the computed ratios, the symbols that flip between standards, and the ones sent to scholar review.

## Files

Standard demo folder plus `demos/sharia-screen/standards.json` and `src/services/ratios.js` (from 162).

## Acceptance

Template list, plus:

- [ ] Each shipped rule set names its source in `notes.md`, and the page shows which one is selected.
- [ ] Every ratio answer is displayed next to the computed value, so an error is visible.
- [ ] The page carries the caveat: an illustration of a screening process, not a fatwa or a compliance certification.
- [ ] Purification is a band, never a currency amount presented as advice.

## Video beats

- One symbol passing the activity screen and failing on debt, with the line highlighted.
- The same symbol under two standards, with different verdicts, and the denominators side by side.
- A symbol sent to scholar review because the revenue split is missing.

## Notes

The most sensitive demo in the set after 124. Wording is reviewed before recording: process illustration, chosen standard named on screen, no ruling implied.
