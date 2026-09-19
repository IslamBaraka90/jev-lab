// Account takeover: read a session timeline against the account's normal behaviour and choose the
// least disruptive intervention that still catches credential, SIM, hijack and insider attacks.

import { choice, noul, score } from '../lib/questions.js';

const SIGNALS = ['IMPOSSIBLE_TRAVEL', 'NEW_DEVICE', 'CREDENTIAL_RESET_CHAIN', 'BENEFICIARY_CHANGE', 'BEHAVIOUR_SHIFT', 'NONE'];
const ACTIONS = ['ALLOW', 'STEP_UP', 'BLOCK_SESSION', 'FREEZE_ACCOUNT'];
const TAKEOVER_SHAPES = ['CREDENTIAL_STUFFING', 'SIM_SWAP', 'SESSION_HIJACK', 'INSIDER_FAMILIAR_DEVICE'];
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const share = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '—';
const round = (value) => Number(value.toFixed(2));

// #region demo:state
/** The full dataset item plus bank policy; no takeover flag, shape or intended action is supplied. */
function buildState(item, context) {
  return {
    task: 'Decide whether an attacker controls this session and choose the least disruptive safe intervention.',
    review: { as_of: context.asOf, policy_notes: context.policyNotes },
    action_risk_weights: context.actionRiskWeights,
    friction_points: [
      { intervention: 'push approval', points: context.frictionWeights.pushApproval },
      { intervention: 'call back', points: context.frictionWeights.callBack },
      { intervention: 'document check', points: context.frictionWeights.documentCheck },
      { intervention: 'block session', points: context.frictionWeights.blockSession },
      { intervention: 'freeze account', points: context.frictionWeights.freezeAccount },
    ],
    session_case: item,
  };
}
// #endregion

// #region demo:questions
const questions = {
  takeover_likelihood: score('How likely is it that an attacker, rather than the customer, controls this session?', [
    'None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain',
  ]),
  strongest_signal: choice('Which signal carries the most weight in this decision?', {
    IMPOSSIBLE_TRAVEL: 'The raw login times and countries cannot plausibly belong to one traveller.',
    NEW_DEVICE: 'An unrecognised device is the strongest unexplained departure from account history.',
    CREDENTIAL_RESET_CHAIN: 'Credential or phone recovery is immediately followed by sensitive changes.',
    BENEFICIARY_CHANGE: 'A new payee followed by a transfer is the decisive change.',
    BEHAVIOUR_SHIFT: 'The timing, amount or action sequence is unlike the account despite familiar access.',
    NONE: 'No single risk signal justifies intervening in this session.',
  }),
  action: choice('What should the bank do with this session now?', {
    ALLOW: 'Continue without an extra customer challenge.',
    STEP_UP: 'Pause only for an additional customer verification.',
    BLOCK_SESSION: 'End this session while leaving the wider account usable.',
    FREEZE_ACCOUNT: 'Stop account activity pending a fraud investigation.',
  }),
  step_up_method: choice('Which verification method is proportionate if additional assurance is needed?', {
    PUSH_APPROVAL: 'Send an approval to an already trusted device.',
    CALL_BACK: 'Call the customer on a previously verified number.',
    DOCUMENT_CHECK: 'Require identity-document verification.',
    NOT_NEEDED: 'No step-up is appropriate because the session is allowed, blocked or frozen.',
  }),
  customer_friction_justified: noul('Is the customer friction created by the chosen intervention justified by the evidence?', {
    yes: 'The intervention is proportionate to the risk and expected loss.',
    no: 'The evidence does not justify challenging or restricting the customer.',
  }),
};
// #endregion

// #region demo:evaluate
/** Keeps likelihood, signal, intervention and friction explicit for threshold and decoy analysis. */
function evaluate(answers, item, context) {
  const action = answers.action.choice;
  const stepUpMethod = answers.step_up_method.choice;
  return {
    flagged: action !== 'ALLOW',
    likelihood: answers.takeover_likelihood.score,
    predictedTakeover: answers.takeover_likelihood.score >= 3.5,
    strongestSignal: answers.strongest_signal.choice,
    action,
    stepUpMethod,
    challenged: action !== 'ALLOW',
    frictionJustified: answers.customer_friction_justified.noul >= 0.5,
    frictionProbability: answers.customer_friction_justified.noul,
    frictionCost: interventionFriction(action, stepUpMethod, context.frictionWeights),
    label: `${item.id}: ${readable(action)} · ${answers.takeover_likelihood.score.toFixed(1)}/6`,
  };
}
// #endregion

// #region demo:report
/** Pairs every catch measure with legitimate-customer friction and audits all planted shapes/decoys. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const intended = new Map(labels.map((label) => [label.sessionId, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const takeovers = graded.filter((result) => intended.get(result.item.id).takeover);
  const genuine = graded.filter((result) => !intended.get(result.item.id).takeover);
  const caught = takeovers.filter((result) => result.evaluation.action !== 'ALLOW');
  const challenged = genuine.filter((result) => result.evaluation.action !== 'ALLOW');
  const friction = round(challenged.reduce((sum, result) => sum + result.evaluation.frictionCost, 0));
  const actionRight = graded.filter((result) => result.evaluation.action === intended.get(result.item.id).action);

  return {
    note: `${graded.length} sessions graded. Catch rate is always shown with legitimate-customer friction.`,
    findings: repeatedMistake(graded, intended),
    kpis: headline(graded, takeovers, genuine, caught, challenged, friction, actionRight),
    distribution: signalDistribution(graded),
    matrix: signalMatrix(graded, intended),
    curve: thresholdCurve(graded, intended, context.frictionWeights),
    checks: shapeChecks(graded, intended),
    topItems: highestRisk(graded),
    decoys: decoyOutcomes(graded, intended),
    friction: { points: friction, challengedLegitimate: challenged.length, legitimateSessions: genuine.length },
  };
}
// #endregion

function interventionFriction(action, method, weights) {
  if (action === 'ALLOW') return 0;
  if (action === 'BLOCK_SESSION') return weights.blockSession;
  if (action === 'FREEZE_ACCOUNT') return weights.freezeAccount;
  if (method === 'PUSH_APPROVAL') return weights.pushApproval;
  if (method === 'CALL_BACK') return weights.callBack;
  if (method === 'DOCUMENT_CHECK') return weights.documentCheck;
  return weights.callBack;
}

function headline(graded, takeovers, genuine, caught, challenged, friction, actionRight) {
  return [
    { label: 'Takeovers caught', value: share(caught.length, takeovers.length), context: `${caught.length} of ${takeovers.length} · ${friction} legitimate friction points`, tone: caught.length === takeovers.length ? 'good' : 'warn' },
    { label: 'Genuine sessions challenged', value: share(challenged.length, genuine.length), context: `${challenged.length} of ${genuine.length} · ${friction} friction points`, tone: challenged.length ? 'warn' : 'good' },
    { label: 'Action accuracy', value: share(actionRight.length, graded.length), context: `${actionRight.length} of ${graded.length} least-disruptive actions` },
    { label: 'Friction cost', value: `${friction} points`, context: 'Weighted only across legitimate sessions challenged', tone: friction ? 'warn' : 'good' },
  ];
}

function signalDistribution(graded) {
  return SIGNALS.map((signal) => ({ label: readable(signal), count: graded.filter((result) => result.evaluation.strongestSignal === signal).length, tone: signal === 'NONE' ? 'good' : 'warn' })).filter((entry) => entry.count);
}

function signalMatrix(graded, intended) {
  return {
    title: 'Planted strongest signal against the one named',
    columns: SIGNALS.map(readable),
    rows: SIGNALS.map((actual) => ({ label: readable(actual), cells: SIGNALS.map((predicted) => ({ predicted, count: graded.filter((result) => intended.get(result.item.id).strongestSignal === actual && result.evaluation.strongestSignal === predicted).length, diagonal: actual === predicted })) })),
  };
}

function thresholdCurve(graded, intended, weights) {
  const takeoverCount = graded.filter((result) => intended.get(result.item.id).takeover).length;
  const points = Array.from({ length: 7 }, (_, score) => {
    const challenged = graded.filter((result) => result.evaluation.likelihood >= score);
    const caught = challenged.filter((result) => intended.get(result.item.id).takeover).length;
    const legitimate = challenged.filter((result) => !intended.get(result.item.id).takeover);
    const frictionCost = round(legitimate.reduce((sum, result) => sum + interventionFriction('STEP_UP', result.evaluation.stepUpMethod, weights), 0));
    return { threshold: score / 6, reviewed: frictionCost, caught, rate: takeoverCount ? caught / takeoverCount : null, challenged: challenged.length, frictionCost };
  });
  return { title: 'Likelihood threshold: catches beside friction', xLabel: 'Legitimate friction points', yLabel: 'Takeovers caught', rateLabel: 'Takeover catch rate', of: takeoverCount, points };
}

function shapeChecks(graded, intended) {
  return TAKEOVER_SHAPES.map((shape) => {
    const group = graded.filter((result) => intended.get(result.item.id).shape === shape);
    const missed = group.filter((result) => result.evaluation.action === 'ALLOW');
    return { id: shape.toLowerCase(), label: `${readable(shape)} sessions allowed`, detail: `${group.length - missed.length} of ${group.length} caught · friction reported in headline and curve.`, count: missed.length, of: group.length, items: missed.map((result) => result.item.id) };
  });
}

function decoyOutcomes(graded, intended) {
  return graded.filter((result) => intended.get(result.item.id).kind === 'innocent-lookalike').map((result) => ({ id: result.item.id, shape: intended.get(result.item.id).shape, action: result.evaluation.action, method: result.evaluation.stepUpMethod, frictionCost: result.evaluation.frictionCost, expectedAction: intended.get(result.item.id).action }));
}

function highestRisk(graded) {
  return [...graded].sort((left, right) => right.evaluation.likelihood - left.evaluation.likelihood).slice(0, 10).map((result) => ({ id: result.item.id, label: `${result.item.account.customerName} · ${readable(result.evaluation.strongestSignal)}`, value: `${result.evaluation.likelihood.toFixed(1)}/6 · ${readable(result.evaluation.action)} · ${result.evaluation.frictionCost} points` }));
}

function repeatedMistake(graded, intended) {
  const wrong = graded.filter((result) => result.evaluation.strongestSignal !== intended.get(result.item.id).strongestSignal);
  if (wrong.length < 3) return [];
  const groups = new Map();
  for (const result of wrong) {
    const key = `${intended.get(result.item.id).strongestSignal}→${result.evaluation.strongestSignal}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const [pair, count] = [...groups].sort((left, right) => right[1] - left[1])[0];
  if (count < 3) return [];
  return [`${count} of ${wrong.length} signal errors repeat one swap: ${readable(pair.split('→')[0])} called ${readable(pair.split('→')[1])}.`];
}

export default {
  id: 'account-takeover',
  title: 'Account takeover',
  domain: 'fraud',
  value: 'Tell a stolen session from a customer on a new phone, and choose the check that gets in the way least.',
  tags: ['fraud', 'accounts', 'sessions', 'authentication'],
  dataClass: 'synthetic',
  readMinutes: 5,
  view: 'timeline',
  itemLabel: (item) => `${item.id} · ${item.account.customerName} · ${item.session.network.country}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/account-takeover.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/account-takeover.js#demo:data',
    state: 'demos/account-takeover/demo.js#demo:state',
    questions: 'demos/account-takeover/demo.js#demo:questions',
    evaluate: 'demos/account-takeover/demo.js#demo:evaluate',
  },
};
