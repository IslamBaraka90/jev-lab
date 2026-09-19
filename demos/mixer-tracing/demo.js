// Tracing and mixer exposure: ninety traces, each following a wallet's funding back up to five hops.
// The desk's rules are in the state — three hops to act, an exchange breaks the chain, a bridge does
// not, and amounts have to add up — so every answer is checkable against a rule somebody wrote down.

import { choice, noul, score } from '../lib/questions.js';

const HOPS = ['ONE', 'TWO', 'THREE', 'FOUR_PLUS', 'NONE_FOUND'];
const ACTIONS = ['CLEAR', 'REPORT_INTERNALLY', 'FREEZE_PENDING_REVIEW'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** The paths behind one wallet, hop by hop, and the rules the desk reads them with. */
function buildState(item, context) {
  return {
    task: 'Follow this wallet’s funding back and say how close it is to money the desk cannot accept.',
    desk: { name: context.desk, currency: context.currency, rules: context.rules, labelled_entities: context.entities, note: context.note },
    subject: { address: item.subject, chain: item.chain, funding_total: item.fundingTotal, paths_followed: item.pathsFollowed },
    funding_paths: item.paths.map((path) => ({
      share_of_funding_percent: path.sharePercent,
      amount_into_the_subject: path.amount,
      hops_back: path.hops.map((hop, index) => ({
        hop: index + 1,
        wallet: hop.wallet,
        entity: hop.entity,
        amount_at_this_hop: hop.amount,
        date: hop.at,
      })),
    })),
  };
}
// #endregion

// #region demo:questions
const questions = {
  tainted_funds: noul('Is this wallet holding money the desk would not accept?', {
    yes: 'A path leads back to a mixer or a listed address, and nothing in the rules breaks it.',
    no: 'Either no path reaches one, or the desk’s own rules break the chain before it gets here.',
  }),
  hops_to_source: choice('How far back is the nearest source the desk cares about?', {
    ONE: 'The money came straight from it.',
    TWO: 'One wallet in between.',
    THREE: 'Two wallets in between.',
    FOUR_PLUS: 'Four hops or more.',
    NONE_FOUND: 'No such source appears on any path followed.',
  }),
  chain_broken_by_exchange: noul('Does an exchange that checks identity sit between the subject and the source?', {
    yes: 'The money went into an exchange and came out again, which the desk treats as a break.',
    no: 'Nothing on the path breaks it. A bridge is not a break.',
  }),
  exposure: score('How exposed is this wallet to money the desk cannot accept?', [
    'None', 'Negligible', 'Low', 'Moderate', 'High', 'Very high', 'Direct',
  ]),
  action: choice('What does the desk do with this trace?', {
    CLEAR: 'Nothing to do. The funds can be taken.',
    REPORT_INTERNALLY: 'Write it up and keep it on file, but do not stop anything.',
    FREEZE_PENDING_REVIEW: 'Hold the funds while somebody looks properly.',
  }),
};
// #endregion

// #region demo:evaluate
/** One trace's verdict: tainted or not, how far back, and whether a rule broke the chain. */
function evaluate(answers, item) {
  const action = answers.action.choice;

  return {
    tainted: answers.tainted_funds.noul >= 0.5,
    hops: answers.hops_to_source.choice,
    brokenByExchange: answers.chain_broken_by_exchange.noul >= 0.5,
    exposure: answers.exposure.score,
    action,
    held: action === 'FREEZE_PENDING_REVIEW',
    confidence: answers.hops_to_source.confidence,
    funding: item.fundingTotal,
    label: `${item.id} · ${answers.tainted_funds.noul >= 0.5 ? 'tainted' : 'clean'} · ${readable(answers.hops_to_source.choice)} · ${readable(action)}`,
  };
}
// #endregion

// #region demo:report
/** Four separate things are graded here, because a trace can be right about one and wrong about another. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.traceId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const tainted = graded.filter((result) => byItem.get(result.item.id).tainted);
  const clean = graded.filter((result) => !byItem.get(result.item.id).tainted);

  return {
    note: `Ninety traces on a fictional graph. ${tainted.length} lead back to something the desk cannot accept, and nine have an exchange in the way that its own rules say breaks the chain. ${context.note ?? ''}`,
    findings: findings(graded, byItem),
    kpis: kpis({ graded, tainted, clean, byItem, currency: context.currency }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, tainted),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
  };
}
// #endregion

function kpis({ graded, tainted, clean, byItem, currency }) {
  const caught = tainted.filter((result) => result.evaluation.tainted);
  const falseTaint = clean.filter((result) => result.evaluation.tainted);
  const hopsRight = graded.filter((result) => result.evaluation.hops === byItem.get(result.item.id).hops);
  const breakers = graded.filter((result) => byItem.get(result.item.id).breaker);
  const breakerRight = breakers.filter((result) => result.evaluation.brokenByExchange && !result.evaluation.tainted);
  const held = graded.filter((result) => result.evaluation.held);

  return [
    { label: 'Tainted funds found', value: `${caught.length} of ${tainted.length}`, context: `${money(caught.reduce((sum, result) => sum + result.item.fundingTotal, 0), currency)} of funding`, tone: caught.length === tainted.length ? 'good' : 'warn' },
    { label: 'Clean traces called tainted', value: `${falseTaint.length} of ${clean.length}`, context: falseTaint.length ? `${money(falseTaint.reduce((sum, result) => sum + result.item.fundingTotal, 0), currency)} held up for nothing` : 'none', tone: falseTaint.length ? 'warn' : 'good' },
    { label: 'Hops back, exactly right', value: share(hopsRight.length, graded.length), context: `${hopsRight.length} of ${graded.length} traces` },
    { label: 'The exchange rule applied', value: `${breakerRight.length} of ${breakers.length}`, context: 'an exchange in the path, spotted, and the chain treated as broken', tone: breakerRight.length === breakers.length ? 'good' : 'warn' },
    { label: 'Funds held', value: money(held.reduce((sum, result) => sum + result.item.fundingTotal, 0), currency), context: `${held.length} traces frozen pending review` },
  ];
}

function checks(graded, byItem, labels) {
  const kinds = [...new Set(labels.map((label) => label.kind))];
  return kinds.map((kind) => {
    const group = labels.filter((label) => label.kind === kind);
    const wrong = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.traceId);
      return !result || result.evaluation.tainted !== label.tainted;
    });
    return { id: kind.replaceAll(/[^a-z]+/gi, '-'), label: `${sentence(kind)}: read the wrong way`, detail: DETAIL[kind] ?? '', count: wrong.length, of: group.length, items: wrong.map((label) => label.traceId) };
  });
}

const DETAIL = {
  'one hop from a mixer': 'The money came straight out of a mixer into the subject.',
  'two or three hops away': 'One or two wallets in between, and nothing that breaks the chain.',
  'an exchange broke the chain': 'The desk’s own rules say an exchange deposit breaks it; these traces are clean by that rule.',
  'the amounts do not add up': 'A hop passes on more than the hop before it received, so the path is not what it claims.',
  'nothing found': 'No mixer, no listed address, on any path followed.',
};

function distribution(results) {
  return ACTIONS
    .map((action) => ({ label: sentence(action), count: results.filter((result) => result.evaluation.action === action).length, tone: action === 'CLEAR' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Hops back, called against the path that was planted',
    columns: HOPS.map(sentence),
    rows: HOPS.map((actual) => ({
      label: sentence(actual),
      cells: HOPS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).hops === actual && result.evaluation.hops === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, tainted) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const held = graded.filter((result) => result.evaluation.exposure >= bar);
    const real = held.filter((result) => byItem.get(result.item.id).tainted);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: held.length, caught: real.length, rate: held.length ? Number((real.length / held.length).toFixed(3)) : null };
  });
  return { title: 'Exposure and what it holds up', xLabel: 'Traces held at this exposure or above', yLabel: 'Traces that really are tainted', rateLabel: 'Share of the held traces that are', of: tainted.length, points };
}

function findings(graded, byItem) {
  const lines = [];
  const missed = graded.filter((result) => byItem.get(result.item.id).tainted && !result.evaluation.tainted);
  if (missed.length) lines.push(`${missed.length} tainted ${missed.length === 1 ? 'trace' : 'traces'} came back clean: ${missed.map((result) => `${result.item.id} (${byItem.get(result.item.id).kind})`).join(', ')}.`);

  const brokenWrong = graded.filter((result) => byItem.get(result.item.id).breaker && result.evaluation.tainted);
  if (brokenWrong.length) lines.push(`${brokenWrong.length} of the nine traces with an exchange in the way were still called tainted. The desk's own rules say that deposit breaks the chain, so this is the rule being read rather than applied.`);

  const leaks = graded.filter((result) => byItem.get(result.item.id).kind === 'the amounts do not add up');
  const leaksCaught = leaks.filter((result) => result.evaluation.tainted);
  if (leaks.length) lines.push(`${leaksCaught.length} of the ${leaks.length} traces whose amounts do not add up were caught. A hop that passes on more than it received is the quietest thing in this file and the hardest to see.`);

  const bridged = graded.filter((result) => result.item.entitiesSeen.includes('BRIDGE_D') && result.evaluation.brokenByExchange);
  if (bridged.length >= 3) lines.push(`${bridged.length} traces treated a bridge as if it broke the chain. It does not; it only changes which chain the money is on.`);
  return lines;
}

function topItems(results, byItem, currency) {
  return [...results]
    .filter((result) => result.evaluation.tainted)
    .sort((left, right) => right.item.fundingTotal - left.item.fundingTotal)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.tainted ? '' : ' · actually clean'}`,
      value: money(result.item.fundingTotal, currency),
    }));
}

export default {
  id: 'mixer-tracing',
  title: 'Tracing and mixer exposure',
  domain: 'crypto',
  value: 'Follow funds back through the hops and say how close the money is to something you cannot take.',
  tags: ['crypto', 'tracing', 'graph', 'exposure'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'graph',
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${item.chain} · ${money(item.fundingTotal)} funded · ${item.longestPathHops} hops`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/mixer-tracing.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/mixer-tracing.js#demo:data',
    state: 'demos/mixer-tracing/demo.js#demo:state',
    questions: 'demos/mixer-tracing/demo.js#demo:questions',
    evaluate: 'demos/mixer-tracing/demo.js#demo:evaluate',
  },
};
