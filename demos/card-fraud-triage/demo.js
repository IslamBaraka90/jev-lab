// Card fraud triage: the analyst has an hour, which is about fifty alerts, and the rules engine has
// already decided which fifty those are. This demo re-reads all four hundred and asks what a different
// ordering would put in front of that hour. The rule ordering is stored with the data, so the
// comparison is the same every time it is run.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const TYPES = ['CARD_TESTING', 'STOLEN_CARD', 'ACCOUNT_TAKEOVER', 'FRIENDLY_FRAUD', 'MERCHANT_COLLUSION', 'NONE'];
const ACTIONS = ['BLOCK', 'STEP_UP', 'WATCH', 'CLOSE_ALERT'];
const HOUR = 50;

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const money = (value, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value ?? 0);

const share = (part, whole) => {
  if (!whole) return '–';
  const percent = (part / whole) * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

// #region demo:state
/** The alert, the rule that fired it and what that rule is worth, then the card's own recent life. */
function buildState(item, context) {
  return {
    task: 'Read this alert and say how likely it is to be fraud, what kind, and what to do with it.',
    issuer: { name: context.issuer, currency: context.currency, period: context.period },
    alert: {
      fired_at: item.firedAt,
      rule: item.rule,
      this_rule_is_right_about: `${item.rulePrecisionPercent}% of the alerts it raises`,
    },
    transaction: {
      amount: item.amount,
      merchant: item.merchant,
      merchant_category: item.merchantCategory,
      merchant_country: item.merchantCountry,
      card: item.card,
      device_never_seen_on_this_card: item.newDevice,
      earlier_authorisations_at_this_merchant: item.authorisationsAtThisMerchantBefore,
      declines_on_this_card_in_the_last_day: item.declinesInLastDay,
    },
    cardholder: {
      with_the_bank_for_years: item.customerTenureYears,
      countries_they_normally_use_the_card_in: item.usualCountries,
      average_monthly_spend: item.averageMonthlySpend,
      typical_transaction: item.typicalTransaction,
    },
    last_ten_authorisations: item.recentTransactions,
  };
}
// #endregion

// #region demo:questions
const questions = {
  fraud_likelihood: score('How likely is it that this authorisation was not made by the cardholder?', [
    'None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain',
  ]),
  fraud_type: choice('If this is fraud, what kind is it?', {
    CARD_TESTING: 'Tiny amounts checking whether the number is live, usually after declines.',
    STOLEN_CARD: 'Someone else has the card and is spending it on resaleable goods.',
    ACCOUNT_TAKEOVER: 'The account, not just the card, is in someone else’s hands.',
    FRIENDLY_FRAUD: 'The cardholder made the purchase and will say they did not.',
    MERCHANT_COLLUSION: 'The merchant is part of it, not a victim of it.',
    NONE: 'Not fraud. The cardholder made this.',
  }),
  action: choice('What should happen to this alert?', {
    BLOCK: 'Stop the card now.',
    STEP_UP: 'Let it stand but make the next authorisation prove itself.',
    WATCH: 'Leave the card alone and look again if anything else fires.',
    CLOSE_ALERT: 'Close it. There is nothing here.',
  }),
  explains_itself: noul('Does the cardholder’s own recent history explain this transaction?', {
    yes: 'The last ten authorisations make this one unremarkable.',
    no: 'Nothing in the recent history leads to this transaction.',
  }),
  contact_customer: noul('Is this worth a message to the cardholder?', {
    yes: 'A quick confirmation would settle it and the amount justifies the interruption.',
    no: 'Either it is plainly fine, or it needs stopping rather than asking.',
  }),
};
// #endregion

// #region demo:evaluate
/** One read of one alert: how bad, what kind, and what to do about it. */
function evaluate(answers, item) {
  const action = answers.action.choice;

  return {
    likelihood: answers.fraud_likelihood.score,
    type: answers.fraud_type.choice,
    action,
    explained: answers.explains_itself.noul >= 0.5,
    contact: answers.contact_customer.noul >= 0.5,
    acted: action === 'BLOCK' || action === 'STEP_UP',
    closed: action === 'CLOSE_ALERT',
    confidence: answers.fraud_type.confidence,
    ruleRank: item.ruleRank,
    label: `${item.id} · ${readable(action)} · ${money(item.amount)} at ${item.merchant}`,
  };
}
// #endregion

// #region demo:report
/** The only comparison that matters: what the analyst's hour contains, before and after re-ordering. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.alertId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const fraud = labels.filter((label) => label.fraud);
  const ranked = [...graded].sort((left, right) => right.evaluation.likelihood - left.evaluation.likelihood
    || right.evaluation.confidence - left.evaluation.confidence
    || left.item.ruleRank - right.item.ruleRank);

  return {
    note: `Four hundred alerts, ${fraud.length} of them fraud, ${labels.filter((label) => label.kind === 'loud false alarm').length} of them loud alerts the cardholder's own history explains. ${context.analystHour ?? ''}`,
    findings: findings(ranked, graded, byItem, fraud),
    kpis: kpis(ranked, graded, byItem, fraud),
    baselines: baselines(ranked, graded, byItem, fraud),
    metrics: metrics(ranked, graded, byItem, fraud),
    distribution: distribution(results),
    distributionTitle: 'What happens to each alert',
    matrix: confusion(graded, byItem),
    curve: coverage(ranked, byItem, fraud),
    checks: checks(graded, byItem, labels),
    topItems: topItems(ranked, byItem),
    topItemsTitle: 'The top of the model’s ordering',
  };
}
// #endregion

/** Frauds sitting in the first `count` alerts of an ordering. */
function fraudIn(list, byItem, count) {
  return list.slice(0, count).filter((result) => byItem.get(result.item.id).fraud).length;
}

function byRule(graded) {
  return [...graded].sort((left, right) => left.item.ruleRank - right.item.ruleRank);
}

// The scorecard rule: one point each for a device the card has never used, a merchant it has never
// used and any decline in the last day.
function scorecardPoints(item) {
  return (item.newDevice ? 1 : 0) + (item.authorisationsAtThisMerchantBefore === 0 ? 1 : 0) + (item.declinesInLastDay > 0 ? 1 : 0);
}

/** The queue ordered by the scorecard, with the rule queue settling ties. */
function byScorecard(graded) {
  return [...graded].sort((left, right) => scorecardPoints(right.item) - scorecardPoints(left.item) || left.item.ruleRank - right.item.ruleRank);
}

/** The loud false alarms that were blocked or stepped up, counted by what they really were. */
function actedDecoysByLook(graded, byItem) {
  const counts = new Map();
  for (const result of graded) {
    const label = byItem.get(result.item.id);
    if (label.kind !== 'loud false alarm' || !result.evaluation.acted) continue;
    const look = label.look ?? 'unnamed';
    counts.set(look, (counts.get(look) ?? 0) + 1);
  }
  return [...counts].map(([look, count]) => `${count} × ${look}`).join(', ');
}

function kpis(ranked, graded, byItem, fraud) {
  const ruleOrder = byRule(graded);
  const inRuleHour = fraudIn(ruleOrder, byItem, HOUR);
  const inModelHour = fraudIn(ranked, byItem, HOUR);
  let opened = 0;
  while (opened < ranked.length && fraudIn(ranked, byItem, opened) < inRuleHour) opened += 1;
  const decoys = graded.filter((result) => byItem.get(result.item.id).kind === 'loud false alarm');
  const closedDecoys = decoys.filter((result) => result.evaluation.closed || !result.evaluation.acted);
  const blocked = graded.filter((result) => result.evaluation.action === 'BLOCK');
  const blockedGood = blocked.filter((result) => !byItem.get(result.item.id).fraud);
  const stillActedOn = actedDecoysByLook(graded, byItem);

  return [
    { label: `Fraud in the first ${HOUR}, model order`, value: `${inModelHour} of ${fraud.length}`, context: `the same hour, re-ordered`, tone: inModelHour > inRuleHour ? 'good' : 'warn' },
    { label: `Fraud in the first ${HOUR}, rule order`, value: `${inRuleHour} of ${fraud.length}`, context: 'the queue as the engine leaves it' },
    { label: 'Alerts to the same catch', value: opened, context: `to find the ${inRuleHour} the rule queue puts in its first ${HOUR}`, tone: opened < HOUR ? 'good' : 'warn' },
    { label: 'Loud false alarms let go', value: `${closedDecoys.length} of ${decoys.length}`, context: stillActedOn ? `still acted on: ${stillActedOn}` : 'holidays, weddings, planned purchases, renewal days', tone: closedDecoys.length === decoys.length ? 'good' : 'warn' },
    { label: 'Cards blocked without fraud', value: blockedGood.length, context: `of ${blocked.length} cards blocked; ${share(blockedGood.length, graded.length)} of the queue`, tone: blockedGood.length ? 'warn' : 'good' },
  ];
}

/** The same hour under each ordering: how many of the frauds the first fifty alerts contain. */
function baselines(ranked, graded, byItem, fraud) {
  if (!fraud.length || !graded.length) return undefined;
  const row = (label, detail, found) => ({ label, detail, value: found / fraud.length, display: `${Number.isInteger(found) ? found : found.toFixed(1)} of ${fraud.length}` });
  return [
    { ...row('Jev', `first ${HOUR} alerts by fraud likelihood`, fraudIn(ranked, byItem, HOUR)), model: true },
    row('Rule: three-flag scorecard', 'new device, new merchant, any decline; ties in rule order', fraudIn(byScorecard(graded), byItem, HOUR)),
    row('The rules engine’s own queue', `first ${HOUR} by rule score`, fraudIn(byRule(graded), byItem, HOUR)),
    row('Any fifty at random', 'what the hour holds with no ordering at all', (Math.min(HOUR, graded.length) / graded.length) * fraud.length),
  ];
}

/** Flat numbers for the scoreboard. Accuracy, precision and recall are of the block-or-step-up decision. */
function metrics(ranked, graded, byItem, fraud) {
  const acted = graded.filter((result) => result.evaluation.acted);
  const actedFraud = acted.filter((result) => byItem.get(result.item.id).fraud);
  const right = graded.filter((result) => result.evaluation.acted === byItem.get(result.item.id).fraud);
  return {
    headline: { label: `Fraud in the first ${HOUR}, model order`, value: fraud.length ? fraudIn(ranked, byItem, HOUR) / fraud.length : 0, n: fraud.length },
    accuracy: graded.length ? right.length / graded.length : null,
    precision: acted.length ? actedFraud.length / acted.length : null,
    recall: fraud.length ? actedFraud.length / fraud.length : null,
    macroF1: matrixStats(confusion(graded, byItem))?.macroF1 ?? null,
  };
}

function checks(graded, byItem, labels) {
  const rows = TYPES.filter((type) => type !== 'NONE').map((type) => {
    const group = labels.filter((label) => label.type === type);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.alertId);
      return !result || !result.evaluation.acted;
    });
    return { id: type.toLowerCase(), label: `${sentence(type)} left alone`, detail: questions.fraud_type.criteria[type], count: missed.length, of: group.length, items: missed.map((label) => label.alertId) };
  });

  const quiet = labels.filter((label) => label.fraud && label.quiet);
  const quietMissed = quiet.filter((label) => {
    const result = graded.find((entry) => entry.item.id === label.alertId);
    return !result || !result.evaluation.acted;
  });
  const decoys = labels.filter((label) => label.kind === 'loud false alarm');
  const actedDecoys = decoys.filter((label) => graded.some((result) => result.item.id === label.alertId && result.evaluation.acted));
  return [
    ...rows,
    { id: 'quiet', label: 'Fraud the rules barely flagged, left alone', detail: `${quiet.length} of the ${labels.filter((label) => label.fraud).length} frauds fired a quiet rule, so the engine buried them at the bottom of the queue.`, count: quietMissed.length, of: quiet.length, items: quietMissed.map((label) => label.alertId) },
    { id: 'decoys', label: 'Loud false alarms acted on', detail: 'A holiday, a wedding, a planned electronics purchase, a day of renewals — all explained by the card’s own history.', count: actedDecoys.length, of: decoys.length, items: actedDecoys.map((label) => label.alertId) },
  ];
}

function distribution(results) {
  return ACTIONS
    .map((action) => ({ label: sentence(action), count: results.filter((result) => result.evaluation.action === action).length, tone: action === 'CLOSE_ALERT' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Fraud type called against what was planted',
    rowLabel: 'the type that was planted',
    columnLabel: 'the type the model named',
    columns: TYPES.map(sentence),
    rows: TYPES.map((actual) => ({
      label: sentence(actual),
      cells: TYPES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).type === actual && result.evaluation.type === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(ranked, byItem, fraud) {
  const stops = [10, 25, 50, 100, 200, 300, 400];
  const points = stops.map((count) => {
    const opened = Math.min(count, ranked.length);
    const caught = fraudIn(ranked, byItem, opened);
    return { threshold: Number((opened / ranked.length).toFixed(3)), reviewed: opened, caught, rate: opened ? Number((caught / opened).toFixed(3)) : null };
  });
  return { title: 'Working down the model’s ordering', xLabel: 'Alerts opened, most likely first', yLabel: 'Fraud found by then', rateLabel: 'Share of what has been opened that was fraud', of: fraud.length, points, thresholdFormat: 'level', levels: ranked.length, defaultIndex: stops.indexOf(HOUR) };
}

function findings(ranked, graded, byItem, fraud) {
  const lines = [];
  const ruleOrder = byRule(graded);
  const jumped = ranked.slice(0, HOUR).filter((result) => byItem.get(result.item.id).fraud && result.item.ruleRank > HOUR);
  if (jumped.length) {
    const ranks = jumped.map((result) => `${result.item.id} from ${result.item.ruleRank}`).slice(0, 4);
    lines.push(`${jumped.length} fraudulent ${jumped.length === 1 ? 'alert' : 'alerts'} moved into the first ${HOUR} from further down the rule queue: ${ranks.join(', ')}. Nobody was going to reach ${jumped.length === 1 ? 'it' : 'them'} today.`);
  }

  const missed = graded.filter((result) => byItem.get(result.item.id).fraud && result.evaluation.closed);
  if (missed.length) lines.push(`${missed.length} fraudulent ${missed.length === 1 ? 'alert was' : 'alerts were'} closed outright: ${missed.map((result) => result.item.id).join(', ')}.`);

  const wrongType = graded.filter((result) => byItem.get(result.item.id).fraud && result.evaluation.type !== byItem.get(result.item.id).type && result.evaluation.type !== 'NONE');
  if (wrongType.length >= 3) lines.push(`${wrongType.length} of the ${fraud.length} frauds were acted on under the wrong name. The action was right; the label on the case was not.`);

  const inRuleHour = fraudIn(ruleOrder, byItem, HOUR);
  const inModelHour = fraudIn(ranked, byItem, HOUR);
  if (inModelHour !== inRuleHour) lines.push(`The analyst's hour goes from ${inRuleHour} to ${inModelHour} of the ${fraud.length} frauds, without anyone looking at a single extra alert.`);

  const inScorecardHour = fraudIn(byScorecard(graded), byItem, HOUR);
  if (inScorecardHour > inRuleHour) {
    const against = inScorecardHour > inModelHour ? 'more than the model' : inScorecardHour === inModelHour ? 'the same as the model' : `against the model's ${inModelHour}`;
    lines.push(`A three-flag scorecard over fields already in the alert puts ${inScorecardHour} of the ${fraud.length} in the first ${HOUR}, ${against}. The rule queue is the weak comparison; the scorecard is the fair one.`);
  }

  const acted = graded.filter((result) => result.evaluation.acted);
  const actedFraud = acted.filter((result) => byItem.get(result.item.id).fraud);
  const steppedUp = graded.filter((result) => result.evaluation.action === 'STEP_UP');
  if (acted.length) lines.push(`${acted.length} alerts were blocked or stepped up and ${actedFraud.length} of them were fraud (${share(actedFraud.length, acted.length)}). ${steppedUp.length} step-ups is the cost the cardholders carry.`);

  const typedClean = graded.filter((result) => !byItem.get(result.item.id).fraud && result.evaluation.type !== 'NONE');
  if (typedClean.length >= 10) lines.push(`${typedClean.length} alerts that were not fraud were still given a fraud type, because the question asks "if this is fraud". Read the "None" row of the matrix with that in mind.`);
  return lines;
}

function topItems(ranked, byItem) {
  return ranked.slice(0, 10).map((result) => ({
    id: result.item.id,
    label: `${result.evaluation.label} · was #${result.item.ruleRank} in the rule queue${byItem.get(result.item.id)?.fraud ? ' · fraud' : ''}`,
    value: `${result.evaluation.likelihood.toFixed(1)} of 6`,
  }));
}

const levelName = (value) => questions.fraud_likelihood.criteria[Math.max(0, Math.min(6, Math.round(value)))];
const yesNo = (probability) => `${probability >= 0.5 ? 'Yes' : 'No'} · ${Math.round(Math.max(probability, 1 - probability) * 100)}%`;

/** What a planted alert was, in a sentence. Ordinary noise carries no note. */
function plantedNote(label) {
  if (label.fraud) return `Planted as ${readable(label.type)}${label.quiet ? ', on a quiet rule the engine ranks near the bottom of the queue' : ''}.`;
  if (label.kind === 'loud false alarm') return `Planted as a loud false alarm: ${label.look}, which the card’s own history explains.`;
  return undefined;
}

// A position in the ordering cannot be judged one alert at a time, so the grade is on the action:
// a fraud should be blocked or stepped up, and anything else should be left alone.
const grade = {
  labelId: (label) => label.alertId,
  judge: (result, label) => {
    if (!label) return null;
    return {
      agree: result.evaluation.acted === label.fraud,
      expected: label.fraud ? 'block or step up' : 'leave the card alone',
      got: result.evaluation.action,
      note: plantedNote(label),
      confidence: result.answers.action.confidence,
    };
  },
};

function verdict(result) {
  const { item, answers, evaluation } = result;
  const named = evaluation.type !== 'NONE' && evaluation.acted;
  const timesTypical = item.typicalTransaction ? item.amount / item.typicalTransaction : null;
  return {
    eyebrow: 'What happens to this alert',
    headline: `${sentence(evaluation.action)}${named ? ` · ${readable(evaluation.type)}` : ''}`,
    detail: `${money(item.amount)} at ${item.merchant}; this card’s typical transaction is ${money(item.typicalTransaction)}.`,
    facts: [
      { label: 'Fraud likelihood', value: `${levelName(evaluation.likelihood)} · ${evaluation.likelihood.toFixed(1)} of 6`, tone: evaluation.likelihood >= 3.5 ? 'bad' : evaluation.likelihood >= 2.5 ? 'warn' : 'good' },
      { label: 'The card’s history explains it', value: yesNo(answers.explains_itself.noul), tone: evaluation.explained ? 'good' : 'warn' },
      { label: 'Against a typical transaction', value: timesTypical === null ? '–' : `${timesTypical.toFixed(1)}×` },
      { label: 'Place in the rule queue', value: `#${item.ruleRank}${item.ruleRank > HOUR ? ', outside the hour' : ', inside the hour'}` },
      { label: 'Worth a message to the cardholder', value: yesNo(answers.contact_customer.noul) },
      { label: 'Confidence in the action', value: `${Math.round(answers.action.confidence * 100)}%` },
    ],
  };
}

const stage = {
  hide: ['ruleId', 'ruleScore'],
  labels: {
    firedAt: 'Alert fired',
    rule: 'Rule that fired',
    rulePrecisionPercent: 'That rule is right about (%)',
    newDevice: 'Device never seen on this card',
    declinesInLastDay: 'Declines in the last day',
    customerTenureYears: 'Years with the bank',
    authorisationsAtThisMerchantBefore: 'Earlier authorisations at this merchant',
    typicalTransaction: 'Typical transaction',
    ruleRank: 'Place in the rule queue',
    usualCountries: 'Countries the card is normally used in',
    recentTransactions: 'Last ten authorisations',
  },
  highlight: ['amount', 'typicalTransaction', 'declinesInLastDay', 'authorisationsAtThisMerchantBefore'],
};

const present = {
  number: 121,
  problem: {
    headline: 'One analyst has an hour before the cut-off, which is about fifty alerts. The rules engine has already chosen which fifty.',
    stat: '400',
    statLabel: 'alerts in the queue, 16 of them fraud',
  },
  hero: {
    item: 'ALT-0366',
    caption: '£220.95 of gift cards in Poland at 01:15, on a card that spends about £22 at a time in the UK. The rules engine ranked it 366 of 400; the model puts it first.',
  },
  answers: {
    caption: 'The likelihood score orders the queue. The action and the type are what the analyst sees when the alert is opened.',
    reveal: ['fraud_likelihood', 'explains_itself', 'action', 'fraud_type'],
  },
  miss: {
    item: 'ALT-0023',
    caption: 'Friendly fraud: £100.35 at a gaming merchant this card had used four times before. The model scored it 1.2 of 6 and closed it, and nothing at authorisation time says otherwise.',
  },
  proof: {
    kpis: ['Fraud in the first 50, model order', 'Fraud in the first 50, rule order', 'Alerts to the same catch'],
    chart: 'baselines',
    closing: 'Same 400 alerts, same analyst hour: 6 of 16 frauds in the first fifty becomes 13.',
  },
};

export default {
  id: 'card-fraud-triage',
  title: 'Card fraud triage',
  domain: 'fraud',
  value: 'Re-rank an alert queue so the hour an analyst has goes to the alerts that are actually fraud.',
  tags: ['fraud', 'alerts', 'triage', 'cards'],
  dataClass: 'synthetic',
  readMinutes: 5,
  caveat: 'Sixteen frauds is a small sample, and the generator buried nine of them low in the rule queue on purpose. Read the rule-queue comparison beside the scorecard baseline, which is the fairer one.',
  view: 'queue',
  itemLabel: (item) => `${item.id} · ${money(item.amount)} · ${item.merchantCategory.toLowerCase()} · rule #${item.ruleRank}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/card-fraud-triage.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  stage,
  grade,
  verdict,
  present,
  explain: {
    data: 'scripts/generate/card-fraud-triage.js#demo:data',
    state: 'demos/card-fraud-triage/demo.js#demo:state',
    questions: 'demos/card-fraud-triage/demo.js#demo:questions',
    evaluate: 'demos/card-fraud-triage/demo.js#demo:evaluate',
  },
};
