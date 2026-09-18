# 124 · Sanctions name matching

**Domain:** Fraud · **Data:** synthetic (seed 1124) · **View:** table (side by side) · **Items:** 200 candidate matches · **Questions:** 5

## Value

Decide whether a screening hit is the same person, and say which piece of evidence settled it.

## Demo flow

1. Each item puts the customer record next to the list entry it matched.
2. The model judges identity, names the deciding evidence, and says what else it would need.
3. Hits sort into clear, review and confirm.
4. The report shows false positives cleared, true matches kept, and the evidence that did the work.

## Data

- `demos/sanctions-name-match/data.json` — 200 candidate pairs against a **fictional** watchlist generated for this demo. Each pair: customer name, date of birth, nationality, address, identifier fragments; list entry with aliases, transliterations, dates, nationalities and a program name.
- Planted: 18 true matches, and false positives built from the things that actually cause them — transliteration variants of Arabic and Cyrillic names, common surnames, father-and-son pairs sharing a name, a date of birth that differs by one digit, and a city that matches while the country does not.
- Labels: `{ pairId, sameEntity: true|false, decidingField }`.

## State

Both records in full, the list's matching rules (which fields are required, which are advisory), and the fuzzy score the screening engine produced. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `same_entity` | yes/no | – |
| `deciding_evidence` | choice | `DATE_OF_BIRTH` · `NATIONALITY` · `ADDRESS` · `IDENTIFIER` · `NAME_FORM_ONLY` · `INSUFFICIENT` |
| `match_strength` | score 0–6 | No resemblance · Weak · Possible · Likely · Strong · Very strong · Identical |
| `disposition` | choice | `CLEAR` · `REVIEW` · `CONFIRM` |
| `needs_more_data` | yes/no | – |

## Report

False positives cleared and true matches kept, accuracy on the deciding field, a breakdown by cause (transliteration, common surname, date differences), and the items where the model asked for more data rather than deciding.

## Files

Standard demo folder plus `scripts/generate/sanctions-name-match.js` and a fictional list file `data/synthetic/watchlist.json`.

## Acceptance

Template list, plus:

- [ ] The watchlist is entirely fictional and labelled as such in the data file, on the page and in `notes.md`.
- [ ] No real sanctions list, program name or designated person appears anywhere.
- [ ] Items where the right answer is "insufficient" are graded as correct when the model says so.

## Video beats

- Two transliterations of the same name, cleared on nationality.
- Father and son: same name, 26 years apart, cleared on date of birth.
- A true match confirmed on an identifier fragment.

## Notes

Highest-sensitivity demo in the set. The page says plainly: fictional list, illustrative only, never a screening decision.
