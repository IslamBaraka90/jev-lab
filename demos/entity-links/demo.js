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

function answerNetwork(results) {
  const nodeMap = new Map();
  const edges = [];
  for (const result of results) {
    nodeMap.set(result.item.left.id, result.item.left);
    nodeMap.set(result.item.right.id, result.item.right);
    if (result.evaluation.relationship === 'NONE' || !result.evaluation.stillActive || !result.evaluation.evidenceSufficient) continue;
    edges.push({ id: result.item.id, from: result.item.left.id, to: result.item.right.id, relationship: result.evaluation.relationship, strength: result.evaluation.strength, contagion: result.evaluation.contagionRisk });
  }
  const neighbours = new Map([...nodeMap.keys()].map((id) => [id, []]));
  for (const edge of edges.filter((entry) => entry.contagion)) { neighbours.get(edge.from).push(edge.to); neighbours.get(edge.to).push(edge.from); }
  const paths = [];
  for (const [from, firstHops] of neighbours) for (const via of firstHops) for (const to of neighbours.get(via) ?? []) if (to !== from) paths.push({ from, via, to });
  return { nodes: [...nodeMap.values()].map(({ id, name, type }) => ({ id, name, type })), edges, paths: paths.filter((path, index, all) => index === all.findIndex((other) => other.from === path.from && other.via === path.via && other.to === path.to)) };
}

// #region demo:report
function report(results, context = {}) {
  const labelRows = Array.isArray(context.labels) ? context.labels : Object.values(context.labels ?? {});
  const labels = Object.fromEntries(labelRows.map((label) => [label.pairId, label]));
  const relationCorrect = results.filter((result) => result.evaluation.relationship === labels[result.item.id]?.relationship);
  const relationshipRows = results.filter((result) => labels[result.item.id]?.relationship !== 'NONE');
  const activeCorrect = relationshipRows.filter((result) => result.evaluation.stillActive === labels[result.item.id]?.active);
  const coincidences = results.filter((result) => labels[result.item.id]?.coincidence);
  const rejectedCoincidences = coincidences.filter((result) => result.evaluation.relationship === 'NONE' && !result.evaluation.evidenceSufficient);
  const ended = relationshipRows.filter((result) => !labels[result.item.id]?.active);
  const endedCaught = ended.filter((result) => !result.evaluation.stillActive);
  const chainIds = [...new Set(labelRows.map((label) => label.chainId).filter(Boolean))];
  const recoveredChains = chainIds.filter((chainId) => labelRows.filter((label) => label.chainId === chainId).every((label) => { const result = results.find((entry) => entry.item.id === label.pairId); return result?.evaluation.relationship === label.relationship && result.evaluation.stillActive && result.evaluation.contagionRisk; }));
  const network = answerNetwork(results);
  return {
    note: `The contagion network and every two-step path below are built only from Jev’s active, sufficient relationship answers. ${context.note ?? ''}`,
    findings: [`${network.edges.length} active answered edges produce ${network.paths.length} directed two-step contagion paths.`, `${recoveredChains.length} of ${chainIds.length} planted fund → holding → supplier chains were fully recovered.`],
    kpis: [
      { label: 'Relationship accuracy', value: pct(relationCorrect.length, results.length), context: `${relationCorrect.length} of ${results.length}` },
      { label: 'Active-status accuracy', value: pct(activeCorrect.length, relationshipRows.length), context: 'ended links keep their relationship label' },
      { label: 'Name coincidences rejected', value: `${rejectedCoincidences.length} of ${coincidences.length}`, context: 'NONE plus insufficient evidence', tone: rejectedCoincidences.length === coincidences.length ? 'good' : 'warn' },
      { label: 'Ended relationships caught', value: `${endedCaught.length} of ${ended.length}`, context: 'graded on still_active, not relationship' },
      { label: 'Chains recovered', value: `${recoveredChains.length} of ${chainIds.length}`, context: 'both active edges plus contagion risk' },
    ],
    entityNetwork: network,
    checks: [
      { id: 'relation', label: 'Relationship errors', detail: 'Relationship type is graded separately from current status.', count: results.length - relationCorrect.length, of: results.length, items: results.filter((result) => result.evaluation.relationship !== labels[result.item.id]?.relationship).map((result) => result.item.id) },
      { id: 'ended', label: 'Ended links called active', detail: 'The historical relationship may still be classified correctly.', count: ended.length - endedCaught.length, of: ended.length, items: ended.filter((result) => result.evaluation.stillActive).map((result) => result.item.id) },
      { id: 'coincidence', label: 'Name coincidences accepted', detail: 'Similar names without direct evidence should be rejected.', count: coincidences.length - rejectedCoincidences.length, of: coincidences.length, items: coincidences.filter((result) => result.evaluation.relationship !== 'NONE' || result.evaluation.evidenceSufficient).map((result) => result.item.id) },
    ],
    topItems: [...results].sort((a, b) => b.evaluation.strength - a.evaluation.strength).slice(0, 30).map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.strength.toFixed(1)} / 6` })),
  };
}
// #endregion

export default {
  id: 'entity-links', title: 'Entity links', domain: 'news',
  value: 'Turn scattered evidence into an active relationship map and show where trouble could travel two steps.',
  tags: ['news', 'entities', 'relationships', 'contagion'], dataClass: 'synthetic', readMinutes: 6, view: 'graph',
  itemLabel: (item) => `${item.left.name} ↔ ${item.right.name}`,
  data: () => import('./data.json'), labels: () => import('../../data/synthetic/entity-links.labels.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  explain: { data: 'scripts/generate/entity-links.js', state: 'demos/entity-links/demo.js#demo:state', questions: 'demos/entity-links/demo.js#demo:questions', evaluate: 'demos/entity-links/demo.js#demo:evaluate' },
};
