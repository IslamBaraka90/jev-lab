# Entity links

- Seed 1174 creates 90 fictional entities and 400 candidate pairs with dated evidence.
- Six two-edge fund → holding → supplier chains are planted, alongside 12 name coincidences and 20 relationships that existed but ended.
- Jev receives both complete entity profiles and every dated evidence snippet. Relationship, active-status, chain and coincidence labels never enter the state.
- All entities and evidence are fictional; the graph is a teaching dataset, not a claim about real people or companies.
- Recorded all 400 pairs with `jev-1.13.0` on 2026-09-19 (337,357 input tokens and 63,246 output tokens).
- Jev classified all 400 relationship types and all relationship active statuses correctly. It rejected all 12 name coincidences and caught all 20 ended relationships without losing relationship-type credit.
- All six planted fund → holding → supplier chains were recovered. Jev’s answers alone produced 279 active sufficient edges and 3,520 directed two-step contagion paths; labels are used only to grade the six planted chains.
