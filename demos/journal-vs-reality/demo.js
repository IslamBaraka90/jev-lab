// Journal versus reality: two hundred notes beside the trades they describe. The note is what the
// trader believes happened; the record is what happened. Where the two come apart is the demo, and
// the five ways they come apart are the five things a journal is for catching.

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

  return {
    note: `Two hundred journal entries. ${drifting.length} of the notes drift from the record and ${honest.length} are honest. ${context.note ?? ''}`,
    findings: findings(graded, byItem, honest),
    kpis: kpis({ graded, drifting, honest, caught, byItem }),
    distribution: distribution(results),
    matrix: confusion(graded, byItem),
    curve: coverage(graded, byItem, drifting),
    checks: checks(graded, byItem, labels),
    topItems: topItems(results, byItem),
  };
}
// #endregion

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

function kpis({ graded, drifting, honest, caught, byItem }) {
  const named = drifting.filter((result) => result.evaluation.drift === byItem.get(result.item.id).drift);
  const doubted = honest.filter((result) => !result.evaluation.matches);
  const rationalisations = graded.filter((result) => byItem.get(result.item.id).drift === 'RATIONALISATION');
  const spotted = rationalisations.filter((result) => result.evaluation.afterTheFact);
  const losers = graded.filter((result) => result.item.resultPercent < 0);
  const driftOnLosers = losers.filter((result) => byItem.get(result.item.id).drift !== 'NONE');

  return [
    { label: 'Drifting notes caught', value: `${caught.length} of ${drifting.length}`, context: 'the note does not describe the trade', tone: caught.length === drifting.length ? 'good' : 'warn' },
    { label: 'Drift named exactly', value: `${named.length} of ${drifting.length}`, context: 'size, entry, exit, instrument or a plan invented afterwards' },
    { label: 'Honest notes doubted', value: `${doubted.length} of ${honest.length}`, context: 'notes that agree with the record and were called out anyway', tone: doubted.length > honest.length / 10 ? 'warn' : 'good' },
    { label: 'Written after the outcome', value: `${spotted.length} of ${rationalisations.length}`, context: 'notes that know more than the evening of the trade could' },
    { label: 'Drift among losing trades', value: share(driftOnLosers.length, losers.length), context: `${driftOnLosers.length} of ${losers.length} losers have a note that drifts` },
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
  return { title: 'Reading the least accurate notes first', xLabel: 'Notes at this honesty score or below', yLabel: 'Notes that really drift', rateLabel: 'Share of them that do', of: drifting.length, points };
}

function findings(graded, byItem, honest) {
  const lines = [];
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
  explain: {
    data: 'scripts/generate/journal-vs-reality.js#demo:data',
    state: 'demos/journal-vs-reality/demo.js#demo:state',
    questions: 'demos/journal-vs-reality/demo.js#demo:questions',
    evaluate: 'demos/journal-vs-reality/demo.js#demo:evaluate',
  },
};
