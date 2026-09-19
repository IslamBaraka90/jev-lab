// Chargeback evidence: judge the current packet, identify the decisive missing document and choose
// whether to submit, gather more evidence or accept the loss before the response deadline.

import { choice, noul, score } from '../lib/questions.js';

const DOCUMENTS = ['DELIVERY_PROOF', 'AVS_CVV', 'TERMS_ACCEPTANCE', 'COMMS_LOG', 'REFUND_PROOF', 'NONE'];
const STEPS = ['SUBMIT', 'GATHER_MORE', 'ACCEPT_LOSS'];
const WIN_THRESHOLD = 3.5;
const round = (value) => Number(value.toFixed(2));
const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
const share = (part, whole) => whole ? `${Number(((part / whole) * 100).toFixed(1))}%` : '—';

// #region demo:state
/** The current packet and the illustrative rule for its reason code; no planted outcome is included. */
function buildState(item, context) {
  const requirements = context.networkRequirements[item.dispute.reasonCode];
  return {
    task: 'Decide whether this chargeback evidence packet is ready to submit before its deadline.',
    packet_id: item.id,
    policy_notice: context.requirementsNotice,
    review_clock: {
      as_of: context.asOf,
      response_deadline: item.dispute.responseDeadline,
      typical_document_collection_days: context.documentCollectionDays,
    },
    reason_code: item.dispute.reasonCode,
    reason_requirements: requirements,
    order: item.order,
    dispute: item.dispute,
    evidence_checklist: item.evidence,
    transaction_signals: item.transactionSignals,
  };
}
// #endregion

// #region demo:questions
const questions = {
  win_likelihood: score('How likely is this evidence packet to win if submitted in its current form?', [
    'Hopeless', 'Very weak', 'Weak', 'Even', 'Strong', 'Very strong', 'Certain',
  ]),
  missing_document: choice('Which single document would most improve or complete this packet?', {
    DELIVERY_PROOF: 'Dated tracking, recipient signature or delivery confirmation tied to the supplied address.',
    AVS_CVV: 'The payment verification results showing the address and security-code response.',
    TERMS_ACCEPTANCE: 'A timestamped record of the customer accepting the applicable terms.',
    COMMS_LOG: 'The dated customer-service, delivery, return or cancellation conversation.',
    REFUND_PROOF: 'A processed refund or reversal record with its payment reference.',
    NONE: 'The current packet is complete, or no single missing document would make it viable.',
  }),
  next_step: choice('What should the disputes team do next?', {
    SUBMIT: 'Submit the current evidence before the response deadline.',
    GATHER_MORE: 'Obtain the decisive missing document while time remains.',
    ACCEPT_LOSS: 'Do not spend more operating time on a packet that cannot be repaired in time.',
  }),
  deadline_risk: noul('Is the response deadline too close to complete the normal evidence-gathering step?', {
    yes: 'Fewer days remain than the stated typical document-collection time.',
    no: 'The packet is ready or enough time remains to gather a document.',
  }),
};
// #endregion

// #region demo:evaluate
/** Keeps the continuous win score separate from the named document and operating step. */
function evaluate(answers, item) {
  const winScore = answers.win_likelihood.score;
  const nextStep = answers.next_step.choice;
  return {
    flagged: nextStep === 'GATHER_MORE',
    predictedOutcome: winScore >= WIN_THRESHOLD ? 'WIN' : 'LOSS',
    winScore,
    missingDocument: answers.missing_document.choice,
    nextStep,
    deadlineRisk: answers.deadline_risk.noul >= 0.5,
    deadlineRiskProbability: answers.deadline_risk.noul,
    amount: item.dispute.amount,
    label: `${item.id}: ${readable(nextStep)} · ${winScore.toFixed(1)}/6`,
  };
}
// #endregion

// #region demo:report
/** Separately grades outcome, missing evidence and action, then calibrates score bins against wins. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const intended = new Map(labels.map((label) => [label.packetId, label]));
  const graded = results.filter((result) => intended.has(result.item.id));
  const outcomeRight = graded.filter((result) => result.evaluation.predictedOutcome === intended.get(result.item.id).outcome);
  const missingRight = graded.filter((result) => result.evaluation.missingDocument === intended.get(result.item.id).missingDocument);
  const stepRight = graded.filter((result) => result.evaluation.nextStep === intended.get(result.item.id).nextStep);
  const gatherMore = graded.filter((result) => result.evaluation.nextStep === 'GATHER_MORE');
  const recoverable = round(gatherMore.reduce((sum, result) => sum + result.item.dispute.amount, 0));

  return {
    note: `Illustrative requirements only. ${graded.length} packets graded; labels never enter the model state.`,
    findings: repeatedMistake(graded, intended),
    kpis: headline(graded, outcomeRight, missingRight, stepRight, recoverable, context.currency),
    distribution: documentDistribution(graded),
    matrix: documentMatrix(graded, intended),
    curve: reliability(graded, intended),
    checks: cohortChecks(graded, intended),
    topItems: topGatherMore(gatherMore, context.currency),
    flips: flipOutcomes(graded, intended),
    money: { gatherMore: recoverable, totalDisputed: round(graded.reduce((sum, result) => sum + result.item.dispute.amount, 0)) },
    deadlineAccuracy: share(graded.filter((result) => result.evaluation.deadlineRisk === intended.get(result.item.id).deadlineRisk).length, graded.length),
  };
}
// #endregion

function headline(graded, outcomeRight, missingRight, stepRight, recoverable, currency) {
  const predictedWins = graded.filter((result) => result.evaluation.predictedOutcome === 'WIN').length;
  const actualWins = graded.filter((result) => result.evaluation.predictedOutcome === 'WIN' && outcomeRight.includes(result)).length
    + graded.filter((result) => result.evaluation.predictedOutcome === 'LOSS' && !outcomeRight.includes(result)).length;
  return [
    { label: 'Outcome accuracy', value: share(outcomeRight.length, graded.length), context: `${outcomeRight.length} of ${graded.length} current packets` },
    { label: 'Missing-document accuracy', value: share(missingRight.length, graded.length), context: `${missingRight.length} of ${graded.length} decisive documents` },
    { label: 'Next-step accuracy', value: share(stepRight.length, graded.length), context: `${predictedWins} predicted wins · ${actualWins} labelled wins` },
    { label: 'Gather-more value', value: money(recoverable, currency), context: 'Disputed amount in packets the model chose to improve', tone: recoverable ? 'good' : 'warn' },
  ];
}

function documentDistribution(graded) {
  return DOCUMENTS.map((document) => ({ label: readable(document), count: graded.filter((result) => result.evaluation.missingDocument === document).length, tone: document === 'NONE' ? 'good' : 'warn' })).filter((entry) => entry.count);
}

function documentMatrix(graded, intended) {
  return {
    title: 'Decisive document against the one named',
    columns: DOCUMENTS.map(readable),
    rows: DOCUMENTS.map((actual) => ({
      label: readable(actual),
      cells: DOCUMENTS.map((predicted) => ({ predicted, count: graded.filter((result) => intended.get(result.item.id).missingDocument === actual && result.evaluation.missingDocument === predicted).length, diagonal: actual === predicted })),
    })),
  };
}

function reliability(graded, intended) {
  const points = Array.from({ length: 7 }, (_, bin) => {
    const inBin = graded.filter((result) => Math.round(result.evaluation.winScore) === bin);
    const wins = inBin.filter((result) => intended.get(result.item.id).outcome === 'WIN').length;
    return { threshold: bin / 6, reviewed: inBin.length, caught: wins, rate: inBin.length ? wins / inBin.length : null };
  });
  return { title: 'Win-score reliability', xLabel: 'Model likelihood score', yLabel: 'Labelled wins', rateLabel: 'Observed win rate in score bin', of: graded.filter((result) => intended.get(result.item.id).outcome === 'WIN').length, points };
}

function cohortChecks(graded, intended) {
  return ['strong', 'one-document-away', 'hopeless', 'mixed'].map((kind) => {
    const group = graded.filter((result) => intended.get(result.item.id).kind === kind);
    const wrong = group.filter((result) => result.evaluation.predictedOutcome !== intended.get(result.item.id).outcome || result.evaluation.missingDocument !== intended.get(result.item.id).missingDocument || result.evaluation.nextStep !== intended.get(result.item.id).nextStep);
    return { id: kind, label: `${readable(kind)} packets with any wrong decision`, detail: `${group.length - wrong.length} of ${group.length} got outcome, document and step right.`, count: wrong.length, of: group.length, items: wrong.map((result) => result.item.id) };
  });
}

function topGatherMore(results, currency) {
  return [...results].sort((left, right) => right.item.dispute.amount - left.item.dispute.amount).slice(0, 10).map((result) => ({ id: result.item.id, label: `${readable(result.item.dispute.reasonCode)} · ${readable(result.evaluation.missingDocument)}`, value: `${money(result.item.dispute.amount, currency)} · ${result.evaluation.winScore.toFixed(1)}/6` }));
}

function flipOutcomes(graded, intended) {
  return graded.filter((result) => intended.get(result.item.id).flipsWithDocument).map((result) => ({ id: result.item.id, expectedDocument: intended.get(result.item.id).missingDocument, namedDocument: result.evaluation.missingDocument, gathered: result.evaluation.nextStep === 'GATHER_MORE', currentScore: result.evaluation.winScore }));
}

function repeatedMistake(graded, intended) {
  const wrong = graded.filter((result) => result.evaluation.missingDocument !== intended.get(result.item.id).missingDocument);
  if (wrong.length < 3) return [];
  const groups = new Map();
  for (const result of wrong) {
    const key = `${intended.get(result.item.id).missingDocument}→${result.evaluation.missingDocument}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const [pair, count] = [...groups].sort((left, right) => right[1] - left[1])[0];
  if (count < 3) return [];
  return [`${count} of ${wrong.length} missing-document errors repeat one swap: ${readable(pair.split('→')[0])} called ${readable(pair.split('→')[1])}.`];
}

export default {
  id: 'chargeback-evidence',
  title: 'Chargeback evidence',
  domain: 'orders',
  value: 'Judge whether an evidence packet can win the case, and name the document that would change the answer.',
  tags: ['orders', 'payments', 'chargebacks', 'evidence'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  status: 'pending-recording',
  itemLabel: (item) => `${item.id} · ${readable(item.dispute.reasonCode)} · ${money(item.dispute.amount, item.dispute.currency)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/chargeback-evidence.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'scripts/generate/chargeback-evidence.js#demo:data',
    state: 'demos/chargeback-evidence/demo.js#demo:state',
    questions: 'demos/chargeback-evidence/demo.js#demo:questions',
    evaluate: 'demos/chargeback-evidence/demo.js#demo:evaluate',
  },
};
