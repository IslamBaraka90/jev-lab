// One week at a time: what kind of market is this, and which strategy should be allowed to trade in
// it. Three hundred and twelve weeks across four instruments, all real cached bars.
//
// The report runs the three shipped strategies twice over exactly the same bars with exactly the same
// costs. The only difference is the gate: in the second run a strategy may only open a trade in a
// week whose answer named its family. Weeks the gate closed show as flat stretches on the curve.
//
// A gate like this flatters itself the moment it can see forward, so the state stops at the last bar
// of the week being judged and the demo asserts it in the tests.

import { choice, noul, score } from '../lib/questions.js';
import { STRATEGIES, trades } from '../../src/strategies/index.js';

const REGIMES = ['TREND_UP', 'TREND_DOWN', 'RANGE', 'HIGH_VOLATILITY', 'EVENT_DRIVEN'];
const FITS = ['TREND_FOLLOWING', 'MEAN_REVERSION', 'BREAKOUT', 'STAY_OUT'];
const SIZES = { NONE: 0, HALF: 0.5, NORMAL: 1, INCREASED: 1.5 };

const readable = (value) => value.toLowerCase().replaceAll('_', ' ');
const sentence = (value) => readable(value).replace(/^./, (letter) => letter.toUpperCase());
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

// #region demo:state
/** The week being judged, the weeks before it, and the daily bars up to its last session. */
function buildState(item, context) {
  const daily = context.dailySeries[item.symbol];
  const weekly = context.weeklySeries[item.symbol];

  return {
    task: 'Say what kind of market this is as at the end of this week, and which kind of strategy should be allowed to trade in it.',
    instrument: item.symbol,
    week: { starts: item.weekStart, ends: item.weekEnd, sessions: item.sessionsInTheWeek },
    long_run_volatility_percent: context.longRunVolatility[item.symbol],
    weekly_history: weekly.slice(Math.max(0, item.weekIndex - context.weeklySummariesInState + 1), item.weekIndex + 1),
    week_format: context.weekFormat,
    daily_bars_to_the_end_of_this_week: daily.slice(Math.max(0, item.lastBarIndex - context.dailyBarsInState + 1), item.lastBarIndex + 1),
    bar_format: context.barFormat,
    note: 'Nothing after this week is here. A regime call that could see next week would not be a regime call.',
  };
}
// #endregion

// #region demo:questions
const questions = {
  regime: choice('What kind of market is this?', {
    TREND_UP: 'Going up, and the moves down are the small ones.',
    TREND_DOWN: 'Going down, and the moves up are the small ones.',
    RANGE: 'Going nowhere between two levels it keeps returning to.',
    HIGH_VOLATILITY: 'Moving a long way in both directions, faster than it usually does.',
    EVENT_DRIVEN: 'Being moved by something specific rather than by a trend — gaps, not drift.',
  }),
  regime_clarity: score('How clear is that?', [
    'Unclear', 'Very unclear', 'Somewhat unclear', 'Mixed', 'Clear', 'Very clear', 'Unmistakable',
  ]),
  strategy_fit: choice('What should be allowed to trade this week?', {
    TREND_FOLLOWING: 'Something that buys strength and holds it.',
    MEAN_REVERSION: 'Something that buys a pullback and expects it to come back.',
    BREAKOUT: 'Something that buys a level being taken out.',
    STAY_OUT: 'Nothing. Not every week is worth trading.',
  }),
  risk_scaling: choice('At what size?', {
    NONE: 'Nothing at all this week.',
    HALF: 'Half of what you would normally risk.',
    NORMAL: 'The usual size.',
    INCREASED: 'More than usual, because the conditions warrant it.',
  }),
  regime_changing: noul('Is the regime turning over right now?', {
    yes: 'Whatever this has been, it is in the middle of becoming something else.',
    no: 'It is doing what it has been doing.',
  }),
};
// #endregion

// #region demo:evaluate
/** One week's call, made with no sight of the week after it. */
function evaluate(answers, item) {
  return {
    regime: answers.regime.choice,
    clarity: answers.regime_clarity.score,
    fit: answers.strategy_fit.choice,
    size: SIZES[answers.risk_scaling.choice] ?? 1,
    sizeName: answers.risk_scaling.choice,
    changing: answers.regime_changing.noul >= 0.5,
    confidence: answers.regime.confidence,
    label: `${item.symbol} · week to ${item.weekEnd} · ${readable(answers.regime.choice)} · ${readable(answers.strategy_fit.choice)}`,
  };
}
// #endregion

/** The demo's own reading of the same week, so the call can be put beside an arithmetic one. */
function measured(item, context) {
  const weekly = context.weeklySeries[item.symbol]
    .slice(Math.max(0, item.weekIndex - 12), item.weekIndex + 1)
    .map((line) => String(line).split(' '));
  const changes = weekly.map((parts) => Number(parts[1]));
  const ranges = weekly.map((parts) => Number(parts[2]));
  const gaps = weekly.reduce((sum, parts) => sum + Number(parts[3]), 0);
  const drift = changes.reduce((sum, value) => sum + value, 0);
  const spread = Math.sqrt(average(changes.map((value) => (value - average(changes)) ** 2)));

  return {
    driftPercent: Number(drift.toFixed(2)),
    weeklyVolatilityPercent: Number(spread.toFixed(2)),
    averageRangePercent: Number(average(ranges).toFixed(2)),
    gapsInThirteenWeeks: gaps,
    // Names the same five regimes from arithmetic alone, as a cross-check and not as an answer.
    reading: spread > context.longRunVolatility[item.symbol] / 5 ? 'HIGH_VOLATILITY'
      : gaps >= 4 ? 'EVENT_DRIVEN'
        : drift > 4 ? 'TREND_UP'
          : drift < -4 ? 'TREND_DOWN'
            : 'RANGE',
  };
}

// #region demo:report
/** The same strategies, the same bars, the same costs: once always on, once only when allowed. */
function report(results, context = {}) {
  const graded = results.filter((result) => result.evaluation);
  const byWeek = new Map(graded.map((result) => [`${result.item.symbol}:${result.item.weekEnd}`, result]));
  const runs = STRATEGIES.map((strategy) => runBoth(strategy, graded, byWeek, context));
  const ungated = runs.reduce((sum, run) => sum + run.ungated, 0);
  const gated = runs.reduce((sum, run) => sum + run.gated, 0);

  return {
    note: `${graded.length} weeks across ${context.instruments?.length ?? 4} instruments. ${context.note ?? ''}`,
    findings: findings(graded, runs, context, { ungated, gated }),
    kpis: kpis(graded, runs, context, { ungated, gated }),
    distribution: REGIMES
      .map((value) => ({ label: sentence(value), count: graded.filter((result) => result.evaluation.regime === value).length, tone: value === 'HIGH_VOLATILITY' ? 'warn' : undefined }))
      .filter((entry) => entry.count),
    matrix: crossCheck(graded, context),
    curve: clarityCurve(graded, context),
    equityCurve: equity(runs, graded),
    checks: checks(graded, runs, context),
    topItems: topItems(graded),
  };
}
// #endregion

/**
 * One strategy, run twice. Identical signals, identical bars, identical cost: the gated run simply
 * declines the trades whose week did not name this strategy's family, and scales the rest.
 */
function runBoth(strategy, graded, byWeek, context) {
  const taken = [];
  let ungated = 0;
  let gated = 0;

  for (const symbol of context.instruments ?? []) {
    const bars = (context.dailySeries?.[symbol] ?? []).map(parse);
    if (!bars.length) continue;
    for (const trade of trades(bars, strategy.signals(bars))) {
      const week = byWeek.get(`${symbol}:${weekEndFor(bars, trade.index, graded, symbol)}`);
      const allowed = week && week.evaluation.fit === strategy.family;
      const size = allowed ? week.evaluation.size : 0;
      ungated += trade.returnPercent;
      gated += trade.returnPercent * size;
      taken.push({ symbol, ...trade, allowed: Boolean(allowed), size, weekId: week?.item.id ?? null });
    }
  }

  return { strategy, ungated: Number(ungated.toFixed(2)), gated: Number(gated.toFixed(2)), taken };
}

const parse = (line) => {
  const [date, open, high, low, close] = String(line).split(' ');
  return { date, open: Number(open), high: Number(high), low: Number(low), close: Number(close) };
};

/** The week a trade's entry bar falls in, matched to the weeks this run actually judged. */
function weekEndFor(bars, index, graded, symbol) {
  const date = bars[index].date;
  const weeks = graded.filter((result) => result.item.symbol === symbol).map((result) => result.item);
  const found = weeks.find((week) => week.weekStart <= date && date <= week.weekEnd);
  return found?.weekEnd ?? null;
}

function kpis(graded, runs, context, { ungated, gated }) {
  const stayOut = graded.filter((result) => result.evaluation.fit === 'STAY_OUT');
  const blocked = runs.reduce((sum, run) => sum + run.taken.filter((trade) => !trade.allowed).length, 0);
  const allowed = runs.reduce((sum, run) => sum + run.taken.filter((trade) => trade.allowed).length, 0);
  const blockedReturn = runs.reduce((sum, run) => sum + run.taken.filter((trade) => !trade.allowed).reduce((inner, trade) => inner + trade.returnPercent, 0), 0);
  const agrees = graded.filter((result) => result.evaluation.regime === measured(result.item, context).reading);
  const changing = graded.filter((result) => result.evaluation.changing);
  const busiest = [...runs].sort((left, right) => right.taken.length - left.taken.length)[0] ?? { taken: [], strategy: { name: 'none', family: 'NONE' } };

  return [
    { label: 'Strategies always on', value: percent(ungated), context: `${blocked + allowed} trades across ${runs.length} strategies`, tone: ungated > 0 ? 'good' : 'warn' },
    { label: 'Strategies gated by the regime call', value: percent(gated), context: `${allowed} of those trades allowed through, scaled by the size answer`, tone: gated > ungated ? 'good' : 'warn' },
    { label: 'What the gate was worth', value: percent(gated - ungated), context: 'same signals, same bars, same costs; only the gate differs', tone: gated > ungated ? 'good' : 'warn' },
    { label: 'Trades the gate refused', value: `${blocked} of ${blocked + allowed}`, context: `worth ${percent(blockedReturn)} in total, which is what turning them off cost or saved` },
    { label: 'Weeks it said stay out', value: `${stayOut.length} of ${graded.length}`, context: 'no strategy allowed to open anything at all' },
    { label: 'Where the book’s trades come from', value: `${Math.round((busiest.taken.length / Math.max(blocked + allowed, 1)) * 100)}% from one rule`, context: `${busiest.strategy.name}, whose family was named in ${graded.filter((result) => result.evaluation.fit === busiest.strategy.family).length} of ${graded.length} weeks`, tone: 'warn' },
    { label: 'Agrees with the demo’s own reading', value: `${agrees.length} of ${graded.length}`, context: 'the same five names, worked out from drift, spread and gaps alone' },
    { label: 'Weeks called a turning point', value: `${changing.length} of ${graded.length}`, context: `${changing.filter((result) => result.evaluation.clarity < 4).length} of those were also called unclear` },
  ];
}

function checks(graded, runs, context) {
  const wrongWay = runs.flatMap((run) => run.taken.filter((trade) => !trade.allowed && trade.returnPercent > 3).map((trade) => ({ run, trade })));
  const kept = runs.flatMap((run) => run.taken.filter((trade) => trade.allowed && trade.returnPercent < -3).map((trade) => ({ run, trade })));
  const disagree = graded.filter((result) => result.evaluation.regime !== measured(result.item, context).reading);
  const volatile_ = graded.filter((result) => measured(result.item, context).reading === 'HIGH_VOLATILITY');
  const sizedUp = volatile_.filter((result) => result.evaluation.size > 1);

  return [
    { id: 'blocked-winners', label: 'Gate refused a trade that worked', detail: 'The week did not name this strategy, and the trade made over three per cent.', count: wrongWay.length, of: runs.reduce((sum, run) => sum + run.taken.filter((trade) => trade.returnPercent > 3).length, 0), items: wrongWay.slice(0, 20).map(({ trade }) => trade.weekId).filter(Boolean) },
    { id: 'allowed-losers', label: 'Gate let through a trade that lost', detail: 'The week named this strategy, and the trade lost over three per cent.', count: kept.length, of: runs.reduce((sum, run) => sum + run.taken.filter((trade) => trade.returnPercent < -3).length, 0), items: kept.slice(0, 20).map(({ trade }) => trade.weekId).filter(Boolean) },
    { id: 'disagrees', label: 'Regime named differently from the arithmetic', detail: 'The demo names the same five from drift, weekly spread and gap count.', count: disagree.length, of: graded.length, items: disagree.slice(0, 20).map((result) => result.item.id) },
    { id: 'sized-up', label: 'Size raised in a week the numbers call volatile', detail: 'Weekly spread above a fifth of the instrument’s long-run volatility.', count: sizedUp.length, of: volatile_.length, items: sizedUp.slice(0, 20).map((result) => result.item.id) },
  ];
}

function crossCheck(graded, context) {
  return {
    title: 'Regime named against the regime the arithmetic gives',
    columns: REGIMES.map(sentence),
    rows: REGIMES.map((actual) => ({
      label: sentence(actual),
      cells: REGIMES.map((predicted) => ({
        predicted,
        count: graded.filter((result) => measured(result.item, context).reading === actual && result.evaluation.regime === predicted).length,
        diagonal: actual === predicted,
      })),
    })),
  };
}

/** Are the weeks it called clear the ones it also agreed with itself about? */
function clarityCurve(graded, context) {
  const agreeing = graded.filter((result) => result.evaluation.regime === measured(result.item, context).reading);
  const points = Array.from({ length: 7 }, (_, bar) => {
    const at = graded.filter((result) => result.evaluation.clarity >= bar);
    const same = at.filter((result) => result.evaluation.regime === measured(result.item, context).reading);
    return { threshold: Number((bar / 6).toFixed(3)), reviewed: at.length, caught: same.length, rate: at.length ? Number((same.length / at.length).toFixed(3)) : null };
  });
  return { title: 'Clarity against agreement with the arithmetic', xLabel: 'Weeks called this clear or clearer', yLabel: 'Of those, the ones the numbers agree with', rateLabel: 'Share that agree', of: agreeing.length, points };
}

/** Both books, trade by trade in date order. The gated one is flat where the gate was shut. */
function equity(runs, graded) {
  const all = runs.flatMap((run) => run.taken.map((trade) => ({ ...trade, strategy: run.strategy }))).sort((left, right) => left.date.localeCompare(right.date));
  let always = 10_000;
  let gatedTotal = 10_000;

  const points = all.map((trade, index) => {
    always *= 1 + trade.returnPercent / 100;
    gatedTotal *= 1 + (trade.returnPercent * trade.size) / 100;
    return {
      id: `${trade.strategy.id}-${index}`,
      label: `${trade.date} · ${trade.symbol} · ${trade.strategy.name}`,
      value: Math.round(always),
      compare: Math.round(gatedTotal),
      flagged: trade.allowed,
      pattern: `${trade.allowed ? `allowed at ${trade.size}×` : 'gate shut'} · ${percent(trade.returnPercent)}`,
    };
  });

  return { title: 'Ten thousand through the strategies always on, against the same trades gated by the weekly call', seriesLabel: 'Always on', compareLabel: 'Gated', points };
}

function findings(graded, runs, context, { ungated, gated }) {
  const lines = [];
  lines.push(gated > ungated
    ? `The gate added ${percent(gated - ungated)} over the same trades. It refused ${runs.reduce((sum, run) => sum + run.taken.filter((trade) => !trade.allowed).length, 0)} of them, and the ones it refused were worth ${percent(runs.reduce((sum, run) => sum + run.taken.filter((trade) => !trade.allowed).reduce((inner, trade) => inner + trade.returnPercent, 0), 0))} between them.`
    : `The gate cost ${percent(ungated - gated)} over the same trades. Turning strategies off in the weeks it did not like them left money on the table, which is the honest result and the one worth showing.`);

  for (const run of runs) {
    if (!run.taken.length) continue;
    const allowed = run.taken.filter((trade) => trade.allowed);
    lines.push(`${run.strategy.name}: ${percent(run.ungated)} always on, ${percent(run.gated)} gated, ${allowed.length} of ${run.taken.length} trades allowed through.`);
  }

  // Which family the gate hands the keys to matters more than how often it is right, because the book
  // is not evenly divided between them. This is the mechanism behind whatever the totals say.
  const busiest = [...runs].sort((left, right) => right.taken.length - left.taken.length)[0];
  if (busiest?.taken.length) {
    const weeksNaming = graded.filter((result) => result.evaluation.fit === busiest.strategy.family).length;
    const shareOfTrades = Math.round((busiest.taken.length / runs.reduce((sum, run) => sum + run.taken.length, 0)) * 100);
    lines.push(`${busiest.strategy.name} is ${shareOfTrades} per cent of the trades in this book, and ${readable(busiest.strategy.family)} was the answer in ${weeksNaming} of ${graded.length} weeks. One answer the gate rarely gives decides most of what the book does, which is a fact about the book as much as about the gate.`);
  }

  const stayOut = graded.filter((result) => result.evaluation.fit === 'STAY_OUT');
  if (stayOut.length) lines.push(`${stayOut.length} of ${graded.length} weeks were called unfit for anything. Those weeks are the flat stretches on the gated curve.`);
  else lines.push('Not one week in the file was called unfit for trading. A gate that is never shut is not a gate.');

  const disagree = graded.filter((result) => result.evaluation.regime !== measured(result.item, context).reading);
  lines.push(`${disagree.length} of ${graded.length} weeks were named differently from the arithmetic reading beside them. That is a disagreement, not an error: drift, spread and a gap count are a crude way to name a regime and the point of showing both is that neither is authoritative.`);
  return lines;
}

function topItems(graded) {
  return [...graded]
    .sort((left, right) => right.evaluation.clarity - left.evaluation.clarity || right.evaluation.confidence - left.evaluation.confidence)
    .slice(0, 10)
    .map((result) => ({ id: result.item.id, label: result.evaluation.label, value: `${result.evaluation.clarity.toFixed(1)} of 6 · ${readable(result.evaluation.sizeName)}` }));
}

export default {
  id: 'regime-classification',
  title: 'Regime classification',
  domain: 'strategy',
  value: 'Decide what kind of market this is, then let that decide which strategy is allowed to trade.',
  tags: ['strategy', 'prices', 'real data', 'regime'],
  dataClass: 'cached-real',
  readMinutes: 5,
  view: 'candles',
  itemLabel: (item) => `${item.symbol} · week to ${item.weekEnd}`,
  data: () => import('./data.json'),
  fixtures: () => import('./fixtures.json'),
  buildState,
  questions,
  evaluate,
  report,
  explain: {
    data: 'src/strategies/index.js#strategy:rules',
    state: 'demos/regime-classification/demo.js#demo:state',
    questions: 'demos/regime-classification/demo.js#demo:questions',
    evaluate: 'demos/regime-classification/demo.js#demo:evaluate',
  },
};
