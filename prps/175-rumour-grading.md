# 175 · Rumour grading

**Domain:** News · **Data:** synthetic (seed 1175) · **View:** queue · **Items:** 240 claims · **Questions:** 5

## Value

Grade a claim before acting on it: how good is the source, is anyone else saying it, and does it look coordinated.

## Demo flow

1. A claim arrives with its source, timing, reach and whatever corroboration exists.
2. The model grades source reliability, decides whether it is corroborated, and flags coordination.
3. Claims sort into ignore, watch and act-worthy.
4. The report compares the grades with what later turned out to be true.

## Data

- `demos/rumour-grading/data.json` — 240 claims about 20 fictional companies: social posts, forum threads, blog items, newsletter mentions, and a few that cite filings.
- Planted: 22 claims later confirmed, 38 later denied, 14 coordinated pushes (many accounts, same phrasing, short window), 9 that cite a real document and are therefore checkable, and the rest unresolved.
- Labels: `{ claimId, outcome: CONFIRMED|DENIED|UNRESOLVED, coordinated }`.

## State

The claim text, the source type and its history of being right, the posting pattern around it (accounts, timing, phrasing similarity), any cited document, and the company's recent confirmed news. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `source_reliability` | score 0–6 | Untrustworthy · Very low · Low · Moderate · High · Very high · Authoritative |
| `corroborated` | yes/no | – |
| `coordinated_push` | yes/no | – |
| `checkable` | yes/no | Does it cite something that can be verified? |
| `disposition` | choice | `IGNORE` · `WATCH` · `VERIFY` · `ACT_WORTHY` |

## Report

Reliability against outcomes (a calibration curve), coordination detection against labels, the confirmed claims that were ignored — the expensive miss — and the denied claims that were called act-worthy.

## Files

Standard demo folder plus `scripts/generate/rumour-grading.js`.

## Acceptance

Template list, plus:

- [ ] Phrasing-similarity signals are in the data, so coordination is detectable without an external tool.
- [ ] Both error types are reported: ignored truths and trusted falsehoods.
- [ ] All companies, accounts and claims are fictional.

## Video beats

- A coordinated push: 40 accounts, same sentence, 20 minutes.
- A single post that cites a filing, graded checkable and verified.
- The calibration curve on source reliability.

## Notes

Closes the news block. Keep the tone neutral about platforms; the demo is about evidence, not about any particular network.
