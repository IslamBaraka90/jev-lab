# 174 · Entity links

**Domain:** News · **Data:** synthetic (seed 1174) · **View:** graph · **Items:** 400 entity pairs · **Questions:** 5

## Value

Turn scattered mentions into a map: who owns, supplies, sits on the board of, or is suing whom, and how much it matters.

## Demo flow

1. A pair of entities appears with the evidence that connects them: filing lines, news sentences, ownership tables.
2. The model names the relationship, grades its strength, and says whether trouble would travel along it.
3. The graph builds as pairs are judged, with edge thickness from strength.
4. The report reconstructs the planted network and shows what contagion paths the model would warn about.

## Data

- `demos/entity-links/data.json` — 90 fictional entities (companies, funds, individuals) and 400 candidate pairs with evidence snippets. Relationship types planted: ownership stakes, board seats, supplier concentration, customer concentration, litigation, shared auditor, and none.
- Planted: 6 contagion chains (a supplier two steps from a fund's largest holding), 12 pairs where the evidence is a coincidence of names, and 20 pairs where the relationship existed but ended.
- Labels: `{ pairId, relationship, active, chainId }`.

## State

Both entity profiles, the evidence snippets with dates and sources, and the entity types. No label, no graph position.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `relationship` | choice | `OWNERSHIP` · `BOARD_SEAT` · `SUPPLIER` · `CUSTOMER` · `LITIGATION` · `SHARED_AUDITOR` · `NONE` |
| `still_active` | yes/no | – |
| `strength` | score 0–6 | None · Trivial · Weak · Moderate · Strong · Very strong · Controlling |
| `contagion_risk` | yes/no | Would trouble at one side reach the other? |
| `evidence_sufficient` | yes/no | – |

## Report

Relationship accuracy, the name-coincidence pairs and whether they were rejected, ended relationships caught, chains recovered, and a contagion view: pick an entity and see what the model says is two steps away.

## Files

Standard demo folder plus `scripts/generate/entity-links.js`; reuses the graph view from 125.

## Acceptance

Template list, plus:

- [ ] Ended relationships are graded on `still_active`, not counted as wrong relationships.
- [ ] The contagion view is built only from answers, never from the labels.
- [ ] Entities are fictional and the page says so.

## Video beats

- Two entities linked by a supplier line in one filing sentence.
- A name coincidence rejected with "evidence insufficient".
- The contagion path: fund → holding → supplier, two steps, flagged.

## Notes

This is the third graph demo; by now the view is proven, so the build is mostly data and copy.
