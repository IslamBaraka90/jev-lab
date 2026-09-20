# Demo contract — the optional fields added after the UI/UX review

A demo still works with none of these. Each one replaces something generic on the page with something
that is about *this* use case. All of them are pure, synchronous and live in `demos/<id>/demo.js`.
Nothing here may change `buildState`, `questions` or the shape of an existing answer: the recorded
fixtures must keep replaying, and re-recording costs money.

## `stage` — hints for the generic item view

Used by the `queue`, `table` and `comparison` views, which draw any record: scalars as facts, nested
records as titled groups, lists of records as tables, long strings as text.

```js
stage: {
  hide: ['internalKey', 'linkedToDemo'],          // fields a practitioner would never look at
  labels: { daysSinceOrder: 'Days since order', priorNotReceived: 'Earlier not-received claims' },
  highlight: ['trackingStatus', 'daysSinceLastScan'], // the two or three fields that decide the case
},
```

Hide ids that repeat the title, generator bookkeeping and anything that only exists to link datasets.
Label anything `humaniseKey` would get wrong. Highlight at most four fields.

## `grade` — whether one item's answer was right

Kept apart from `evaluate()`, which never sees a label.

```js
grade: {
  labelId: (label) => label.disputeId,            // how a label names its item; default label.id ?? label.itemId
  judge: (result, label, context) => {            // result = { item, answers, evaluation }
    if (!label) return null;                      // ungraded, not wrong
    return {
      agree: result.evaluation.action === label.correctAction,
      expected: label.correctAction,              // shown when it disagrees; enums are humanised for you
      got: result.evaluation.action,
      note: label.kind === 'friendly fraud' ? 'Planted as friendly fraud: delivery proof on file and two earlier claims.' : undefined,
      confidence: result.answers.action.confidence, // the confidence of the answer being graded, 0..1
    };
  },
},
```

`agree` must be a boolean that matches what the report's headline metric counts as right, so the rail's
"Wrong" filter, the calibration chart and the report agree with each other. `confidence` feeds the
reliability diagram and the automation slider: use the graded choice's `confidence`, or for a yes/no
`Math.max(noul, 1 - noul)`. Demos with no labels but a computable reference (ratios, arithmetic, realised
returns) may grade against that reference and say so in `note`. If a demo truly has nothing to grade
against, omit `grade`.

## `verdict` — the decision card under the item

```js
verdict: (result, context) => ({
  eyebrow: 'The call this dispute becomes',       // optional
  headline: 'Refund now · £134.50',
  detail: 'Full order value plus shipping, reason: not received.', // optional, one sentence
  facts: [                                        // 3–6, the ones a person would check
    { label: 'Policy allows a refund', value: 'Yes · 88%', tone: 'good' },
    { label: 'Safe to send unseen', value: 'Very high · 4.6 of 6', tone: 'good' },
    { label: 'Confidence in the action', value: '99%' },
  ],
}),
```

`tone` is `good`, `warn`, `bad` or omitted. Only the demo knows whether "yes" is good news: a breach
flagged is `bad`, a policy satisfied is `good`. Format money with its currency and scores as "level · x of n".

## Report additions

`report()` may also return:

```js
baselines: [                                      // drawn as "Against the alternatives"
  { label: 'Jev', detail: 'action agrees with policy', value: 0.90, model: true },
  { label: 'Rule: refund if inside the window', detail: 'four lines of code over the same fields', value: 0.81 },
  { label: 'Always the commonest action', detail: 'refund now', value: 0.75 },
],
metrics: {                                        // flat numbers for the suite scoreboard, 0..1 unless named otherwise
  headline: { label: 'Action agrees with policy', value: 0.90, n: 220 },
  accuracy: 0.90, macroF1: 0.77, contradictionRate: 0.12, automationRate: 0.44, automationPrecision: 0.763,
},
distributionTitle: 'Actions chosen',
topItemsTitle: 'Largest refunds',
matrix: { …, rowLabel: 'the action the policy gives', columnLabel: 'the action the model chose' },
curve: { …, thresholdFormat: 'level', levels: 6, defaultIndex: 4 },   // when the bar is a rubric level, not a percentage
```

A **rules baseline is the most valuable thing a report can add**: a few lines over fields already in the
state, scored on the same labels with the same notion of "right" as the model's headline. If the rule
wins, say so — the report's credibility comes from showing it. Always include the majority-class baseline
where there is a class to be the majority of. `metrics.headline` must be the same number as the first KPI.

Any other key a report returns is drawn automatically (records of numbers as figures, lists of records as
ranked tables), so give such keys readable names.

## `present` — the five-beat story for presenter mode

`/demos/<id>?present=1` plays five full-screen beats. The demo supplies the words and the items; the
runtime supplies the stage, the answers, the verdict and the charts.

```js
present: {
  number: 113,                                    // the PRP number, for the corner slug
  problem: {
    headline: 'Every dispute ends in a backend call. Someone has to fill in the arguments.',
    stat: '220', statLabel: 'disputes in the queue', // one big number that sizes the job
  },
  hero: {
    item: 'DSP-0001',                             // a real item id the model got right
    caption: 'The parcel stopped scanning 14 days ago. The policy says refund in full, with shipping.',
  },
  answers: {
    caption: 'Five typed answers become one call, with the money worked out from the band.',
    reveal: ['action', 'refund_band', 'reason_code'], // question keys, in the order to reveal; omit for all
  },
  miss: {
    item: 'DSP-0057',                             // a real item the model got wrong, or its least sure answer
    caption: 'A fair complaint that arrived after the window closed. The policy says refuse; the model refunded.',
  },
  proof: {
    kpis: ['Action agrees with policy', 'Whole call correct', 'Safe to send unseen'], // labels from report.kpis, max 3
    chart: 'curve',                               // 'curve' | 'matrix' | 'baselines' | 'distribution' | 'calibration'
    closing: '97 of 220 calls could go out unseen today, and 76% of those are right in every argument.',
  },
},
```

Rules: every item id must exist in `data.json`; `hero` should be graded right and `miss` graded wrong
where the demo has grades; every KPI label must match a label in `report().kpis` exactly; captions are
one or two plain sentences with the real numbers in them, no marketing words, no exclamation marks.
The closing line is the single number the video ends on.

## Voice

Plain and specific, the way the existing `notes.md` files and report findings are written. Say what the
run did, including where it did badly. No "powerful", "seamless", "leverage", "unlock".
