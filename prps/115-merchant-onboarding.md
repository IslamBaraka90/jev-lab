# 115 · Merchant onboarding risk

**Domain:** Orders · **Data:** synthetic (seed 1115) · **View:** table (application) · **Items:** 140 applications · **Questions:** 5

## Value

Underwrite a new merchant from its application, website and documents, and set the reserve that makes the risk acceptable.

## Demo flow

1. An application opens: business details, expected volume, category, website copy, documents and bank details.
2. The model assigns a risk tier, flags prohibited activity, doubts documents where it should, and proposes a reserve.
3. Applications sort into approve, review and decline lanes.
4. The report compares decisions with the labelled outcomes: which merchants later went bad.

## Data

- `demos/merchant-onboarding/data.json` — 140 applications with a plausible spread of categories: retail, services, digital goods, travel, supplements, dropshipping, crypto adjacent, adult adjacent, gambling adjacent.
- Each carries: legal name and trading name mismatch, registration age, directors, expected monthly volume and average ticket, refund policy text, website excerpt, bank account country, document list with quality notes.
- Planted: 11 merchants that later produced heavy chargebacks, 6 that were prohibited from the start, 5 with forged-looking documents, and 9 that look risky on paper and turned out fine.
- Labels: `{ applicationId, outcome: GOOD|CHARGEBACK_HEAVY|PROHIBITED|FRAUD }`.

## State

The application in full, the acquirer's prohibited list and category rules, the expected volume bands, and the document checklist. No label, no later outcome.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `risk_tier` | choice | `LOW` · `MEDIUM` · `HIGH` · `PROHIBITED` |
| `prohibited_match` | yes/no | – |
| `document_doubt` | score 0–6 | None · Slight · Mild · Notable · Serious · Severe · Certain forgery |
| `reserve` | choice | `NONE` · `FIVE_PERCENT` · `TEN_PERCENT` · `TWENTY_PERCENT` · `ROLLING_HOLD` |
| `decision` | choice | `APPROVE` · `REVIEW` · `DECLINE` |

## Report

Decisions against labelled outcomes, missed bad merchants, declined good merchants, reserve coverage against the chargebacks that actually happened, and the nine decoys with their fate.

## Files

Standard demo folder plus `scripts/generate/merchant-onboarding.js`.

## Acceptance

Template list, plus:

- [ ] Volume expectations in the state are used in the reserve reasoning, and `notes.md` shows the link.
- [ ] Prohibited-category matches are graded exactly, with no partial credit.
- [ ] The report shows both missed bad merchants and declined good ones, never one alone.

## Video beats

- The dropshipper with a 30-day delivery promise and a thin website, put on a rolling hold.
- A supplements merchant declined on the prohibited list, with the matching line highlighted.
- The decoy that was approved and turned out fine.

## Notes

Category rules are illustrative, not any acquirer's real policy; keep that line on the page.
