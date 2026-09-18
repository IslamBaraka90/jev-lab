# 172 · Event clustering

**Domain:** News · **Data:** synthetic (seed 1172) · **View:** queue (clusters) · **Items:** 380 headlines · **Questions:** 4

## Value

Collapse a noisy feed into the events that actually happened, and keep the source worth reading.

## Demo flow

1. The raw feed scrolls: 380 headlines over three days across 22 outlets.
2. Each headline is judged against the cluster it is offered, and either joins it, starts a new one, or is marked as adding nothing.
3. Clusters build on screen with their primary source.
4. The report shows the feed before and after, and the reading time saved.

## Data

- `demos/event-clustering/data.json` — 380 synthetic headlines covering 46 real-world-shaped events: a rate decision, three earnings, a merger rumour that becomes a filing, a product recall, and so on. Each headline: outlet, timestamp, title, first sentence, and whether it cites another outlet.
- Planted: 12 events where a later headline genuinely adds new information, 8 where a rumour is later confirmed by a primary source, and 6 near-duplicate events that must not be merged (two different companies with similar names, two separate outages).
- Labels: `{ headlineId, eventId, addsInformation, isPrimary }`.

## State

The headline with its outlet and timestamp, the candidate cluster's existing headlines, the outlet's type (wire, newspaper, aggregator, blog), and the time window. No label.

## Questions

| Name | Type | Options or rubric |
|---|---|---|
| `same_event` | yes/no | – |
| `adds_information` | yes/no | – |
| `source_rank` | choice | `PRIMARY` · `WIRE` · `SECONDARY` · `AGGREGATOR` |
| `cluster_confidence` | score 0–6 | None · Very low · Low · Moderate · High · Very high · Certain |

## Report

Clustering accuracy against labels (precision and recall on pairs), the six near-duplicate events and whether they stayed apart, primary sources found per event, and a before-and-after count with estimated reading time.

## Files

Standard demo folder plus `scripts/generate/event-clustering.js`.

## Acceptance

Template list, plus:

- [ ] Near-duplicate events are reported separately; merging them is the expensive error.
- [ ] Primary-source detection is graded on its own.
- [ ] The before-and-after view is playable: the raw feed, then the clustered one.

## Video beats

- Nine headlines for one rate decision collapsing to one event with a wire as primary.
- The two similarly named companies staying apart.
- 380 headlines down to 46 events, with the time saved.

## Notes

Headlines are written for the demo. No real article text, no real outlet branding beyond generic type names.
