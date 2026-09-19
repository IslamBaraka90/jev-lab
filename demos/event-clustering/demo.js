import { choice, noul, score } from '../lib/questions.js';

const RANKS = ['PRIMARY', 'WIRE', 'SECONDARY', 'AGGREGATOR'];
const pct = (part, whole) => whole ? `${(part / whole * 100).toFixed(1)}%` : '–';

// #region demo:state
function buildState(item) {
  return {
    task: 'Decide whether this headline belongs to the offered candidate cluster, whether it adds a material fact, and how authoritative its source is. Similar names and wording do not by themselves prove one event.',
    headline: { id: item.id, timestamp: item.timestamp, outlet: item.outlet, outlet_type: item.outletType, title: item.title, first_sentence: item.firstSentence, cites_another_outlet: item.citesAnotherOutlet },
    candidate_cluster: item.candidateCluster,
    time_window_hours: item.candidateCluster?.timeWindowHours ?? 72,
  };
}
// #endregion

// #region demo:questions
const questions = {
  same_event: noul('Is this headline about the same underlying event as the offered candidate cluster?', { yes: 'The entities, action and timing identify the same event.', no: 'It starts a different event or no candidate exists.' }),
  adds_information: noul('Does this headline add a material fact beyond the candidate cluster?', { yes: 'A new confirmed fact, term, outcome or primary confirmation is present.', no: 'It repeats, rewrites or aggregates existing facts.' }),
  source_rank: choice('How authoritative is this headline’s source for the event?', { PRIMARY: 'The issuer, regulator, filing or direct source.', WIRE: 'An original wire report.', SECONDARY: 'A newspaper or specialist report.', AGGREGATOR: 'A blog or aggregation that relies on another outlet.' }),
  cluster_confidence: score('How confident are you in the clustering decision?', ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain']),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    sameEvent: answers.same_event.noul >= 0.5, addsInformation: answers.adds_information.noul >= 0.5,
    sourceRank: answers.source_rank.choice, confidence: answers.cluster_confidence.score,
    label: `${item.outlet} · ${answers.same_event.noul >= 0.5 ? 'join cluster' : 'new event'} · ${answers.adds_information.noul >= 0.5 ? 'adds information' : 'duplicate'}`,
  };
}
// #endregion

function binary(results, labels, pick, truth) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const result of results) {
    const predicted = pick(result);
    const actual = truth(labels[result.item.id]);
    if (predicted && actual) tp++; else if (predicted) fp++; else if (actual) fn++; else tn++;
  }
  return { tp, fp, fn, tn, precision: tp / Math.max(tp + fp, 1), recall: tp / Math.max(tp + fn, 1) };
}

function modelClusters(results) {
  const assignment = new Map();
  for (const result of results) {
    const representative = result.item.candidateCluster?.representativeHeadlineId;
    const cluster = result.evaluation.sameEvent && representative ? (assignment.get(representative) ?? representative) : result.item.id;
    assignment.set(result.item.id, cluster);
  }
  return assignment;
}

// #region demo:report
function report(results, context = {}) {
  const labels = Array.isArray(context.labels) ? Object.fromEntries(context.labels.map((label) => [label.headlineId, label])) : (context.labels ?? {});
  const same = binary(results, labels, (result) => result.evaluation.sameEvent, (label) => label.sameEvent);
  const info = binary(results, labels, (result) => result.evaluation.addsInformation, (label) => label.addsInformation);
  const primary = binary(results, labels, (result) => result.evaluation.sourceRank === 'PRIMARY', (label) => label.isPrimary);
  const near = results.filter((result) => labels[result.item.id]?.nearDuplicatePair);
  const nearApart = near.filter((result) => !result.evaluation.sameEvent);
  const assignment = modelClusters(results);
  const clusters = [...new Set(assignment.values())];
  const secondsSaved = Math.max(0, results.length - clusters.length) * (context.estimatedSecondsPerHeadline ?? 18);
  const clusterRows = clusters.map((id) => {
    const members = results.filter((result) => assignment.get(result.item.id) === id);
    const best = members.find((result) => result.evaluation.sourceRank === 'PRIMARY') ?? members.find((result) => result.evaluation.sourceRank === 'WIRE') ?? members[0];
    return { id, size: members.length, primary: best.item.outlet, title: best.item.title, informative: members.filter((result) => result.evaluation.addsInformation).length };
  }).sort((a, b) => b.size - a.size);
  return {
    note: `The stage plays the raw feed in timestamp order; this report is the clustered view built only from Jev’s join decisions. ${context.note ?? ''}`,
    findings: [`${results.length} headlines became ${clusters.length} model clusters, saving an estimated ${(secondsSaved / 60).toFixed(1)} reading minutes.`, `${nearApart.length} of ${near.length} expensive near-duplicate offers stayed apart.`],
    kpis: [
      { label: 'Pair precision', value: pct(same.tp, same.tp + same.fp), context: `${same.tp} correct joins · ${same.fp} wrong merges`, tone: same.fp === 0 ? 'good' : 'warn' },
      { label: 'Pair recall', value: pct(same.tp, same.tp + same.fn), context: `${same.fn} missed joins` },
      { label: 'Primary-source precision', value: pct(primary.tp, primary.tp + primary.fp), context: `${primary.tp} primary headlines found` },
      { label: 'Near-duplicates apart', value: `${nearApart.length} of ${near.length}`, context: 'wrongly merging them is the expensive error', tone: nearApart.length === near.length ? 'good' : 'warn' },
      { label: 'Reading time saved', value: `${(secondsSaved / 60).toFixed(1)} min`, context: `${results.length} raw → ${clusters.length} clustered` },
    ],
    eventClusters: { before: results.length, after: clusters.length, rows: clusterRows },
    checks: [
      { id: 'merge', label: 'Wrong event merges', detail: 'Different planted events accepted into the offered candidate cluster.', count: same.fp, of: results.length, items: results.filter((result) => result.evaluation.sameEvent && !labels[result.item.id].sameEvent).map((result) => result.item.id) },
      { id: 'info', label: 'Information-addition errors', detail: `Precision ${pct(info.tp, info.tp + info.fp)} · recall ${pct(info.tp, info.tp + info.fn)}.`, count: info.fp + info.fn, of: results.length, items: results.filter((result) => result.evaluation.addsInformation !== labels[result.item.id].addsInformation).map((result) => result.item.id) },
      { id: 'primary', label: 'Primary-source errors', detail: `Precision ${pct(primary.tp, primary.tp + primary.fp)} · recall ${pct(primary.tp, primary.tp + primary.fn)}.`, count: primary.fp + primary.fn, of: results.length, items: results.filter((result) => (result.evaluation.sourceRank === 'PRIMARY') !== labels[result.item.id].isPrimary).map((result) => result.item.id) },
    ],
    topItems: clusterRows.slice(0, 20).map((row) => ({ id: row.id, label: `${row.title} · primary ${row.primary}`, value: `${row.size} headlines` })),
  };
}
// #endregion

export default {
  id: 'event-clustering', title: 'Event clustering', domain: 'news',
  value: 'Collapse a noisy headline feed into the events that happened and keep the source worth reading.',
  tags: ['news', 'clustering', 'sources', 'deduplication'], dataClass: 'synthetic', readMinutes: 6, view: 'queue',
  itemLabel: (item) => item.title,
  data: () => import('./data.json'), labels: () => import('../../data/synthetic/event-clustering.labels.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  explain: { data: 'scripts/generate/event-clustering.js', state: 'demos/event-clustering/demo.js#demo:state', questions: 'demos/event-clustering/demo.js#demo:questions', evaluate: 'demos/event-clustering/demo.js#demo:evaluate' },
};
