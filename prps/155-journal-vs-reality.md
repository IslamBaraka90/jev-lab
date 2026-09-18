# 155 · Journal versus reality

**Domain:** Trades · **Data:** synthetic (seed 1155) · **View:** table (note beside fills) · **Items:** 200 journal entries · **Questions:** 5

## Value

Compare what a trader wrote with what they actually did, and find where the story drifts.

## Demo flow

1. A journal note sits beside the trade record it belongs to.
2. The model decides whether the note describes the trade, and names the drift.
3. Entries sort by how far the story is from the fills.
4. The report shows which kinds of drift repeat, and whether they cluster after losses.

## Data

- `demos/journal-vs-reality/data.json` — 200 pairs of a written note and its trade record. Notes are written in the voice of a real journal: short, occasionally defensive.
- Planted drift: 22 size drifts ("small starter position", filled at full size), 18 entry drifts ("waited for the pullback", filled at the breakout), 14 exit drifts ("took profit at target", exited early), 11 instrument drifts (note names a different symbol), 9 after-the-fact rationalisations (the note describes a plan that could not have existed before entry), and 126 honest notes.
- Labels: `{ entryId, drift }`.

## State

The note as written, the trade record with times, prices, sizes and levels, and the trader's stated rules. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `note_matches_trade` | yes/no | – |
| `drift_type` | choice | `SIZE` · `ENTRY` · `EXIT` · `INSTRUMENT` · `RATIONALISATION` · `NONE` |
| `note_honesty` | score 0–6 | Fabricated · Very loose · Loose · Partly accurate · Accurate · Very accurate · Precise |
| `written_after_the_fact` | yes/no | – |
| `rule_followed` | yes/no | Did the trade follow the trader's own stated rules? |

## Report

Drift accuracy, drift types over time, whether drift clusters after losing days, honesty score distribution, and the ten least accurate notes with both texts side by side.

## Files

Standard demo folder plus `scripts/generate/journal-vs-reality.js`.

## Acceptance

Template list, plus:

- [ ] Notes contain no label wording, and a contract test greps for planted phrases.
- [ ] "Written after the fact" is only inferable from content and timing, both present in the state.
- [ ] The honest 126 are reported as a false-alarm rate.

## Video beats

- "Waited for the pullback" against a fill at the high of the bar.
- A rationalisation note, caught on timing.
- Drift clustering in the two weeks after the worst drawdown.

## Notes

This is the demo that lands emotionally with traders; keep the side-by-side layout tight and readable.
