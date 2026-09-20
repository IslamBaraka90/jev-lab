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
  const right = graded.filter((result) => result.evaluation.tainted === byItem.get(result.item.id).tainted);
  const rows = baselines(graded, byItem, right);

  return {
    note: `Ninety traces on a fictional graph. ${tainted.length} lead back to something the desk cannot accept, and nine have an exchange in the way that its own rules say breaks the chain. ${context.note ?? ''}`,
    findings: findings(graded, byItem, rows),
    kpis: kpis({ graded, tainted, clean, right, byItem, currency: context.currency }),
    baselines: rows,
    metrics: metrics(graded, byItem, right),
    distribution: distribution(results),
    distributionTitle: 'What the desk was told to do',
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, tainted),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem, context.currency),
    topItemsTitle: 'Largest traces called tainted',
  };
}
// #endregion

const funding = (results) => results.reduce((sum, result) => sum + result.item.fundingTotal, 0);
const isSource = (entity) => /^(MIXER|SANCTIONED)/.test(entity ?? '');
const isExchange = (entity) => /^EXCHANGE/.test(entity ?? '');

// The rule: walk each path back from the subject; it is tainted if a mixer or a listed address is
// reached before any exchange. A bridge is walked straight through.
function ruleTainted(item) {
  return item.paths.some((path) => {
    for (const hop of path.hops) {
      if (isExchange(hop.entity)) return false;
      if (isSource(hop.entity)) return true;
    }
    return false;
  });
}

/** The yes/no read at a stricter cut than 50%, to show what a calibrated threshold would do. */
const STRICT_CUT = 0.7;
const taintedAt = (result, cut) => result.answers.tainted_funds.noul >= cut;

/** Traces whose exposure score sits under every truly tainted trace: the rule applied by the score. */
function belowEveryTainted(group, graded, byItem) {
  const taintedScores = graded.filter((result) => byItem.get(result.item.id).tainted).map((result) => result.evaluation.exposure);
  if (!taintedScores.length) return [];
  return group.filter((result) => result.evaluation.exposure < Math.min(...taintedScores));
}

function baselines(graded, byItem, right) {
  if (!graded.length) return [];
  const agrees = (predict) => graded.filter((result) => predict(result) === byItem.get(result.item.id).tainted).length;
  const clean = graded.filter((result) => !byItem.get(result.item.id).tainted).length;
  return [
    { label: 'Jev', detail: 'tainted or clean, the yes/no read at 50%', value: right.length / graded.length, count: right.length, model: true },
    { label: `Same answers, read at ${STRICT_CUT * 100}%`, detail: 'the cut moved after seeing this file, so it is a ceiling, not a result', value: agrees((result) => taintedAt(result, STRICT_CUT)) / graded.length, count: agrees((result) => taintedAt(result, STRICT_CUT)) },
    { label: 'Rule: walk the path, stop at an exchange', detail: 'a dozen lines of code over the same hops', value: agrees((result) => ruleTainted(result.item)) / graded.length, count: agrees((result) => ruleTainted(result.item)) },
    { label: 'Always clean', detail: 'the commoner answer in this file', value: clean / graded.length, count: clean },
  ];
}

function metrics(graded, byItem, right) {
  const called = graded.filter((result) => result.evaluation.tainted);
  const tainted = graded.filter((result) => byItem.get(result.item.id).tainted);
  const hit = called.filter((result) => byItem.get(result.item.id).tainted);
  const held = graded.filter((result) => result.evaluation.held);
  const coherent = graded.filter((result) => result.evaluation.held === result.evaluation.tainted);
  const hopsRight = graded.filter((result) => result.evaluation.hops === byItem.get(result.item.id).hops);
  const rate = (part, whole) => (whole ? part / whole : null);
  return {
    headline: { label: 'Taint call right', value: rate(right.length, graded.length) ?? 0, n: graded.length },
    accuracy: rate(right.length, graded.length),
    precision: rate(hit.length, called.length),
    recall: rate(hit.length, tainted.length),
    hopsExact: rate(hopsRight.length, graded.length),
    actionCoherence: rate(coherent.length, graded.length),
    cleanFrozenRate: rate(held.filter((result) => !byItem.get(result.item.id).tainted).length, held.length),
  };
}

function kpis({ graded, tainted, clean, right, byItem, currency }) {
  const caught = tainted.filter((result) => result.evaluation.tainted);
  const falseTaint = clean.filter((result) => result.evaluation.tainted);
  const strictFalse = clean.filter((result) => taintedAt(result, STRICT_CUT));
  const strictCaught = tainted.filter((result) => taintedAt(result, STRICT_CUT));
  const breakers = graded.filter((result) => byItem.get(result.item.id).breaker);
  const breakerRight = breakers.filter((result) => result.evaluation.brokenByExchange && !result.evaluation.tainted);
  const breakerLow = belowEveryTainted(breakers, graded, byItem);
  const held = graded.filter((result) => result.evaluation.held);
  const heldClean = held.filter((result) => !byItem.get(result.item.id).tainted);

  return [
    { label: 'Taint call right', value: `${right.length} of ${graded.length}`, context: `${share(right.length, graded.length)} of traces called tainted or clean as the desk's rules make them`, tone: right.length >= graded.length * 0.9 ? 'good' : 'warn' },
    { label: 'Tainted funds found', value: `${caught.length} of ${tainted.length}`, context: `${money(funding(caught), currency)} of funding`, tone: caught.length === tainted.length ? 'good' : 'warn' },
    { label: 'Clean traces called tainted', value: `${falseTaint.length} of ${clean.length}`, context: falseTaint.length ? `${money(funding(falseTaint), currency)} held up for nothing; read at ${STRICT_CUT * 100}% instead of 50% it is ${strictFalse.length} of ${clean.length}, with ${strictCaught.length} of ${tainted.length} still found` : 'none', tone: falseTaint.length ? 'warn' : 'good' },
    { label: 'The exchange rule applied', value: `${breakerRight.length} of ${breakers.length}`, context: `by the yes/no; by the exposure score ${breakerLow.length} of ${breakers.length} sit below every tainted trace`, tone: breakerRight.length === breakers.length ? 'good' : 'warn' },
    { label: 'Clean funds frozen', value: `${heldClean.length} of ${held.length}`, context: `${money(funding(heldClean), currency)} of clean money among the ${money(funding(held), currency)} frozen pending review`, tone: heldClean.length ? 'warn' : 'good' },
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
    rowLabel: 'the distance that was planted',
    columnLabel: 'the distance the model named',
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
  return { title: 'Exposure and what it holds up', xLabel: 'Traces held at this exposure or above', yLabel: 'Traces that really are tainted', rateLabel: 'Share of the held traces that are', of: tainted.length, thresholdFormat: 'level', levels: 6, defaultIndex: 4, points };
}

function findings(graded, byItem, rows = []) {
  const lines = [];
  const model = rows.find((row) => row.model);
  const rule = rows.find((row) => row.label.startsWith('Rule'));
  if (model && rule && rule.count > model.count) {
    lines.push(`A path walk of a dozen lines gets ${rule.count} of ${graded.length} taint calls right; the model gets ${model.count}. The rules are mechanical, so what this run tests is whether they can be applied from prose, not whether a mixer can be found.`);
  }
  const missed = graded.filter((result) => byItem.get(result.item.id).tainted && !result.evaluation.tainted);
  if (missed.length) lines.push(`${missed.length} tainted ${missed.length === 1 ? 'trace' : 'traces'} came back clean: ${missed.map((result) => `${result.item.id} (${byItem.get(result.item.id).kind})`).join(', ')}.`);

  const brokenWrong = graded.filter((result) => byItem.get(result.item.id).breaker && result.evaluation.tainted);
  if (brokenWrong.length) {
    const lower = belowEveryTainted(brokenWrong, graded, byItem);
    lines.push(`${brokenWrong.length} of the nine traces with an exchange in the way were still called tainted. The desk's own rules say that deposit breaks the chain, so this is the rule being read rather than applied.${lower.length ? ` The exposure score does apply it: ${lower.length} of those ${brokenWrong.length} score below every truly tainted trace.` : ''}`);
  }

  const clean = graded.filter((result) => !byItem.get(result.item.id).tainted);
  const tainted = graded.filter((result) => byItem.get(result.item.id).tainted);
  const falseAtHalf = clean.filter((result) => result.evaluation.tainted);
  const falseAtStrict = clean.filter((result) => taintedAt(result, STRICT_CUT));
  const caughtAtStrict = tainted.filter((result) => taintedAt(result, STRICT_CUT));
  if (falseAtHalf.length && falseAtStrict.length < falseAtHalf.length && caughtAtStrict.length === tainted.length) {
    lines.push(`The yes/no ranks the file well and is cut in the wrong place. Read at ${STRICT_CUT * 100}% instead of 50% it still finds ${caughtAtStrict.length} of ${tainted.length} tainted traces and calls ${falseAtStrict.length} clean ones tainted instead of ${falseAtHalf.length}. That cut was chosen on this file and would need checking on another.`);
  }

  const held = graded.filter((result) => result.evaluation.held);
  const heldClean = held.filter((result) => !byItem.get(result.item.id).tainted);
  if (heldClean.length) {
    const frozenButCalledClean = held.filter((result) => !result.evaluation.tainted);
    const clearedButCalledTainted = graded.filter((result) => result.evaluation.tainted && result.evaluation.action === 'CLEAR');
    const unused = ACTIONS.filter((action) => !graded.some((result) => result.evaluation.action === action));
    lines.push(`${held.length} of ${graded.length} traces were frozen and ${heldClean.length} of them are clean: ${money(funding(heldClean))} held for nothing. ${frozenButCalledClean.length} were frozen after being called clean and ${clearedButCalledTainted.length} were cleared after being called tainted${unused.length ? `; "${readable(unused[0])}" was never chosen` : ''}.`);
  }

  const leaks = graded.filter((result) => byItem.get(result.item.id).kind === 'the amounts do not add up');
  const leaksCaught = leaks.filter((result) => result.evaluation.tainted);
  if (leaks.length) {
    const confounded = leaks.filter((result) => result.item.entitiesSeen.some(isSource));
    const reading = confounded.length === leaks.length
      ? 'Every one of them also has a mixer or a listed address on the path, so this file cannot show whether the arithmetic was read at all.'
      : 'A hop that passes on more than it received is the quietest thing in this file and the hardest to see.';
    lines.push(`${leaksCaught.length} of the ${leaks.length} traces whose amounts do not add up were called tainted. ${reading}`);
  }

  // Only a bridge with no exchange anywhere on the trace can show a bridge being mistaken for a break.
  const bridgeOnly = graded.filter((result) => result.item.entitiesSeen.includes('BRIDGE_D') && !result.item.entitiesSeen.some(isExchange));
  const bridged = bridgeOnly.filter((result) => result.evaluation.brokenByExchange);
  if (bridged.length) lines.push(`${bridged.length} of the ${bridgeOnly.length} traces with a bridge and no exchange treated the bridge as if it broke the chain. It does not; it only changes which chain the money is on.`);
  return lines;
}

function topItems(results, byItem, currency) {
  return [...results]
    .filter((result) => result.evaluation.tainted)
    .sort((left, right) => right.item.fundingTotal - left.item.fundingTotal)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.item.id} · called tainted, source ${HOP_WORDS[result.evaluation.hops]} · ${ACTION_WORDS[result.evaluation.action].toLowerCase()} · ${byItem.get(result.item.id)?.tainted ? 'is tainted' : 'is clean'}`,
      value: money(result.item.fundingTotal, currency),
    }));
}

const HOP_WORDS = { ONE: 'one hop back', TWO: 'two hops back', THREE: 'three hops back', FOUR_PLUS: 'four or more hops back', NONE_FOUND: 'not found' };
const ACTION_WORDS = { CLEAR: 'Clear', REPORT_INTERNALLY: 'Report internally', FREEZE_PENDING_REVIEW: 'Freeze pending review' };
const EXPOSURE_WORDS = ['None', 'Negligible', 'Low', 'Moderate', 'High', 'Very high', 'Direct'];
const EXPOSURE_BAR = 4;

const PLANTED_NOTE = {
  'one hop from a mixer': 'Planted one hop from a mixer: the money came straight out of it.',
  'two or three hops away': 'Planted two or three hops from a source, with nothing that breaks the chain.',
  'an exchange broke the chain': 'Planted with an exchange between the subject and the source: clean under the desk’s second rule.',
  'the amounts do not add up': 'Planted with a hop that passes on more than it received, on a path that also reaches a source.',
  'nothing found': 'Planted clean: no mixer and no listed address on any path.',
};

/** Right means the tainted-or-clean call matches what the desk's four rules make of the planted path. */
function judge(result, label) {
  if (!label) return null;
  const probability = result.answers.tainted_funds.noul;
  return {
    agree: result.evaluation.tainted === label.tainted,
    expected: label.tainted ? 'tainted' : 'clean',
    got: result.evaluation.tainted ? 'tainted' : 'clean',
    note: PLANTED_NOTE[label.kind],
    confidence: Math.max(probability, 1 - probability),
  };
}

const yesNo = (probability) => `${probability >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(probability, 1 - probability) * 100)}%`;

function verdict(result, context = {}) {
  const { item, answers, evaluation } = result;
  const incoherent = evaluation.held !== evaluation.tainted;
  return {
    eyebrow: 'What the desk does with this trace',
    headline: `${ACTION_WORDS[evaluation.action]} · ${money(item.fundingTotal, context.currency)}`,
    detail: incoherent ? `The funds were called ${evaluation.tainted ? 'tainted' : 'clean'} and the action is to ${readable(evaluation.action)}: the two answers disagree.` : undefined,
    facts: [
      { label: 'Holding funds the desk cannot take', value: yesNo(answers.tainted_funds.noul), tone: evaluation.tainted ? 'bad' : 'good' },
      { label: 'Nearest source', value: sentence(HOP_WORDS[evaluation.hops]), tone: ['ONE', 'TWO', 'THREE'].includes(evaluation.hops) ? 'warn' : undefined },
      { label: 'An exchange breaks the chain', value: yesNo(answers.chain_broken_by_exchange.noul), tone: evaluation.brokenByExchange ? 'good' : undefined },
      { label: 'Exposure', value: `${EXPOSURE_WORDS[Math.round(evaluation.exposure)]} · ${evaluation.exposure.toFixed(1)} of 6`, tone: evaluation.exposure >= EXPOSURE_BAR ? 'bad' : evaluation.exposure >= 3 ? 'warn' : 'good' },
      { label: 'Confidence in the action', value: `${Math.round(answers.action.confidence * 100)}%` },
    ],
  };
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
  caveat: 'A path walk of a dozen lines applies the desk’s rules to all 90 traces without error, so this run tests reading rules from prose, not finding what code cannot. Every trace that breaks the arithmetic rule also reaches a mixer or a listed address, so that rule is not tested on its own; a file that isolates each rule is planned.',
  grade: { labelId: (label) => label.traceId, judge },
  verdict,
  present: {
    number: 133,
    problem: {
      headline: 'The desk has four written rules for following money back. Someone has to apply them to every trace.',
      stat: '90',
      statLabel: 'traces, each followed back up to five hops',
    },
    hero: {
      item: 'TRC-083',
      caption: '$828,837 of funding, and 76% of it leads back to a listed address three hops away, just inside the distance the desk acts on. Called tainted, exposure 4.6 of 6, frozen.',
    },
    answers: {
      caption: 'Tainted or not, how far back, whether an exchange breaks the chain, and one exposure score the desk can set a bar on.',
      reveal: ['tainted_funds', 'hops_to_source', 'chain_broken_by_exchange', 'exposure'],
    },
    miss: {
      item: 'TRC-069',
      caption: '$539,414, and an exchange that checks identity sits between the subject and the mixer. The model sees the exchange and still says tainted, at 54%. Its exposure score drops to 2.3 and the desk clears it.',
    },
    proof: {
      kpis: ['Tainted funds found', 'Clean traces called tainted', 'The exchange rule applied'],
      chart: 'curve',
      closing: '34 of 34 tainted traces and no clean ones at an exposure of 4 of 6. The yes/no alone would have held $5.7m of clean money.',
    },
  },
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
