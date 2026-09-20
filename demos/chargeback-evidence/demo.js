// Chargeback evidence: judge the current packet, identify the decisive missing document and choose
// whether to submit, gather more evidence or accept the loss before the response deadline.

import { choice, noul, score } from '../lib/questions.js';

const DOCUMENTS = ['DELIVERY_PROOF', 'AVS_CVV', 'TERMS_ACCEPTANCE', 'COMMS_LOG', 'REFUND_PROOF', 'NONE'];
const STEPS = ['SUBMIT', 'GATHER_MORE', 'ACCEPT_LOSS'];
const WIN_THRESHOLD = 3.5;
const WIN_LEVELS = ['Hopeless', 'Very weak', 'Weak', 'Even', 'Strong', 'Very strong', 'Certain'];
const KINDS = ['strong', 'one-document-away', 'hopeless', 'mixed'];
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase()).replace(/\bavs cvv\b/i, 'AVS and CVV');
const wholeMoney = (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const amountOf = (results) => round(results.reduce((sum, result) => sum + result.item.dispute.amount, 0));
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

  return {
    note: `Illustrative requirements only. ${graded.length} packets graded; labels never enter the model state.`,
    findings: [...repeatedMistake(graded, intended), ...honestFindings(graded, intended, context)],
    kpis: headline(graded, { outcomeRight, missingRight, stepRight, gatherMore }, intended, context.currency),
    distributionTitle: 'Documents named as the one to fetch',
    distribution: documentDistribution(graded),
    baselines: baselines(graded, outcomeRight, intended, context),
    matrix: documentMatrix(graded, intended),
    curve: winCutCurve(graded, intended),
    winRateByScore: winRateByScore(graded, intended),
    checks: cohortChecks(graded, intended),
    topItemsTitle: 'Largest disputes sent to gather more',
    topItems: topGatherMore(gatherMore, context.currency),
    flips: flipOutcomes(graded, intended),
    money: gatherMoney(graded, gatherMore, intended),
    deadlineAccuracy: share(graded.filter((result) => result.evaluation.deadlineRisk === intended.get(result.item.id).deadlineRisk).length, graded.length),
    metrics: metrics(graded, outcomeRight, stepRight, intended),
  };
}
// #endregion

const ofKind = (results, intended, kind) => results.filter((result) => intended.get(result.item.id).kind === kind);

/** Outcomes right if a win were called at `cut` instead of the fixed threshold. */
function rightAtCut(graded, intended, cut) {
  return graded.filter((result) => (result.evaluation.winScore >= cut ? 'WIN' : 'LOSS') === intended.get(result.item.id).outcome).length;
}

/** The half-step cut that gets the most outcomes right, lowest first on a tie. */
function bestCut(graded, intended) {
  const cuts = Array.from({ length: 13 }, (_, step) => step / 2);
  return cuts.map((cut) => ({ cut, right: rightAtCut(graded, intended, cut) })).sort((left, right) => right.right - left.right || left.cut - right.cut)[0];
}

function allThreeRight(result, intended) {
  const label = intended.get(result.item.id);
  return result.evaluation.predictedOutcome === label.outcome && result.evaluation.missingDocument === label.missingDocument && result.evaluation.nextStep === label.nextStep;
}

function headline(graded, { outcomeRight, missingRight, stepRight, gatherMore }, intended, currency) {
  const best = bestCut(graded, intended);
  const cutNote = best.right > outcomeRight.length ? ` · ${best.right} at a cut of ${best.cut}` : '';
  const oneAway = ofKind(graded, intended, 'one-document-away');
  const oneAwayRight = oneAway.filter((result) => allThreeRight(result, intended));
  const lossLabels = graded.filter((result) => intended.get(result.item.id).nextStep === 'ACCEPT_LOSS');
  const lossesAccepted = lossLabels.filter((result) => result.evaluation.nextStep === 'ACCEPT_LOSS');
  const chasedHopeless = ofKind(gatherMore, intended, 'hopeless');
  return [
    { label: 'Outcome accuracy', value: share(outcomeRight.length, graded.length), context: `${outcomeRight.length} of ${graded.length} current packets, calling a win at ${WIN_THRESHOLD} of 6${cutNote}` },
    { label: 'Missing-document accuracy', value: share(missingRight.length, graded.length), context: `${missingRight.length} of ${graded.length} decisive documents` },
    { label: 'Next-step accuracy', value: share(stepRight.length, graded.length), context: `accept the loss chosen on ${lossesAccepted.length} of the ${lossLabels.length} packets labelled for it`, tone: lossLabels.length && !lossesAccepted.length ? 'warn' : undefined },
    { label: 'One document from winning', value: `${oneAwayRight.length} of ${oneAway.length}`, context: `outcome, document and step all right · ${wholeMoney(amountOf(oneAway), currency)} disputed in these packets`, tone: oneAwayRight.length === oneAway.length ? 'good' : 'warn' },
    { label: 'Gather-more value', value: wholeMoney(amountOf(gatherMore), currency), context: `${wholeMoney(amountOf(ofKind(gatherMore, intended, 'one-document-away')), currency)} one document from winning · ${wholeMoney(amountOf(chasedHopeless), currency)} on packets labelled hopeless`, tone: chasedHopeless.length ? 'warn' : undefined },
  ];
}

function gatherMoney(graded, gatherMore, intended) {
  const wins = graded.filter((result) => intended.get(result.item.id).outcome === 'WIN');
  return {
    gatherMore: amountOf(gatherMore),
    gatherOneDocumentAway: amountOf(ofKind(gatherMore, intended, 'one-document-away')),
    gatherHopeless: amountOf(ofKind(gatherMore, intended, 'hopeless')),
    labelledWinValue: amountOf(wins),
    labelledWinValueSubmitted: amountOf(wins.filter((result) => result.evaluation.nextStep === 'SUBMIT')),
    totalDisputed: amountOf(graded),
  };
}

/** The rule: the packet wins when every decisive document for its reason code is marked present. */
function ruleOutcome(item, context) {
  const decisive = context.networkRequirements?.[item.dispute.reasonCode]?.decisive ?? [];
  return decisive.length && decisive.every((document) => item.evidence[document]?.present) ? 'WIN' : 'LOSS';
}

function ruleAgreement(graded, intended, context) {
  return graded.filter((result) => ruleOutcome(result.item, context) === intended.get(result.item.id).outcome).length;
}

function baselines(graded, outcomeRight, intended, context) {
  if (!graded.length) return undefined;
  const losses = graded.filter((result) => intended.get(result.item.id).outcome === 'LOSS');
  const wins = graded.length - losses.length;
  return [
    { label: 'Jev', detail: `win or loss as the packet stands, calling a win at ${WIN_THRESHOLD} of 6`, value: outcomeRight.length / graded.length, model: true },
    { label: 'Rule: decisive document present', detail: 'reads the present flag against the requirement in the state', value: ruleAgreement(graded, intended, context) / graded.length },
    { label: 'Always the commonest outcome', detail: losses.length >= wins ? 'loss' : 'win', value: Math.max(losses.length, wins) / graded.length },
  ];
}

function metrics(graded, outcomeRight, stepRight, intended) {
  if (!graded.length) return undefined;
  const calledWins = graded.filter((result) => result.evaluation.predictedOutcome === 'WIN');
  const wins = graded.filter((result) => intended.get(result.item.id).outcome === 'WIN');
  const trueWins = calledWins.filter((result) => intended.get(result.item.id).outcome === 'WIN');
  const best = bestCut(graded, intended);
  return {
    headline: { label: 'Outcome accuracy', value: outcomeRight.length / graded.length, n: graded.length },
    accuracy: outcomeRight.length / graded.length,
    precision: calledWins.length ? trueWins.length / calledWins.length : null,
    recall: wins.length ? trueWins.length / wins.length : null,
    accuracyAtBestCut: best.right / graded.length,
    bestCut: best.cut,
    nextStepAccuracy: stepRight.length / graded.length,
  };
}

function honestFindings(graded, intended, context) {
  const lines = [];
  const right = rightAtCut(graded, intended, WIN_THRESHOLD);
  const best = bestCut(graded, intended);
  const missedWins = graded.filter((result) => intended.get(result.item.id).outcome === 'WIN' && result.evaluation.predictedOutcome === 'LOSS');
  if (best.right > right) lines.push(`The cut, not the score, costs the outcome accuracy: ${missedWins.length} labelled wins scored under ${WIN_THRESHOLD} of 6. Calling a win at ${best.cut} gets ${best.right} of ${graded.length} right instead of ${right}, with the same answers.`);

  const lossLabels = graded.filter((result) => intended.get(result.item.id).nextStep === 'ACCEPT_LOSS');
  const chased = lossLabels.filter((result) => result.evaluation.nextStep === 'GATHER_MORE');
  if (chased.length) lines.push(`${chased.length} of the ${lossLabels.length} packets labelled accept the loss were sent to gather more, ${wholeMoney(amountOf(chased), context.currency)} of disputes chased after the label gave up. The state never says when a packet is past repair, so this is a missing rule as much as a miss.`);

  const complete = graded.filter((result) => intended.get(result.item.id).missingDocument === 'NONE');
  const overAsked = complete.filter((result) => result.evaluation.missingDocument !== 'NONE');
  if (overAsked.length) lines.push(`${overAsked.length} of the ${complete.length} complete packets were still given a document to fetch.`);

  const ruleRight = ruleAgreement(graded, intended, context);
  if (ruleRight > right) lines.push(`Checking whether the decisive document is marked present gets ${ruleRight} of ${graded.length} outcomes right, against the model's ${right}. The requirement is in the state, so the outcome here is a lookup.`);
  return lines;
}

function documentDistribution(graded) {
  return DOCUMENTS.map((document) => ({ label: sentence(document), count: graded.filter((result) => result.evaluation.missingDocument === document).length })).filter((entry) => entry.count);
}

function documentMatrix(graded, intended) {
  return {
    title: 'Decisive document against the one named',
    rowLabel: 'the document the label says is missing',
    columnLabel: 'the document the model named',
    columns: DOCUMENTS.map(sentence),
    rows: DOCUMENTS.map((actual) => ({
      label: sentence(actual),
      cells: DOCUMENTS.map((predicted) => ({ predicted, count: graded.filter((result) => intended.get(result.item.id).missingDocument === actual && result.evaluation.missingDocument === predicted).length, diagonal: actual === predicted })),
    })),
  };
}

/** Packets called a win at each score or higher, and how many of those the label agrees are wins. */
function winCutCurve(graded, intended) {
  const isWin = (result) => intended.get(result.item.id).outcome === 'WIN';
  const points = Array.from({ length: 7 }, (_, bar) => {
    const called = graded.filter((result) => result.evaluation.winScore >= bar);
    const wins = called.filter(isWin).length;
    return { threshold: bar / 6, reviewed: called.length, caught: wins, rate: called.length ? wins / called.length : null };
  });
  // The slider opens on the whole level that gets the most outcomes right.
  const rightAt = points.map((_, bar) => rightAtCut(graded, intended, bar));
  return { title: 'Where to call a win', xLabel: 'Packets called a win at this score or higher', yLabel: 'Labelled wins among them', rateLabel: 'Share of the called wins that are wins', of: graded.filter(isWin).length, thresholdFormat: 'level', levels: 6, defaultIndex: rightAt.indexOf(Math.max(...rightAt)), points };
}

/** One row per score level: the packets that scored nearest it and how many of them the label calls wins. */
function winRateByScore(graded, intended) {
  return WIN_LEVELS.map((level, bin) => {
    const inBin = graded.filter((result) => Math.round(result.evaluation.winScore) === bin);
    const wins = inBin.filter((result) => intended.get(result.item.id).outcome === 'WIN').length;
    return { score: `${bin} · ${level}`, packets: inBin.length, labelledWins: wins, winRatePercent: inBin.length ? Number(((wins / inBin.length) * 100).toFixed(1)) : 0 };
  }).filter((row) => row.packets);
}

function cohortChecks(graded, intended) {
  return KINDS.map((kind) => {
    const group = graded.filter((result) => intended.get(result.item.id).kind === kind);
    const wrong = group.filter((result) => result.evaluation.predictedOutcome !== intended.get(result.item.id).outcome || result.evaluation.missingDocument !== intended.get(result.item.id).missingDocument || result.evaluation.nextStep !== intended.get(result.item.id).nextStep);
    return { id: kind, label: `${sentence(kind.replaceAll('-', ' '))} packets with any wrong decision`, detail: `${group.length - wrong.length} of ${group.length} got outcome, document and step right.`, count: wrong.length, of: group.length, items: wrong.map((result) => result.item.id) };
  });
}

function topGatherMore(results, currency) {
  return [...results].sort((left, right) => right.item.dispute.amount - left.item.dispute.amount).slice(0, 10).map((result) => ({ id: result.item.id, label: `${result.item.id} · ${readable(result.item.dispute.reasonCode)} · ${readable(result.evaluation.missingDocument)}`, value: `${money(result.item.dispute.amount, currency)} · ${result.evaluation.winScore.toFixed(1)}/6` }));
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

const percentOf = (value) => `${Math.round(value * 100)}%`;
const levelOf = (value) => `${WIN_LEVELS[Math.round(value)]} · ${value.toFixed(1)} of 6`;
const STEP_WORDS = { SUBMIT: 'Submit now', GATHER_MORE: 'Gather more', ACCEPT_LOSS: 'Accept the loss' };

function daysLeft(item, context) {
  if (!context?.asOf) return null;
  return Math.round((Date.parse(item.dispute.responseDeadline) - Date.parse(context.asOf)) / 86_400_000);
}

function verdict(result, context) {
  const { evaluation, answers, item } = result;
  const currency = item.dispute.currency ?? context?.currency;
  const remaining = daysLeft(item, context);
  const clock = remaining === null ? '' : `, ${remaining} ${remaining === 1 ? 'day' : 'days'} to the deadline; fetching a document typically takes ${context.documentCollectionDays}`;
  const document = evaluation.missingDocument === 'NONE' ? 'nothing to fetch' : readable(evaluation.missingDocument);
  const risk = answers.deadline_risk.noul;
  return {
    eyebrow: 'What the disputes team does with this packet',
    headline: `${STEP_WORDS[evaluation.nextStep]} · ${document}`,
    detail: `${money(evaluation.amount, currency)} disputed as ${readable(item.dispute.reasonCode)}${clock}.`,
    facts: [
      { label: 'Wins as it stands', value: levelOf(evaluation.winScore), tone: evaluation.winScore >= WIN_THRESHOLD ? 'good' : evaluation.winScore >= 2.5 ? 'warn' : 'bad' },
      { label: `Called at the ${WIN_THRESHOLD} cut`, value: evaluation.predictedOutcome === 'WIN' ? 'Win' : 'Loss' },
      { label: 'Document that would help most', value: `${evaluation.missingDocument === 'NONE' ? 'Nothing to fetch' : sentence(evaluation.missingDocument)} · ${percentOf(answers.missing_document.confidence)}` },
      { label: 'Confidence in the next step', value: percentOf(answers.next_step.confidence), tone: answers.next_step.confidence < 0.6 ? 'warn' : undefined },
      { label: 'Deadline too close to gather', value: `${evaluation.deadlineRisk ? 'Yes' : 'No'} · ${percentOf(Math.max(risk, 1 - risk))}`, tone: evaluation.deadlineRisk ? (evaluation.nextStep === 'GATHER_MORE' ? 'bad' : 'warn') : undefined },
    ],
  };
}

const KIND_NOTES = {
  strong: 'Planted as a strong packet: every required document is present.',
  'one-document-away': 'Planted one document from winning.',
  hopeless: 'Planted as hopeless: the label accepts the loss.',
};

function gradeNote(result, label) {
  const parts = [KIND_NOTES[label.kind]];
  if (label.kind === 'one-document-away') parts.push(`The document is ${readable(label.missingDocument)}; the model named ${readable(result.evaluation.missingDocument)}.`);
  if (label.outcome === 'WIN' && result.evaluation.predictedOutcome === 'LOSS') parts.push(`It scored ${result.evaluation.winScore.toFixed(1)} of 6, under the ${WIN_THRESHOLD} cut.`);
  if (label.nextStep !== result.evaluation.nextStep) parts.push(`The intended step was ${readable(label.nextStep)}; the model chose ${readable(result.evaluation.nextStep)}.`);
  const note = parts.filter(Boolean).join(' ');
  return note || undefined;
}

const grade = {
  labelId: (label) => label.packetId,
  // Right means what the headline counts: win or loss, as the packet stands, at the fixed cut.
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.predictedOutcome === label.outcome,
      expected: label.outcome,
      got: result.evaluation.predictedOutcome,
      note: gradeNote(result, label),
      confidence: result.answers.win_likelihood.confidence,
    };
  },
};

const present = {
  number: 114,
  problem: {
    headline: 'A chargeback is answered once, before a deadline. The packet either has the document the reason code needs or it does not.',
    stat: '120',
    statLabel: 'evidence packets, $99,274 disputed',
  },
  hero: {
    item: 'CB-0003',
    caption: 'Product not received, $1,889.26, and the delivery proof is the one document not on file. Scored 1.6 of 6 as it stands; the model names delivery proof and says gather it.',
  },
  answers: {
    caption: 'Four typed answers: how likely the packet is to win today, the one document that would help most, the next step, and whether the deadline leaves time to fetch it.',
    reveal: ['win_likelihood', 'missing_document', 'next_step', 'deadline_risk'],
  },
  miss: {
    item: 'CB-0006',
    caption: 'A complete packet, $1,782.49, submitted with nothing missing, and scored 3.1 of 6. The fixed cut of 3.5 calls it a loss; 21 labelled wins fall under that cut.',
  },
  proof: {
    kpis: ['Outcome accuracy', 'One document from winning', 'Next-step accuracy'],
    chart: 'curve',
    closing: '$21,972 sits in 31 packets one document from winning, and the right document was named on all 31.',
  },
};

export default {
  id: 'chargeback-evidence',
  title: 'Chargeback evidence',
  domain: 'orders',
  value: 'Judge whether an evidence packet can win the case, and name the document that would change the answer.',
  tags: ['orders', 'payments', 'chargebacks', 'evidence'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.id} · ${readable(item.dispute.reasonCode)} · ${money(item.dispute.amount, item.dispute.currency)}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/chargeback-evidence.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  stage: {
    hide: ['sourceIp', 'acquirerReference', 'trackingNumber', 'version'],
    labels: {
      evidence: 'Evidence on file',
      transactionSignals: 'Transaction signals',
      reasonCode: 'Reason code',
      customerClaim: 'What the cardholder says',
      openedAt: 'Dispute opened',
      responseDeadline: 'Response deadline',
      placedAt: 'Order placed',
      present: 'On file',
      AVS_CVV: 'AVS and CVV check',
      DELIVERY_PROOF: 'Delivery proof',
      TERMS_ACCEPTANCE: 'Terms acceptance',
      COMMS_LOG: 'Communications log',
      REFUND_PROOF: 'Refund proof',
      gpsAddressMatch: 'GPS matches the address',
      deviceMatchesPriorOrders: 'Device matches earlier orders',
      ipCountryMatchesBilling: 'IP country matches billing',
      priorSuccessfulOrders: 'Earlier good orders',
      priorChargebacks: 'Earlier chargebacks',
    },
    highlight: ['reasonCode', 'present', 'responseDeadline'],
  },
  grade,
  verdict,
  present,
  caveat: 'Win or loss here is whether the decisive document for the reason code is marked present, and that requirement is in the state, so outcome accuracy measures reading a checklist. Documents marked absent also still carry their contents in this file. A harder dataset is planned.',
  explain: {
    data: 'scripts/generate/chargeback-evidence.js#demo:data',
    state: 'demos/chargeback-evidence/demo.js#demo:state',
    questions: 'demos/chargeback-evidence/demo.js#demo:questions',
    evaluate: 'demos/chargeback-evidence/demo.js#demo:evaluate',
  },
};
