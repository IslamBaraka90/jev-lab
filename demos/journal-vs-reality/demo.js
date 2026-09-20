// Journal versus reality: two hundred notes beside the trades they describe. The note is what the
// trader believes happened; the record is what happened. Where the two come apart is the demo, and
// the five ways they come apart are the five things a journal is for catching.

import { matrixStats } from '../lib/metrics.js';
import { choice, noul, score } from '../lib/questions.js';

const DRIFTS = ['SIZE', 'ENTRY', 'EXIT', 'INSTRUMENT', 'RATIONALISATION', 'NONE'];

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());

const share = (part, whole) => {
  if (!whole) return '–';
  const value = (part / whole) * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
};

// #region demo:state
/** The note as written, the record as filled, and the rules the trader set for themselves. */
function buildState(item, context) {
  return {
    task: 'Read this journal note against the trade record and say whether it describes what happened.',
    trader: { rules: context.rules, full_position_usd: context.fullPositionUsd, note: context.note },
    journal_note: item.note,
    note_written: item.noteWrittenAt,
    trade_record: {
      symbol: item.symbol,
      date: item.tradeDate,
      setup: item.setup,
      entry_price: item.entryPrice,
      filled_at: item.filledAt,
      planned_stop: item.plannedStop,
      planned_target: item.plannedTarget,
      size_usd: item.sizeUsd,
      size_against_a_full_position: item.sizeLabel,
      exit_price: item.exitPrice,
      exit_reason: item.exitReason,
      result_percent: item.resultPercent,
    },
  };
}
// #endregion

// #region demo:questions
const questions = {
  note_matches_trade: noul('Does the note describe the trade that is on the record?', {
    yes: 'Everything the note claims is in the record, and nothing in the record contradicts it.',
    no: 'At least one thing the note says did not happen that way.',
  }),
  drift_type: choice('Where does the story come apart?', {
    SIZE: 'The note describes a smaller or larger position than was filled.',
    ENTRY: 'The note describes waiting for a level the record says was not waited for.',
    EXIT: 'The note describes an exit that did not happen at the price or for the reason given.',
    INSTRUMENT: 'The note is about a different instrument to the one traded.',
    RATIONALISATION: 'The note describes a plan that could not have existed before the trade.',
    NONE: 'It does not. The note and the record agree.',
  }),
  note_honesty: score('How accurate is the note as a record of what happened?', [
    'Fabricated', 'Very loose', 'Loose', 'Partly accurate', 'Accurate', 'Very accurate', 'Precise',
  ]),
  written_after_the_fact: noul('Does the note read as if it was written after the outcome was known?', {
    yes: 'It knows more than somebody writing on the evening of the trade could know.',
    no: 'It reads as something written before the next day happened.',
  }),
  rule_followed: noul('Did the trade follow the trader’s own stated rules?', {
    yes: 'The size, the entry and the levels all match the rules they wrote for themselves.',
    no: 'At least one of their own rules was broken by this trade.',
  }),
};
// #endregion

// #region demo:evaluate
/** One entry's verdict: does the story match, where does it drift, and how honest is the telling. */
function evaluate(answers, item) {
  const matches = answers.note_matches_trade.noul >= 0.5;

  return {
    matches,
    drift: answers.drift_type.choice,
    honesty: answers.note_honesty.score,
    afterTheFact: answers.written_after_the_fact.noul >= 0.5,
    ruleFollowed: answers.rule_followed.noul >= 0.5,
    confidence: answers.drift_type.confidence,
    result: item.resultPercent,
    label: `${item.id} · ${item.symbol} · ${matches ? 'note matches' : `drifts on ${readable(answers.drift_type.choice)}`}`,
  };
}
// #endregion

// #region demo:report
/** Which drifts repeat, and whether they cluster on the trades that lost money. */
function report(results, context = {}) {
  const labels = context.labels ?? [];
  const byItem = new Map(labels.map((label) => [label.entryId, label]));
  const graded = results.filter((result) => byItem.has(result.item.id));
  const drifting = graded.filter((result) => byItem.get(result.item.id).drift !== 'NONE');
  const honest = graded.filter((result) => byItem.get(result.item.id).drift === 'NONE');
  const caught = drifting.filter((result) => !result.evaluation.matches);

  const matrix = confusion(graded, byItem);
  const scores = scoreboard(graded, byItem, matrix);

  return {
    note: `Two hundred journal entries. ${drifting.length} of the notes drift from the record and ${honest.length} are honest. ${context.note ?? ''}`,
    findings: findings(graded, byItem, honest, scores),
    kpis: kpis({ graded, drifting, honest, caught, byItem, scores }),
    baselines: scores.baselines,
    metrics: scores.metrics,
    distributionTitle: 'Where the notes were said to drift',
    topItemsTitle: 'Least accurate notes by honesty score',
    distribution: distribution(results),
    matrix,
    curve: coverage(graded, byItem, drifting),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

// The rule: written later is a rationalisation; another ticker in the note is the wrong instrument; a fill
// "without waiting" is entry; a hand close is exit; "starter" on a larger fill is size; else no drift.
function driftByRule(item, tickers) {
  const words = item.note.split(/[^A-Za-z]+/);
  if (item.noteWrittenAt !== 'the same evening') return 'RATIONALISATION';
  if (tickers.some((ticker) => ticker !== item.symbol && words.includes(ticker))) return 'INSTRUMENT';
  if (item.filledAt.includes('without waiting')) return 'ENTRY';
  if (item.exitReason.startsWith('closed by hand')) return 'EXIT';
  if (words.includes('starter') && item.sizeLabel !== 'starter') return 'SIZE';
  return 'NONE';
}

/** The counts the KPIs, findings, baselines and metrics share. Right means: drifts, or does not. */
function scoreboard(graded, byItem, matrix) {
  const drifts = (result) => byItem.get(result.item.id).drift !== 'NONE';
  const tickers = [...new Set(graded.map((result) => result.item.symbol))];
  const doubted = graded.filter((result) => !result.evaluation.matches);
  const caught = doubted.filter(drifts);
  const drifting = graded.filter(drifts);
  const right = graded.filter((result) => result.evaluation.matches !== drifts(result));
  const ruleRight = graded.filter((result) => (driftByRule(result.item, tickers) !== 'NONE') === drifts(result));
  const typeRight = graded.filter((result) => result.evaluation.drift === byItem.get(result.item.id).drift);
  const saidLater = graded.filter((result) => result.evaluation.afterTheFact);
  const share = (count) => (graded.length ? count / graded.length : 0);
  const precision = doubted.length ? caught.length / doubted.length : null;
  const recall = drifting.length ? caught.length / drifting.length : null;
  return {
    right: right.length,
    ruleRight: ruleRight.length,
    typeRight: typeRight.length,
    doubted: doubted.length,
    precision,
    saidLater: saidLater.length,
    saidLaterRight: saidLater.filter((result) => byItem.get(result.item.id).drift === 'RATIONALISATION').length,
    // A note read as matching while a drift is named for it: the two answers disagree.
    contradictions: graded.filter((result) => result.evaluation.matches && result.evaluation.drift !== 'NONE').length,
    baselines: graded.length ? [
      { label: 'Jev', detail: 'says whether the note drifts from the record', value: share(right.length), model: true },
      { label: 'Rule: five keyword checks', detail: 'when it was written, another ticker, "without waiting", "closed by hand", "starter" on a larger fill', value: share(ruleRight.length) },
      { label: 'Always the commonest answer', detail: 'the note matches', value: share(graded.length - drifting.length) },
    ] : undefined,
    metrics: graded.length ? {
      headline: { label: 'Notes read right', value: share(right.length), n: graded.length },
      accuracy: share(right.length),
      macroF1: matrixStats(matrix)?.macroF1 ?? null,
      precision,
      recall,
      contradictionRate: share(graded.filter((result) => result.evaluation.matches && result.evaluation.drift !== 'NONE').length),
    } : undefined,
  };
}

function kpis({ graded, drifting, honest, caught, byItem, scores }) {
  const named = drifting.filter((result) => result.evaluation.drift === byItem.get(result.item.id).drift);
  const doubted = honest.filter((result) => !result.evaluation.matches);
  const rationalisations = graded.filter((result) => byItem.get(result.item.id).drift === 'RATIONALISATION');
  const spotted = rationalisations.filter((result) => result.evaluation.afterTheFact);
  const laterPrecise = scores.saidLater === scores.saidLaterRight;

  return [
    { label: 'Notes read right', value: `${scores.right} of ${graded.length}`, context: `${share(scores.right, graded.length)} · whether the note drifts from the record or not`, tone: scores.right === graded.length ? 'good' : undefined },
    { label: 'Drifting notes caught', value: `${caught.length} of ${drifting.length}`, context: `${scores.doubted} notes were doubted and ${caught.length} of them really drift: ${share(caught.length, scores.doubted)} precision`, tone: caught.length === drifting.length ? 'good' : 'warn' },
    { label: 'Drift named exactly', value: `${named.length} of ${drifting.length}`, context: `size, entry, exit, instrument or a plan invented afterwards; over all ${graded.length} notes the type is right on ${scores.typeRight}` },
    { label: 'Honest notes doubted', value: `${doubted.length} of ${honest.length}`, context: 'notes that agree with the record and were called out anyway', tone: doubted.length > honest.length / 10 ? 'warn' : 'good' },
    { label: 'Written after the outcome', value: `${spotted.length} of ${rationalisations.length}`, context: `but it said so of ${scores.saidLater} notes in all: ${share(scores.saidLaterRight, scores.saidLater)} precision`, tone: laterPrecise ? 'good' : 'warn' },
  ];
}

function checks(graded, byItem, labels) {
  return DRIFTS.filter((drift) => drift !== 'NONE').map((drift) => {
    const group = labels.filter((label) => label.drift === drift);
    const missed = group.filter((label) => {
      const result = graded.find((entry) => entry.item.id === label.entryId);
      return !result || result.evaluation.drift !== drift;
    });
    return { id: drift.toLowerCase(), label: `${sentence(drift)} drift not named`, detail: questions.drift_type.criteria[drift], count: missed.length, of: group.length, items: missed.slice(0, 20).map((label) => label.entryId) };
  }).concat([{
    id: 'honest',
    label: 'Honest notes called into question',
    detail: 'A hundred and twenty-six notes that say what the record says.',
    count: graded.filter((result) => byItem.get(result.item.id).drift === 'NONE' && !result.evaluation.matches).length,
    of: labels.filter((label) => label.drift === 'NONE').length,
    items: graded.filter((result) => byItem.get(result.item.id).drift === 'NONE' && !result.evaluation.matches).slice(0, 20).map((result) => result.item.id),
  }]);
}

function distribution(results) {
  return DRIFTS
    .map((drift) => ({ label: sentence(drift), count: results.filter((result) => result.evaluation.drift === drift).length, tone: drift === 'NONE' ? 'good' : 'warn' }))
    .filter((entry) => entry.count);
}

function confusion(graded, byItem) {
  return {
    title: 'Drift named against the drift that is in the note',
    rowLabel: 'the drift the note was written with',
    columnLabel: 'the drift the model named',
    columns: DRIFTS.map(sentence),
    rows: DRIFTS.map((actual) => ({
      label: sentence(actual),
      cells: DRIFTS.map((predicted) => ({
        predicted,
        count: graded.filter((result) => byItem.get(result.item.id).drift === actual && result.evaluation.drift === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

function coverage(graded, byItem, drifting) {
  const points = Array.from({ length: 7 }, (_, bar) => {
    const doubted = graded.filter((result) => result.evaluation.honesty <= bar);
    const real = doubted.filter((result) => byItem.get(result.item.id).drift !== 'NONE');
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: doubted.length, caught: real.length, rate: doubted.length ? Number((real.length / doubted.length).toFixed(3)) : null };
  });
  return { title: 'Reading the least accurate notes first', thresholdFormat: 'level', levels: 6, defaultIndex: 3, xLabel: 'Notes at this honesty score or below', yLabel: 'Notes that really drift', rateLabel: 'Share of them that do', of: drifting.length, points };
}

function findings(graded, byItem, honest, scores) {
  const lines = [];
  if (scores.ruleRight > scores.right) {
    lines.push(`Five keyword checks on the note and the record sort ${scores.ruleRight} of ${graded.length} notes correctly; the model sorted ${scores.right}. The record states most contradictions in words, so on this dataset the rule wins.`);
  }

  if (scores.saidLater > scores.saidLaterRight * 2) {
    lines.push(`“Written after the outcome” was answered yes for ${scores.saidLater} of ${graded.length} notes, and ${scores.saidLaterRight} of those were. It catches every late note only because it says yes to most notes.`);
  }

  const typedHonest = honest.filter((result) => result.evaluation.drift !== 'NONE');
  if (typedHonest.length >= 4) lines.push(`${typedHonest.length} of ${honest.length} honest notes were given a drift type, more than the ${honest.filter((result) => !result.evaluation.matches).length} that were doubted outright.`);

  if (scores.contradictions >= 4) lines.push(`On ${scores.contradictions} notes the answers contradict each other: the note is said to match the trade, and a drift is named for it anyway.`);

  const late = graded.filter((result) => byItem.get(result.item.id).drift === 'RATIONALISATION');
  if (late.length && !late.some((result) => result.evaluation.drift === 'RATIONALISATION')) {
    const onHonest = honest.filter((result) => result.evaluation.drift === 'RATIONALISATION').length;
    lines.push(`None of the ${late.length} notes written days later was named a rationalisation, while ${onHonest} honest notes were.`);
  }
  const missed = graded.filter((result) => byItem.get(result.item.id).drift !== 'NONE' && result.evaluation.matches);
  if (missed.length) {
    const kinds = [...new Set(missed.map((result) => readable(byItem.get(result.item.id).drift)))];
    lines.push(`${missed.length} notes that do not describe their trade were read as accurate: ${kinds.join(', ')}.`);
  }

  const doubted = honest.filter((result) => !result.evaluation.matches);
  if (doubted.length >= 4) lines.push(`${doubted.length} honest notes were called into question. A journal that is always doubted stops being written.`);

  const losers = graded.filter((result) => result.item.resultPercent < 0);
  const winners = graded.filter((result) => result.item.resultPercent >= 0);
  const honestyGap = average(winners.map((result) => result.evaluation.honesty)) - average(losers.map((result) => result.evaluation.honesty));
  if (Math.abs(honestyGap) > 0.8) lines.push(`Notes on winning trades were scored ${honestyGap.toFixed(1)} points more honest than notes on losing ones. Whether that is the trader or the reader is the question worth asking.`);
  return lines;
}

function topItems(results, byItem) {
  return [...results]
    .sort((left, right) => left.evaluation.honesty - right.evaluation.honesty)
    .slice(0, 10)
    .map((result) => ({
      id: result.item.id,
      label: `${result.evaluation.label}${byItem.get(result.item.id)?.drift === result.evaluation.drift ? ' · agrees' : ''}`,
      value: `${result.evaluation.honesty.toFixed(1)} of 6`,
    }));
}

// #region demo:grade
/** Right means the yes-or-no on the note agrees with whether the note was written with a drift. */
const grade = {
  labelId: (label) => label.entryId,
  judge: (result, label) => {
    if (!label) return null;
    const drifts = label.drift !== 'NONE';
    const certainty = result.answers.note_matches_trade.noul;
    return {
      agree: result.evaluation.matches !== drifts,
      expected: drifts ? 'NOTE_DRIFTS' : 'NOTE_MATCHES',
      got: result.evaluation.matches ? 'NOTE_MATCHES' : 'NOTE_DRIFTS',
      note: drifts ? `Written with a drift on ${readable(label.drift)}; the model named ${readable(result.evaluation.drift)}.` : 'Written as an honest note: it says what the record says.',
      confidence: Math.max(certainty, 1 - certainty),
    };
  },
};
// #endregion

const yesOrNo = (answer) => (answer.noul >= 0.5 ? `Yes · ${Math.round(answer.noul * 100)}%` : `No · ${Math.round((1 - answer.noul) * 100)}%`);
const levelOf = (answer) => `${answer.legend?.[Math.round(answer.score)] ?? 'Score'} · ${answer.score.toFixed(1)} of 6`;

function honestyTone(value) {
  if (value >= 4) return 'good';
  return value >= 2.5 ? 'warn' : 'bad';
}

/** The entry as a card. A note that matches and a rule that was followed are the good news. */
function verdict(result) {
  const { answers, evaluation, item } = result;
  const size = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.sizeUsd);
  return {
    eyebrow: 'The note against the record',
    headline: evaluation.matches ? 'The note matches the trade' : `The note drifts on ${readable(evaluation.drift)}`,
    detail: questions.drift_type.criteria[evaluation.drift],
    facts: [
      { label: 'Note describes the trade', value: yesOrNo(answers.note_matches_trade), tone: evaluation.matches ? 'good' : 'bad' },
      { label: 'Accuracy of the note', value: levelOf(answers.note_honesty), tone: honestyTone(evaluation.honesty) },
      { label: 'Trader’s own rules followed', value: yesOrNo(answers.rule_followed), tone: evaluation.ruleFollowed ? 'good' : 'bad' },
      { label: 'Reads as written after the outcome', value: yesOrNo(answers.written_after_the_fact), tone: evaluation.afterTheFact ? 'warn' : 'good' },
      { label: 'On the record', value: `${size} · ${item.sizeLabel} position · ${item.exitReason} · written ${item.noteWrittenAt}` },
    ],
  };
}

const stage = {
  hide: ['id', 'tradeDate', 'plannedStop'],
  labels: {
    note: 'Journal note',
    noteWrittenAt: 'Note written',
    sizeUsd: 'Size filled (USD)',
    sizeLabel: 'Size against a full position',
    filledAt: 'Filled at',
    exitReason: 'How it was closed',
    resultPercent: 'Result (%)',
  },
  highlight: ['note', 'sizeLabel', 'filledAt', 'exitReason'],
};

const present = {
  number: 155,
  problem: {
    headline: 'A journal is what the trader believes happened. The blotter is what happened.',
    stat: '200',
    statLabel: 'journal notes, each beside its trade record',
  },
  hero: {
    item: 'JR-0008',
    caption: 'The note says “Waited for the pullback on MSFT… no chasing today.” The record says it was filled at the breakout, without waiting, and stopped out at −3%. Drift named: entry, accuracy 1.3 of 6.',
  },
  answers: {
    caption: 'Does the note match, where does it come apart, how accurate is it, and were the trader’s own rules kept.',
    reveal: ['note_matches_trade', 'drift_type', 'note_honesty', 'rule_followed'],
  },
  miss: {
    item: 'JR-0010',
    caption: 'An honest note: filled 126.99, sized full, out flat. It was doubted at 59% and called a rationalisation. 13 of the 126 honest notes were questioned like this.',
  },
  proof: {
    kpis: ['Notes read right', 'Drifting notes caught', 'Honest notes doubted'],
    chart: 'curve',
    closing: 'All 74 drifting notes were caught, at 85% precision: 87 notes doubted, 13 of them honest.',
  },
};

export default {
  id: 'journal-vs-reality',
  title: 'Journal versus reality',
  domain: 'trades',
  value: 'Compare what a trader wrote with what they actually did, and find where the story drifts.',
  tags: ['trades', 'journal', 'discipline', 'text'],
  dataClass: 'synthetic',
  readMinutes: 4,
  view: 'table',
  itemLabel: (item) => `${item.id} · ${item.symbol} · ${item.sizeLabel} · ${item.resultPercent > 0 ? '+' : ''}${item.resultPercent}%`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  labels: () => import('../../data/synthetic/journal-vs-reality.labels.json'),
  buildState,
  questions,
  evaluate,
  report,
  stage,
  grade,
  verdict,
  present,
  caveat: 'The record states most contradictions in words (“without waiting”, “closed by hand”, “two days later”) and each drift type comes from a few note templates, so five keyword checks sort all 200 notes; a harder dataset is planned.',
  explain: {
    data: 'scripts/generate/journal-vs-reality.js#demo:data',
    state: 'demos/journal-vs-reality/demo.js#demo:state',
    questions: 'demos/journal-vs-reality/demo.js#demo:questions',
    evaluate: 'demos/journal-vs-reality/demo.js#demo:evaluate',
  },
};
