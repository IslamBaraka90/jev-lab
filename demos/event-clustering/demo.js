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
  const graded = results.filter((result) => labels[result.item.id]);
  const same = binary(graded, labels, (result) => result.evaluation.sameEvent, (label) => label.sameEvent);
  const info = binary(graded, labels, (result) => result.evaluation.addsInformation, (label) => label.addsInformation);
  const primary = binary(graded, labels, (result) => result.evaluation.sourceRank === 'PRIMARY', (label) => label.isPrimary);
  const near = graded.filter((result) => labels[result.item.id].nearDuplicatePair);
  const nearApart = near.filter((result) => !result.evaluation.sameEvent);
  const clusterRows = clusterTable(results);
  const minutesSaved = skippableHeadlines(results).length * (context.estimatedSecondsPerHeadline ?? 18) / 60;
  const scores = { same, info, primary, near, nearApart, minutesSaved, clusters: clusterRows.length };
  return {
    note: `The stage plays the raw feed in timestamp order; this report is the clustered view built only from Jev’s join decisions. ${context.note ?? ''}`,
    findings: findings(graded, labels, scores),
    kpis: kpis(graded, labels, scores),
    baselines: baselines(graded, labels),
    metrics: metrics(graded, labels, scores),
    eventClusters: { before: results.length, after: clusterRows.length, rows: clusterRows },
    checks: checks(graded, labels, scores),
    topItems: clusterRows.slice(0, 20).map((row) => ({ id: row.id, label: `${row.title} · read ${row.primary}`, value: `${row.size} headlines` })),
    topItemsTitle: 'Largest clusters and the source kept for each',
  };
}
// #endregion

/** One row per model cluster, with the member worth reading. Where no member was ranked primary the
 *  row says so, because the fallback is a rewrite and should not pass for the source. */
function clusterTable(results) {
  const assignment = modelClusters(results);
  const clusters = [...new Set(assignment.values())];
  return clusters.map((id) => {
    const members = results.filter((result) => assignment.get(result.item.id) === id);
    const found = members.find((result) => result.evaluation.sourceRank === 'PRIMARY');
    const best = found ?? members.find((result) => result.evaluation.sourceRank === 'WIRE') ?? members[0];
    return {
      id,
      size: members.length,
      primary: found ? best.item.outlet : `${best.item.outlet} (no primary source found)`,
      title: best.item.title,
      informative: members.filter((result) => result.evaluation.addsInformation).length,
    };
  }).sort((a, b) => b.size - a.size);
}

/** Headlines a reader can skip: joined to an existing cluster and said to repeat it. A joined
 *  headline that adds a fact still has to be read. */
function skippableHeadlines(results) {
  return results.filter((result) => result.evaluation.sameEvent && result.item.candidateCluster && !result.evaluation.addsInformation);
}

const LABEL_PREFIX = /^[^:]+:\s*/;
const UPDATE_SUFFIX = / · update \d+$/;
const REPEAT_PREFIXES = ['Update', 'What we know', 'Round-up'];
const bareTitle = (title) => title.replace(UPDATE_SUFFIX, '').replace(LABEL_PREFIX, '').trim().toLowerCase();
const titlePrefix = (title) => (title.includes(':') ? title.split(':')[0] : '');

/** The rule: join when the title, minus its label and update number, matches one already in the
 *  cluster; primary when it starts "Issuer filing"; a repeat when it starts Update, What we know or Round-up. */
function titleRule(item) {
  const offered = item.candidateCluster?.headlines ?? [];
  return {
    sameEvent: offered.some((headline) => bareTitle(headline.title) === bareTitle(item.title)),
    addsInformation: !REPEAT_PREFIXES.includes(titlePrefix(item.title)),
    isPrimary: titlePrefix(item.title).startsWith('Issuer filing'),
  };
}

const modelReading = (result) => ({ sameEvent: result.evaluation.sameEvent, addsInformation: result.evaluation.addsInformation, isPrimary: result.evaluation.sourceRank === 'PRIMARY' });
const READING_PARTS = ['sameEvent', 'addsInformation', 'isPrimary'];
const wholeReadingRight = (reading, label) => READING_PARTS.every((part) => reading[part] === Boolean(label[part]));

function commonestReading(graded, labels) {
  const counts = new Map();
  for (const result of graded) {
    const key = READING_PARTS.map((part) => Boolean(labels[result.item.id][part])).join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [key] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ['false,false,false'];
  const [sameEvent, addsInformation, isPrimary] = key.split(',').map((value) => value === 'true');
  return { sameEvent, addsInformation, isPrimary };
}

function baselines(graded, labels) {
  if (!graded.length) return undefined;
  const right = (read) => graded.filter((result) => wholeReadingRight(read(result), labels[result.item.id])).length;
  const usual = commonestReading(graded, labels);
  const row = (count) => ({ value: count / graded.length, display: `${count} of ${graded.length}` });
  return [
    { label: 'Jev', detail: 'join, new fact and primary source all right', model: true, ...row(right(modelReading)) },
    { label: 'Rule: match the title, read its label', detail: 'same title means same event; "Issuer filing" means primary; "Update", "What we know" and "Round-up" mean a repeat', ...row(right((result) => titleRule(result.item))) },
    { label: 'Always the commonest reading', detail: 'joins the cluster, repeats it, not a primary source', ...row(right(() => usual)) },
  ];
}

function kpis(graded, labels, { same, primary, near, nearApart, minutesSaved, clusters }) {
  const whole = graded.filter((result) => wholeReadingRight(modelReading(result), labels[result.item.id]));
  const otherEvents = graded.filter((result) => result.item.candidateCluster && !labels[result.item.id].sameEvent);
  return [
    { label: 'Whole reading right', value: `${whole.length} of ${graded.length}`, context: 'the join, whether it adds a fact, and whether the source is primary, all three', tone: whole.length >= graded.length * 0.95 ? 'good' : 'warn' },
    { label: 'Pair precision', value: pct(same.tp, same.tp + same.fp), context: `${same.tp} correct joins · ${same.fp} wrong merges · ${same.fn} missed joins · only ${otherEvents.length} offers were a different event`, tone: same.fp === 0 ? 'good' : 'warn' },
    { label: 'Primary sources found', value: `${primary.tp} of ${primary.tp + primary.fn}`, context: `${primary.fp} called primary that were not; the labels count a blog carrying the filing as primary`, tone: primary.fn === 0 && primary.fp === 0 ? 'good' : 'warn' },
    { label: 'Near-duplicates apart', value: `${nearApart.length} of ${near.length}`, context: 'wrongly merging them is the expensive error; these decoys name a different company and action, so they are easy', tone: nearApart.length === near.length ? undefined : 'warn' },
    { label: 'Reading time saved', value: `${minutesSaved.toFixed(1)} min`, context: `${graded.length} raw → ${clusters} clustered; joined headlines that add a fact still count as read` },
  ];
}

function metrics(graded, labels, { same, info, primary }) {
  if (!graded.length) return undefined;
  const whole = graded.filter((result) => wholeReadingRight(modelReading(result), labels[result.item.id]));
  return {
    headline: { label: 'Whole reading right', value: whole.length / graded.length, n: graded.length },
    accuracy: whole.length / graded.length,
    precision: same.precision,
    recall: same.recall,
    wrongMerges: same.fp,
    primarySourceRecall: primary.recall,
    newFactRecall: info.recall,
    newFactPrecision: info.precision,
  };
}

function findings(graded, labels, { near, nearApart, minutesSaved, clusters }) {
  const lines = [
    `${graded.length} headlines became ${clusters} model clusters, saving an estimated ${minutesSaved.toFixed(1)} reading minutes once the joined headlines that add a fact are counted as still read.`,
    `${nearApart.length} of ${near.length} near-duplicate offers stayed apart. Each names a different company and a different action from the cluster it was offered, so this says little about confusable events.`,
  ];
  const byRule = graded.filter((result) => wholeReadingRight(titleRule(result.item), labels[result.item.id])).length;
  const byModel = graded.filter((result) => wholeReadingRight(modelReading(result), labels[result.item.id])).length;
  if (graded.length && byRule >= byModel) lines.push(`Matching titles and reading the label in front of them gets ${byRule} of ${graded.length} readings right, against ${byModel} for the model. Every true member repeats its event’s title word for word, so this feed does not separate clustering from string matching.`);
  const unsure = graded.filter((result) => result.answers.same_event.noul > 0.2 && result.answers.same_event.noul < 0.8);
  if (graded.length && !unsure.length) lines.push('No join answer fell between 20% and 80%, so there is no threshold to set on this feed: every offer was an easy yes or an easy no.');
  return lines;
}

function checks(graded, labels, { same, info, primary }) {
  const wrong = (test) => graded.filter(test).map((result) => result.item.id);
  return [
    { id: 'merge', label: 'Wrong event merges', detail: 'Different planted events accepted into the offered candidate cluster.', count: same.fp, of: graded.length, items: wrong((result) => result.evaluation.sameEvent && !labels[result.item.id].sameEvent) },
    { id: 'info', label: 'Information-addition errors', detail: `Precision ${pct(info.tp, info.tp + info.fp)} · recall ${pct(info.tp, info.tp + info.fn)}.`, count: info.fp + info.fn, of: graded.length, items: wrong((result) => result.evaluation.addsInformation !== labels[result.item.id].addsInformation) },
    { id: 'primary', label: 'Primary-source errors', detail: `Precision ${pct(primary.tp, primary.tp + primary.fp)} · recall ${pct(primary.tp, primary.tp + primary.fn)}.`, count: primary.fp + primary.fn, of: graded.length, items: wrong((result) => (result.evaluation.sourceRank === 'PRIMARY') !== labels[result.item.id].isPrimary) },
  ];
}

const sureness = (answer) => Math.max(answer.noul, 1 - answer.noul);
const describeReading = (read) => `${read.sameEvent ? 'joins the cluster' : 'new event'}, ${read.addsInformation ? 'adds a fact' : 'repeats'}, ${read.isPrimary ? 'primary source' : 'not primary'}`;

function plantedAs(label) {
  if (label.nearDuplicatePair) return `Planted as a near-duplicate offer (${label.nearDuplicatePair}): a different event from the cluster it was shown. `;
  if (label.rumourConfirmation) return 'Planted as the issuer filing that confirms earlier market talk. ';
  return '';
}

/** Right means all three parts of the reading match the planted event: the join, the new fact and
 *  the primary source. The confidence is that of the least sure of the three. */
const grade = {
  labelId: (label) => label.headlineId,
  judge: (result, label) => {
    if (!label) return null;
    const { answers } = result;
    return {
      agree: wholeReadingRight(modelReading(result), label),
      expected: describeReading(label),
      got: describeReading(modelReading(result)),
      note: `${plantedAs(label)}Belongs to ${label.eventId}.`,
      confidence: Math.min(sureness(answers.same_event), sureness(answers.adds_information), answers.source_rank.confidence),
    };
  },
};

const CONFIDENCE_LEVELS = ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain'];
const yesNo = (answer) => `${answer.noul >= 0.5 ? 'Yes' : 'No'} · ${Math.round(answer.noul * 100)}%`;
const rankName = (rank) => rank.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

function verdict(result) {
  const { answers, evaluation, item } = result;
  const offered = item.candidateCluster?.headlines?.length ?? 0;
  const decision = evaluation.sameEvent ? `Joins the offered cluster (${offered} in it so far)` : offered ? 'Kept apart from the offered cluster' : 'Starts a new event';
  return {
    eyebrow: 'What happens to this headline in the feed',
    headline: `${decision} · ${evaluation.addsInformation ? 'adds a fact' : 'a repeat'}`,
    facts: [
      { label: 'Same event as the cluster', value: offered ? yesNo(answers.same_event) : `${yesNo(answers.same_event)} · no cluster was offered` },
      { label: 'Adds a material fact', value: yesNo(answers.adds_information), tone: evaluation.addsInformation ? 'good' : undefined },
      { label: 'Source rank', value: `${rankName(evaluation.sourceRank)} · ${Math.round(answers.source_rank.confidence * 100)}%`, tone: evaluation.sourceRank === 'PRIMARY' ? 'good' : undefined },
      { label: 'Confidence in the clustering', value: `${CONFIDENCE_LEVELS[Math.round(evaluation.confidence)]} · ${evaluation.confidence.toFixed(1)} of 6` },
    ],
  };
}

const stage = {
  hide: ['title', 'representativeHeadlineId', 'timeWindowHours'],
  labels: {
    timestamp: 'Published',
    outletType: 'Kind of outlet',
    firstSentence: 'First sentence',
    citesAnotherOutlet: 'Cites another outlet',
    candidateCluster: 'The cluster it was offered',
    headlines: 'Headlines already in that cluster',
  },
  highlight: ['outletType', 'citesAnotherOutlet'],
};

const CAVEAT = 'Every true member of an event repeats its title word for word and the six decoys name a different company, so matching titles scores 380 of 380 without a model; this run cannot tell clustering from string matching, and a harder feed is planned.';

const present = {
  number: 172,
  problem: {
    headline: 'One event arrives as eight headlines from eight outlets. Somebody has to work out that it is one event and which version to read.',
    stat: '380',
    statLabel: 'headlines over three days, about 46 events',
  },
  hero: {
    item: 'EC-0059',
    caption: 'An update on North Harbor M raising guidance, offered the cluster that began as market talk eight hours earlier. Joined at 94%, marked as a repeat, source ranked as an aggregator.',
  },
  answers: {
    caption: 'Three answers decide what the feed does: join or new event, new fact or repeat, and how good the source is.',
    reveal: ['same_event', 'adds_information', 'source_rank'],
  },
  miss: {
    item: 'EC-0197',
    caption: 'The issuer’s own filing confirms the rumour. Joined and marked as a new fact, but the source was ranked as a wire, one of 3 primary filings missed out of 46.',
  },
  proof: {
    kpis: ['Whole reading right', 'Pair precision', 'Primary sources found'],
    chart: 'baselines',
    closing: '380 headlines became 46 events with no wrong merges, and matching the titles does the same, which is what the next dataset has to fix.',
  },
};

export default {
  id: 'event-clustering', title: 'Event clustering', domain: 'news',
  value: 'Collapse a noisy headline feed into the events that happened and keep the source worth reading.',
  tags: ['news', 'clustering', 'sources', 'deduplication'], dataClass: 'synthetic', readMinutes: 6, view: 'queue',
  itemLabel: (item) => item.title,
  data: () => import('./data.json'), labels: () => import('../../data/synthetic/event-clustering.labels.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  stage, grade, verdict, present, caveat: CAVEAT,
  explain: { data: 'scripts/generate/event-clustering.js', state: 'demos/event-clustering/demo.js#demo:state', questions: 'demos/event-clustering/demo.js#demo:questions', evaluate: 'demos/event-clustering/demo.js#demo:evaluate' },
};
