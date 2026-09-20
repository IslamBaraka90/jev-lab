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

  const hard = graded.filter((result) => intended.get(result.item.id).kind !== 'normal');
  const hardRight = hard.filter((result) => actionRight.includes(result));
  const overEscalated = takeovers.filter((result) => heavierThanPolicy(result, intended));

  return {
    note: `${graded.length} sessions graded. Catch rate is always shown with legitimate-customer friction.`,
    findings: [...hardSliceFindings(graded, hard, hardRight, overEscalated, intended), ...repeatedMistake(graded, intended)],
    kpis: headline(graded, takeovers, genuine, caught, challenged, friction, actionRight, hard, hardRight, overEscalated),
    baselines: baselines(graded, intended, actionRight),
    metrics: metrics(graded, takeovers, caught, challenged, actionRight),
    distribution: signalDistribution(graded),
    distributionTitle: 'Strongest signal named',
    matrix: signalMatrix(graded, intended),
    curve: thresholdCurve(graded, intended, context.frictionWeights),
    checks: shapeChecks(graded, intended),
    topItems: highestRisk(graded),
    topItemsTitle: 'Highest takeover likelihood',
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

function headline(graded, takeovers, genuine, caught, challenged, friction, actionRight, hard, hardRight, overEscalated) {
  const plain = graded.length - hard.length;
  return [
    { label: 'Action accuracy', value: share(actionRight.length, graded.length), context: `${actionRight.length} of ${graded.length} least-disruptive actions · ${plain} of the sessions are plain ones nobody would challenge` },
    { label: 'Right action, hard sessions', value: share(hardRight.length, hard.length), context: `${hardRight.length} of ${hard.length} takeovers and innocent lookalikes`, tone: hardRight.length === hard.length ? 'good' : hardRight.length * 2 >= hard.length ? 'warn' : 'bad' },
    { label: 'Takeovers caught', value: share(caught.length, takeovers.length), context: `${caught.length} of ${takeovers.length} · ${friction} legitimate friction points`, tone: caught.length === takeovers.length ? 'good' : 'warn' },
    { label: 'Genuine sessions challenged', value: share(challenged.length, genuine.length), context: `${challenged.length} of ${genuine.length}`, tone: challenged.length ? 'warn' : 'good' },
    { label: 'Takeovers over-escalated', value: `${overEscalated.length} of ${takeovers.length}`, context: 'a heavier control than the policy asks for', tone: overEscalated.length ? 'warn' : 'good' },
  ];
}

/** True when the chosen control sits higher on the ladder than the least-disruptive one. */
function heavierThanPolicy(result, intended) {
  return ACTIONS.indexOf(result.evaluation.action) > ACTIONS.indexOf(intended.get(result.item.id).action);
}

const SENSITIVE_EVENTS = ['PASSWORD_RESET', 'CHANGE_EMAIL', 'CHANGE_PHONE', 'RAISE_LIMIT', 'ADD_BENEFICIARY', 'DEVICE_ENROLLED', 'SESSION_CONTEXT_CHANGE'];

// The rule: block the session on any credential, limit, device or payee event; verify on a new device; otherwise allow.
function ruleAction(item) {
  if (item.timeline.some((event) => SENSITIVE_EVENTS.includes(event.type))) return 'BLOCK_SESSION';
  return item.session.device.isNew ? 'STEP_UP' : 'ALLOW';
}

function baselines(graded, intended, actionRight) {
  if (!graded.length) return undefined;
  const ruleRight = graded.filter((result) => ruleAction(result.item) === intended.get(result.item.id).action);
  const allowRight = graded.filter((result) => intended.get(result.item.id).action === 'ALLOW');
  return [
    { label: 'Jev', detail: 'least-disruptive action, all sessions', value: actionRight.length / graded.length, model: true },
    { label: 'Rule: block on a sensitive event, verify a new device', detail: 'three lines over the timeline and the device flag', value: ruleRight.length / graded.length },
    { label: 'Always allow', detail: 'the commonest action', value: allowRight.length / graded.length },
  ];
}

function metrics(graded, takeovers, caught, challenged, actionRight) {
  const stopped = caught.length + challenged.length;
  const methodWithoutStepUp = graded.filter((result) => result.evaluation.action !== 'STEP_UP' && result.evaluation.stepUpMethod !== 'NOT_NEEDED');
  return {
    headline: { label: 'Action accuracy', value: graded.length ? actionRight.length / graded.length : 0, n: graded.length },
    accuracy: graded.length ? actionRight.length / graded.length : null,
    recall: takeovers.length ? caught.length / takeovers.length : null,
    precision: stopped ? caught.length / stopped : null,
    contradictionRate: graded.length ? methodWithoutStepUp.length / graded.length : null,
  };
}

function hardSliceFindings(graded, hard, hardRight, overEscalated, intended) {
  const lines = [];
  if (hard.length && hardRight.length < hard.length) {
    lines.push(`On the ${hard.length} sessions that are not plain, the least-disruptive action was chosen ${hardRight.length} times (${share(hardRight.length, hard.length)}). The overall accuracy is carried by the ${graded.length - hard.length} plain sessions.`);
  }
  if (overEscalated.length) lines.push(`${overEscalated.length} takeovers were given a heavier control than the policy asks for (${overEscalated.map((result) => result.item.id).join(', ')}). Friction is counted only on genuine customers, so that costs nothing in this report; at a bank each one is a call-centre case.`);

  const heavyDecoys = graded.filter((result) => !intended.get(result.item.id).takeover && heavierThanPolicy(result, intended));
  const byShape = new Map();
  for (const result of heavyDecoys) {
    const shape = readable(intended.get(result.item.id).shape);
    byShape.set(shape, (byShape.get(shape) ?? 0) + 1);
  }
  if (heavyDecoys.length) lines.push(`${heavyDecoys.length} genuine customers got a heavier control than the policy asks for: ${[...byShape].map(([shape, count]) => `${count} × ${shape}`).join(', ')}.`);

  const ruleRight = graded.filter((result) => ruleAction(result.item) === intended.get(result.item.id).action);
  const modelRight = graded.filter((result) => result.evaluation.action === intended.get(result.item.id).action);
  if (hard.length && ruleRight.length >= modelRight.length && modelRight.length < graded.length) {
    lines.push(`A three-line rule over the timeline picks the policy action on ${ruleRight.length} of ${graded.length} sessions, ${ruleRight.length === modelRight.length ? 'the same as' : 'more than'} the model’s ${modelRight.length}.`);
  }

  const methodWithoutStepUp = graded.filter((result) => result.evaluation.action !== 'STEP_UP' && result.evaluation.stepUpMethod !== 'NOT_NEEDED');
  if (methodWithoutStepUp.length >= 10) lines.push(`A verification method was named on ${methodWithoutStepUp.length} sessions where the action was not a step-up. The method is answered as a hypothetical and only means something beside a step-up.`);
  return lines;
}

function signalDistribution(graded) {
  return SIGNALS.map((signal) => ({ label: readable(signal), count: graded.filter((result) => result.evaluation.strongestSignal === signal).length, tone: signal === 'NONE' ? 'good' : 'warn' })).filter((entry) => entry.count);
}

function signalMatrix(graded, intended) {
  return {
    title: 'Planted strongest signal against the one named',
    rowLabel: 'the signal that was planted',
    columnLabel: 'the signal the model named',
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
  return { title: 'Likelihood threshold: catches beside friction', xLabel: 'Legitimate friction points', yLabel: 'Takeovers caught', rateLabel: 'Takeover catch rate', of: takeoverCount, points, thresholdFormat: 'level', levels: 6, defaultIndex: 3 };
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
  return [...graded].sort((left, right) => right.evaluation.likelihood - left.evaluation.likelihood).slice(0, 10).map((result) => ({ id: result.item.id, label: `${result.item.id} · ${result.item.account.customerName} · ${readable(result.evaluation.strongestSignal)}`, value: `${result.evaluation.likelihood.toFixed(1)} of 6 · ${readable(result.evaluation.action)}` }));
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

const levelName = (value) => questions.takeover_likelihood.criteria[Math.max(0, Math.min(6, Math.round(value)))];

/** What a planted session was, in a sentence. Plain sessions carry no note. */
function plantedNote(label) {
  if (label.kind === 'takeover') return `Planted as a takeover: ${readable(label.shape)}.`;
  if (label.kind === 'innocent-lookalike') return `Planted as an innocent lookalike: ${readable(label.shape)}.`;
  return undefined;
}

// Right means the least-disruptive action the policy gives, which is what "Action accuracy" counts.
const grade = {
  labelId: (label) => label.sessionId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.action === label.action,
      expected: label.action,
      got: result.evaluation.action,
      note: plantedNote(label),
      confidence: result.answers.action.confidence,
    };
  },
};

function verdict(result) {
  const { answers, evaluation } = result;
  const steppedUp = evaluation.action === 'STEP_UP';
  const likelihood = evaluation.likelihood;
  const facts = [
    { label: 'Takeover likelihood', value: `${levelName(likelihood)} · ${likelihood.toFixed(1)} of 6`, tone: likelihood >= 3.5 ? 'bad' : likelihood >= 2.5 ? 'warn' : 'good' },
    { label: 'Strongest signal', value: readable(evaluation.strongestSignal) },
  ];
  if (steppedUp) facts.push({ label: 'Verification method', value: readable(evaluation.stepUpMethod) });
  if (evaluation.challenged) {
    facts.push({ label: 'Friction if the customer is genuine', value: `${evaluation.frictionCost} ${evaluation.frictionCost === 1 ? 'point' : 'points'}`, tone: evaluation.frictionCost >= 8 ? 'warn' : undefined });
  }
  facts.push({ label: 'Confidence in the action', value: `${Math.round(answers.action.confidence * 100)}%` });

  return {
    eyebrow: 'What the bank does with this session',
    headline: `${readable(evaluation.action).replace(/^./, (letter) => letter.toUpperCase())}${steppedUp ? ` · ${readable(evaluation.stepUpMethod)}` : ''}`,
    facts,
  };
}

const present = {
  number: 122,
  problem: {
    headline: 'A stolen session and a customer on a new phone look alike for the first few seconds. The bank has to pick the lightest check that still stops the theft.',
    stat: '260',
    statLabel: 'sessions, 14 of them takeovers',
  },
  hero: {
    item: 'SES-0083',
    caption: 'An unknown device logs in, changes the phone number by SMS recovery, raises the limit from 5,000 to 30,000, adds a payee and sends $25,369.98, all in nine minutes. 5.7 of 6: freeze the account.',
  },
  answers: {
    caption: 'The likelihood says how sure, the signal says why, and the action is the control the bank applies.',
    reveal: ['takeover_likelihood', 'strongest_signal', 'action'],
  },
  miss: {
    item: 'SES-0026',
    caption: 'A $15,448.39 property deposit to a new payee, which the customer had told the bank was coming. The policy asks for a call-back, 3 friction points; the model ended the session, 8.',
  },
  proof: {
    kpis: ['Takeovers caught', 'Right action, hard sessions', 'Takeovers over-escalated'],
    chart: 'baselines',
    closing: '14 of 14 takeovers caught, and the least-disruptive action on 12 of the 34 sessions that were not plain.',
  },
};

export default {
  id: 'account-takeover',
  title: 'Account takeover',
  domain: 'fraud',
  value: 'Tell a stolen session from a customer on a new phone, and choose the check that gets in the way least.',
  tags: ['fraud', 'accounts', 'sessions', 'authentication'],
  dataClass: 'synthetic',
  readMinutes: 5,
  caveat: 'The 226 plain sessions are three-event logins on a known device and each attack follows one fixed template, so the likelihood score separates the classes perfectly and a three-line rule matches the model’s action accuracy; a harder dataset is planned.',
  view: 'timeline',
  itemLabel: (item) => `${item.id} · ${item.account.customerName} · ${item.session.network.country}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/account-takeover.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  grade,
  verdict,
  present,
  explain: {
    data: 'scripts/generate/account-takeover.js#demo:data',
    state: 'demos/account-takeover/demo.js#demo:state',
    questions: 'demos/account-takeover/demo.js#demo:questions',
    evaluate: 'demos/account-takeover/demo.js#demo:evaluate',
  },
};
