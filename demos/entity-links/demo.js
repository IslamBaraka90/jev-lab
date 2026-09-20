import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const RELATIONS = ['OWNERSHIP', 'BOARD_SEAT', 'SUPPLIER', 'CUSTOMER', 'LITIGATION', 'SHARED_AUDITOR', 'NONE'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const pct = (part, whole) => whole ? `${(part / whole * 100).toFixed(1)}%` : '–';

// #region demo:state
function buildState(item) {
  return {
    task: 'Identify the relationship supported by the dated evidence, say whether it is still active, and judge whether trouble could travel across it. A shared name or industry is not sufficient evidence.',
    entities: [item.left, item.right],
    evidence_oldest_to_newest: item.evidence,
  };
}
// #endregion

// #region demo:questions
const questions = {
  relationship: choice('What relationship is supported between these two entities?', Object.fromEntries(RELATIONS.map((key) => [key, title(key)]))),
  still_active: noul('Is the supported relationship still active at the latest evidence date?', { yes: 'The latest evidence says it remains in force.', no: 'It ended, is unsupported, or never existed.' }),
  strength: score('How strong is the relationship in economic or governance terms?', ['None', 'Trivial', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Controlling']),
  contagion_risk: noul('Would material trouble at one side plausibly reach the other through this relationship?', { yes: 'The active relationship provides a plausible transmission channel.', no: 'The link is absent, ended or too weak to transmit trouble.' }),
  evidence_sufficient: noul('Is the supplied dated evidence sufficient to assert the relationship?', { yes: 'A direct filing, docket or equivalent source supports it.', no: 'The evidence is coincidental, indirect or incomplete.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    relationship: answers.relationship.choice, stillActive: answers.still_active.noul >= 0.5,
    strength: answers.strength.score, contagionRisk: answers.contagion_risk.noul >= 0.5,
    evidenceSufficient: answers.evidence_sufficient.noul >= 0.5,
    label: `${item.left.name} ↔ ${item.right.name} · ${title(answers.relationship.choice)} · ${answers.still_active.noul >= 0.5 ? 'active' : 'inactive'}`,
  };
}
// #endregion

// Relationships trouble can plausibly travel along. Sharing an audit firm or facing each other in court
// ties two names together without making one depend on the other, so those edges do not carry a path.
const CHANNELS = ['OWNERSHIP', 'SUPPLIER', 'CUSTOMER', 'BOARD_SEAT'];

function answerNetwork(results) {
  const nodeMap = new Map();
  const edges = [];
  for (const result of results) {
    nodeMap.set(result.item.left.id, result.item.left);
    nodeMap.set(result.item.right.id, result.item.right);
    if (result.evaluation.relationship === 'NONE' || !result.evaluation.stillActive || !result.evaluation.evidenceSufficient) continue;
    edges.push({ id: result.item.id, from: result.item.left.id, to: result.item.right.id, relationship: result.evaluation.relationship, strength: result.evaluation.strength, contagion: result.evaluation.contagionRisk });
  }
  return { nodes: [...nodeMap.values()].map(({ id, name, type }) => ({ id, name, type })), edges, paths: twoStepPaths(nodeMap, edges) };
}

/** Every two-step route over the edges that are real channels, strongest first. The strength of a
 *  path is the product of its two edges, each as a share of the scale. */
function twoStepPaths(nodeMap, edges) {
  const neighbours = new Map([...nodeMap.keys()].map((id) => [id, []]));
  for (const edge of edges.filter((entry) => entry.contagion && CHANNELS.includes(entry.relationship))) {
    neighbours.get(edge.from).push({ to: edge.to, strength: edge.strength });
    neighbours.get(edge.to).push({ to: edge.from, strength: edge.strength });
  }
  const best = new Map();
  for (const [from, firstHops] of neighbours) {
    for (const first of firstHops) {
      for (const second of neighbours.get(first.to) ?? []) {
        if (second.to === from) continue;
        const path = { from, via: first.to, to: second.to, strength: Number(((first.strength / 6) * (second.strength / 6)).toFixed(3)) };
        const key = `${path.from}>${path.via}>${path.to}`;
        if (!best.has(key) || best.get(key).strength < path.strength) best.set(key, path);
      }
    }
  }
  return [...best.values()].sort((a, b) => b.strength - a.strength);
}

// #region demo:report
function report(results, context = {}) {
  const labelRows = Array.isArray(context.labels) ? context.labels : Object.values(context.labels ?? {});
  const labels = Object.fromEntries(labelRows.map((label) => [label.pairId, label]));
  const scores = scoreRun(results, labels, labelRows);
  const network = answerNetwork(results);
  const graded = results.filter((result) => labels[result.item.id]);
  const matrix = graded.length ? relationshipMatrix(graded, labels) : undefined;
  return {
    note: `The contagion network and every two-step path below are built only from Jev’s active, sufficient relationship answers. ${context.note ?? ''}`,
    findings: findings(results, labels, scores, network),
    kpis: kpis(results, scores),
    baselines: baselines(graded, labels),
    metrics: metrics(graded, scores, matrix),
    matrix,
    entityNetwork: network,
    contagionAnsweredYesByRelationship: contagionByRelationship(results),
    checks: checks(results, labels, scores),
    topItems: [...results].sort((a, b) => b.evaluation.strength - a.evaluation.strength).slice(0, 30).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.strength.toFixed(1)} / 6` })),
    topItemsTitle: 'Links graded strongest',
  };
}
// #endregion

function scoreRun(results, labels, labelRows) {
  const relationCorrect = results.filter((result) => result.evaluation.relationship === labels[result.item.id]?.relationship);
  const relationshipRows = results.filter((result) => labels[result.item.id] && labels[result.item.id].relationship !== 'NONE');
  const activeCorrect = relationshipRows.filter((result) => result.evaluation.stillActive === labels[result.item.id].active);
  const coincidences = results.filter((result) => labels[result.item.id]?.coincidence);
  const rejectedCoincidences = coincidences.filter((result) => result.evaluation.relationship === 'NONE' && !result.evaluation.evidenceSufficient);
  const ended = relationshipRows.filter((result) => !labels[result.item.id].active);
  const endedCaught = ended.filter((result) => !result.evaluation.stillActive);
  const chainIds = [...new Set(labelRows.map((label) => label.chainId).filter(Boolean))];
  const recoveredChains = chainIds.filter((chainId) => labelRows.filter((label) => label.chainId === chainId).every((label) => {
    const result = results.find((entry) => entry.item.id === label.pairId);
    return result?.evaluation.relationship === label.relationship && result.evaluation.stillActive && result.evaluation.contagionRisk;
  }));
  return { relationCorrect, relationshipRows, activeCorrect, coincidences, rejectedCoincidences, ended, endedCaught, chainIds, recoveredChains };
}

function kpis(results, scores) {
  const { relationCorrect, relationshipRows, activeCorrect, coincidences, rejectedCoincidences, ended, endedCaught, chainIds, recoveredChains } = scores;
  return [
    { label: 'Relationship accuracy', value: pct(relationCorrect.length, results.length), context: `${relationCorrect.length} of ${results.length}; each type is written in its own stock sentence`, tone: relationCorrect.length >= results.length * 0.95 ? 'good' : 'warn' },
    { label: 'Active-status accuracy', value: pct(activeCorrect.length, relationshipRows.length), context: 'ended links keep their relationship label' },
    { label: 'Name coincidences rejected', value: `${rejectedCoincidences.length} of ${coincidences.length}`, context: 'NONE plus insufficient evidence', tone: rejectedCoincidences.length === coincidences.length ? 'good' : 'warn' },
    { label: 'Ended relationships caught', value: `${endedCaught.length} of ${ended.length}`, context: 'graded on still_active, not relationship; every one carries a termination filing' },
    { label: 'Chains recovered', value: `${recoveredChains.length} of ${chainIds.length}`, context: 'both active edges plus contagion risk' },
  ];
}

const STOCK_PHRASES = [
  ['voting interest', 'OWNERSHIP'],
  ['sits on the board', 'BOARD_SEAT'],
  ['critical components', 'SUPPLIER'],
  ['annual revenue', 'CUSTOMER'],
  ['opposing party', 'LITIGATION'],
  ['same audit firm', 'SHARED_AUDITOR'],
];

/** The rule: the first stock phrase found in the evidence names the relationship; none found means none. */
function phraseRelationship(item) {
  const text = item.evidence.map((entry) => entry.text).join(' ');
  const match = STOCK_PHRASES.find(([phrase]) => text.includes(phrase));
  return match ? match[1] : 'NONE';
}

function baselines(graded, labels) {
  if (!graded.length) return undefined;
  const right = (pick) => graded.filter((result) => pick(result) === labels[result.item.id].relationship).length;
  const counts = RELATIONS.map((value) => ({ value, count: graded.filter((result) => labels[result.item.id].relationship === value).length }));
  const commonest = counts.sort((a, b) => b.count - a.count)[0];
  const row = (count) => ({ value: count / graded.length, display: `${count} of ${graded.length}` });
  return [
    { label: 'Jev', detail: 'relationship type matches the planted one', model: true, ...row(right((result) => result.evaluation.relationship)) },
    { label: 'Rule: look for the stock phrase', detail: 'six phrases, one per relationship type; no phrase means none', ...row(right((result) => phraseRelationship(result.item))) },
    { label: 'Always the commonest type', detail: title(commonest.value), ...row(commonest.count) },
  ];
}

function relationshipMatrix(graded, labels) {
  return {
    title: 'Relationship read against the relationship planted',
    rowLabel: 'the relationship the evidence was written to show',
    columnLabel: 'the relationship the model read',
    columns: RELATIONS.map(title),
    rows: RELATIONS.map((actual) => ({
      label: title(actual),
      cells: RELATIONS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => labels[result.item.id].relationship === actual && result.evaluation.relationship === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function metrics(graded, scores, matrix) {
  if (!graded.length) return undefined;
  const stats = matrixStats(matrix);
  const linked = graded.filter((result) => result.evaluation.relationship !== 'NONE' && result.evaluation.stillActive);
  return {
    headline: { label: 'Relationship accuracy', value: scores.relationCorrect.length / graded.length, n: graded.length },
    accuracy: stats?.accuracy ?? null,
    macroF1: stats?.macroF1 ?? null,
    activeStatusAccuracy: scores.relationshipRows.length ? scores.activeCorrect.length / scores.relationshipRows.length : null,
    endedLinkRecall: scores.ended.length ? scores.endedCaught.length / scores.ended.length : null,
    coincidenceRejectionRate: scores.coincidences.length ? scores.rejectedCoincidences.length / scores.coincidences.length : null,
    contagionYesRate: linked.length ? linked.filter((result) => result.evaluation.contagionRisk).length / linked.length : null,
  };
}

/** How often contagion was answered yes on each kind of active link. There is no label for this
 *  question, so the table is a description of the answers, not a score. */
function contagionByRelationship(results) {
  const active = results.filter((result) => result.evaluation.relationship !== 'NONE' && result.evaluation.stillActive);
  return RELATIONS.filter((relation) => relation !== 'NONE').map((relation) => {
    const links = active.filter((result) => result.evaluation.relationship === relation);
    return { relationship: title(relation), activeLinks: links.length, answeredYes: links.filter((result) => result.evaluation.contagionRisk).length };
  }).filter((row) => row.activeLinks);
}

function findings(results, labels, scores, network) {
  const lines = [
    `${network.edges.length} active answered edges produce ${network.paths.length} directed two-step paths once shared auditors and litigation are left out as channels. The strongest come first; ${scores.chainIds.length} chains were planted.`,
    `${scores.recoveredChains.length} of ${scores.chainIds.length} planted fund → holding → supplier chains were fully recovered.`,
  ];
  const graded = results.filter((result) => labels[result.item.id]);
  const byRule = graded.filter((result) => phraseRelationship(result.item) === labels[result.item.id].relationship).length;
  if (graded.length && byRule >= scores.relationCorrect.length) lines.push(`Looking for six stock phrases names the relationship on ${byRule} of ${graded.length} pairs, against ${scores.relationCorrect.length} for the model. Each type is always written in the same sentence, so this score measures reading and cannot show a regression.`);

  const active = results.filter((result) => result.evaluation.relationship !== 'NONE' && result.evaluation.stillActive);
  const yes = active.filter((result) => result.evaluation.contagionRisk);
  const auditors = active.filter((result) => result.evaluation.relationship === 'SHARED_AUDITOR');
  if (active.length && yes.length >= active.length * 0.9) lines.push(`Contagion was answered yes on ${yes.length} of ${active.length} active links, including ${auditors.filter((result) => result.evaluation.contagionRisk).length} of ${auditors.length} shared auditors. The question has no planted answer and barely discriminates, so read it as a description.`);

  const strongest = [...results].sort((a, b) => b.evaluation.strength - a.evaluation.strength)[0];
  if (strongest && !CHANNELS.includes(strongest.evaluation.relationship) && strongest.evaluation.relationship !== 'NONE') lines.push(`The strongest link in the run is a ${title(strongest.evaluation.relationship).toLowerCase()} at ${strongest.evaluation.strength.toFixed(1)} of 6, above every ownership stake. Strength follows the type of link more than the evidence behind it.`);
  return lines;
}

function checks(results, labels, scores) {
  const { relationCorrect, coincidences, rejectedCoincidences, ended, endedCaught } = scores;
  const softChannels = results.filter((result) => result.evaluation.stillActive && ['SHARED_AUDITOR', 'LITIGATION'].includes(result.evaluation.relationship));
  const softYes = softChannels.filter((result) => result.evaluation.contagionRisk);
  return [
    { id: 'relation', label: 'Relationship errors', detail: 'Relationship type is graded separately from current status.', count: results.length - relationCorrect.length, of: results.length, items: results.filter((result) => result.evaluation.relationship !== labels[result.item.id]?.relationship).map((result) => result.item.id) },
    { id: 'ended', label: 'Ended links called active', detail: 'The historical relationship may still be classified correctly.', count: ended.length - endedCaught.length, of: ended.length, items: ended.filter((result) => result.evaluation.stillActive).map((result) => result.item.id) },
    { id: 'coincidence', label: 'Name coincidences accepted', detail: 'Similar names without direct evidence should be rejected.', count: coincidences.length - rejectedCoincidences.length, of: coincidences.length, items: coincidences.filter((result) => result.evaluation.relationship !== 'NONE' || result.evaluation.evidenceSufficient).map((result) => result.item.id) },
    { id: 'soft-channel', label: 'Contagion called across a shared auditor or a lawsuit', detail: 'Neither makes one side depend on the other; these edges are left out of the two-step paths.', count: softYes.length, of: softChannels.length, items: softYes.slice(0, 20).map((result) => result.item.id) },
  ];
}

function plantedAs(label) {
  if (label.coincidence) return 'Planted as a name coincidence: similar names, different owners and registrations.';
  if (label.chainId) return `Planted as one edge of ${label.chainId}, a fund → holding → supplier chain.`;
  if (label.relationship !== 'NONE' && !label.active) return 'Planted as a relationship that existed and then ended; the type still counts, the status is graded apart.';
  return undefined;
}

/** Right means the relationship type matches the planted one, which is what the headline counts. */
const grade = {
  labelId: (label) => label.pairId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.relationship === label.relationship,
      expected: label.relationship,
      got: result.evaluation.relationship,
      note: plantedAs(label),
      confidence: result.answers.relationship.confidence,
    };
  },
};

const STRENGTH_LEVELS = ['None', 'Trivial', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Controlling'];
const yesNo = (answer) => `${answer.noul >= 0.5 ? 'Yes' : 'No'} · ${Math.round(answer.noul * 100)}%`;

function verdict(result) {
  const { answers, evaluation } = result;
  const linked = evaluation.relationship !== 'NONE';
  const level = STRENGTH_LEVELS[Math.round(evaluation.strength)];
  const drawn = linked && evaluation.stillActive && evaluation.evidenceSufficient;
  return {
    eyebrow: 'The edge this pair becomes',
    headline: linked ? `${title(evaluation.relationship)} · ${evaluation.stillActive ? 'active' : 'ended'} · ${level.toLowerCase()}` : 'No relationship supported',
    detail: drawn ? 'Drawn on the map as an active edge.' : 'Not drawn on the map.',
    facts: [
      { label: 'Relationship', value: `${title(evaluation.relationship)} · ${Math.round(answers.relationship.confidence * 100)}%` },
      { label: 'Still active', value: yesNo(answers.still_active), tone: linked && !evaluation.stillActive ? 'warn' : undefined },
      { label: 'Strength', value: `${level} · ${evaluation.strength.toFixed(1)} of 6` },
      { label: 'Trouble could travel across it', value: yesNo(answers.contagion_risk), tone: evaluation.contagionRisk ? 'warn' : undefined },
      { label: 'Evidence is enough to assert it', value: yesNo(answers.evidence_sufficient), tone: evaluation.evidenceSufficient ? 'good' : 'warn' },
    ],
  };
}

const stage = {
  labels: {
    left: 'First entity',
    right: 'Second entity',
    registrationId: 'Registration',
    evidence: 'Dated evidence, oldest first',
    source: 'Kind of source',
    text: 'What it says',
  },
  highlight: ['registrationId', 'jurisdiction'],
};

const CAVEAT = 'Each relationship type is always written in the same stock sentence and every ended link carries a termination filing, so six phrases score 400 of 400 without a model; the contagion question has no planted answer at all.';

const present = {
  number: 174,
  problem: {
    headline: 'Who is tied to whom is scattered across filings, dockets and search results. The map has to be built one dated sentence at a time.',
    stat: '400',
    statLabel: 'candidate pairs among 90 entities',
  },
  hero: {
    item: 'EL-0002',
    caption: 'An annual filing says Summit 03 supplied 38% of River 02’s critical components, and the latest disclosure says it still does. Read as an active supplier link, strong at 4.1 of 6, one edge of a planted chain.',
  },
  answers: {
    caption: 'Five answers make one edge: the type, whether it is still in force, how strong, whether trouble could travel, and whether the evidence is enough.',
    reveal: ['relationship', 'still_active', 'strength', 'contagion_risk', 'evidence_sufficient'],
  },
  miss: {
    item: 'EL-0164',
    caption: 'Two companies use the same audit firm. The type is right, but it was graded 4.6 of 6, the strongest link in the run and above every ownership stake.',
  },
  proof: {
    kpis: ['Relationship accuracy', 'Ended relationships caught', 'Chains recovered'],
    chart: 'baselines',
    closing: '400 of 400 relationship types read correctly, and six stock phrases score the same, so this dataset cannot yet show a regression.',
  },
};

export default {
  id: 'entity-links', title: 'Entity links', domain: 'news',
  value: 'Turn scattered evidence into an active relationship map and show where trouble could travel two steps.',
  tags: ['news', 'entities', 'relationships', 'contagion'], dataClass: 'synthetic', readMinutes: 6, view: 'graph',
  itemLabel: (item) => `${item.left.name} ↔ ${item.right.name}`,
  data: () => import('./data.json'), labels: () => import('../../data/synthetic/entity-links.labels.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  stage, grade, verdict, present, caveat: CAVEAT,
  explain: { data: 'scripts/generate/entity-links.js', state: 'demos/entity-links/demo.js#demo:state', questions: 'demos/entity-links/demo.js#demo:questions', evaluate: 'demos/entity-links/demo.js#demo:evaluate' },
};
