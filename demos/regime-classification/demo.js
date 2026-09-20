// One week at a time: what kind of market is this, and which strategy should be allowed to trade in
// it. Three hundred and twelve weeks across four instruments, all real cached bars.
//
// The report runs the three shipped strategies twice over exactly the same bars with exactly the same
// costs. The only difference is the gate: in the second run a strategy may only open a trade if the
// answer for the week before named its family. Weeks the gate closed show as flat stretches on the curve.
//
// A gate like this flatters itself the moment it can see forward, so the state stops at the last bar
// of the week being judged, and a call is only ever applied to trades entered after that bar.

import { choice, noul, rubricOf, score } from '../lib/questions.js';
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
  const { changes, ranges, gaps, drift, spread } = thirteenWeeks(context.weeklySeries[item.symbol], item.weekIndex);
  const bars = ownThresholds(item.symbol, context);
  const trend = context.longRunVolatility[item.symbol] / 4;

  return {
    driftPercent: Number(drift.toFixed(2)),
    weeklyVolatilityPercent: Number(spread.toFixed(2)),
    averageRangePercent: Number(average(ranges).toFixed(2)),
    gapsInThirteenWeeks: gaps,
    weeksMeasured: changes.length,
    // Names the same five regimes from arithmetic alone, as a cross-check and not as an answer.
    // Volatile and event-driven mean the top fifth of this instrument's own history: a fixed gap count
    // calls a stock that gaps every week event-driven for ever.
    reading: spread > bars.spread ? 'HIGH_VOLATILITY'
      : gaps > bars.gaps ? 'EVENT_DRIVEN'
        : drift > trend ? 'TREND_UP'
          : drift < -trend ? 'TREND_DOWN'
            : 'RANGE',
  };
}

/** Drift, spread and gap count over the thirteen weeks ending at `weekIndex`. */
function thirteenWeeks(series, weekIndex) {
  const weekly = series.slice(Math.max(0, weekIndex - 12), weekIndex + 1).map((line) => String(line).split(' '));
  const changes = weekly.map((parts) => Number(parts[1]));
  return {
    changes,
    ranges: weekly.map((parts) => Number(parts[2])),
    gaps: weekly.reduce((sum, parts) => sum + Number(parts[3]), 0),
    drift: changes.reduce((sum, value) => sum + value, 0),
    spread: Math.sqrt(average(changes.map((value) => (value - average(changes)) ** 2))),
  };
}

const thresholdCache = new WeakMap();

/** The level that marks the top fifth of one instrument's own thirteen-week spreads and gap counts. */
function ownThresholds(symbol, context) {
  const series = context.weeklySeries;
  if (!thresholdCache.has(series)) thresholdCache.set(series, new Map());
  const cache = thresholdCache.get(series);
  if (!cache.has(symbol)) {
    const windows = series[symbol].map((_, index) => thirteenWeeks(series[symbol], index)).slice(12);
    const topFifth = (values) => [...values].sort((left, right) => left - right)[Math.floor(values.length * 0.8)] ?? Infinity;
    cache.set(symbol, { spread: topFifth(windows.map((entry) => entry.spread)), gaps: topFifth(windows.map((entry) => entry.gaps)) });
  }
  return cache.get(symbol);
}

// #region demo:report
/** The same strategies, the same bars, the same costs: once always on, once only when allowed. */
function report(results, context = {}) {
  const graded = results.filter((result) => result.evaluation);
  const runs = STRATEGIES.map((strategy) => runBoth(strategy, graded, context));
  const ungated = runs.reduce((sum, run) => sum + run.ungated, 0);
  const gated = runs.reduce((sum, run) => sum + run.gated, 0);
  const calls = gateCalls(graded, context);

  return {
    note: `${graded.length} weeks across ${context.instruments?.length ?? 4} instruments. Each trade is gated by the call made at the end of the week before it was entered, never by its own week. Totals are sums of per-trade returns, not a portfolio return. ${context.note ?? ''}`,
    findings: findings(graded, runs, context, { ungated, gated, calls }),
    kpis: kpis(graded, runs, context, { ungated, gated, calls }),
    baselines: baselines(calls, context),
    metrics: metrics(calls),
    distributionTitle: 'Regimes named',
    distribution: REGIMES
      .map((value) => ({ label: sentence(value), count: graded.filter((result) => result.evaluation.regime === value).length, tone: value === 'HIGH_VOLATILITY' ? 'warn' : undefined }))
      .filter((entry) => entry.count),
    matrix: crossCheck(graded, context),
    curve: clarityCurve(graded, context),
    equityCurve: equity(runs, graded),
    checks: checks(graded, runs, context),
    topItemsTitle: 'Weeks called clearest',
    topItems: topItems(graded),
  };
}
// #endregion

/**
 * One strategy, run twice. Identical signals, identical bars, identical cost: the gated run simply
 * declines the trades whose week did not name this strategy's family, and scales the rest.
 */
function runBoth(strategy, graded, context) {
  const taken = [];
  const unjudged = [];
  let ungated = 0;
  let gated = 0;

  for (const symbol of context.instruments ?? []) {
    const weeks = graded.filter((result) => result.item.symbol === symbol);
    for (const trade of strategyTrades(strategy, symbol, context)) {
      // A trade nobody had made a call for belongs to neither run; counting it as refused blames the gate.
      const week = weeks.find((result) => gatesEntry(result.item, trade.date));
      if (!week) {
        unjudged.push({ symbol, ...trade });
        continue;
      }
      const allowed = week.evaluation.fit === strategy.family;
      const size = allowed ? week.evaluation.size : 0;
      ungated += trade.returnPercent;
      gated += trade.returnPercent * size;
      taken.push({ symbol, ...trade, allowed, size, weekId: week.item.id });
    }
  }

  return { strategy, ungated: Number(ungated.toFixed(2)), gated: Number(gated.toFixed(2)), taken, unjudged };
}

const parse = (line) => {
  const [date, open, high, low, close] = String(line).split(' ');
  return { date, open: Number(open), high: Number(high), low: Number(low), close: Number(close) };
};

const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/**
 * A week's call may only gate trades entered after that week has ended: the call is made from bars to
 * the week's last session, so applying it to a trade entered earlier that week lets it see past the
 * entry. Nine days reaches every session of the following week, across a holiday, and no further.
 */
function gatesEntry(week, entryDate) {
  const days = daysBetween(week.weekEnd, entryDate);
  return days > 0 && days <= 9;
}

// The strategies' trades depend on the bars alone, so they are worked out once per dataset.
const tradeCache = new WeakMap();

function strategyTrades(strategy, symbol, context) {
  const series = context.dailySeries;
  if (!series?.[symbol]?.length) return [];
  if (!tradeCache.has(series)) tradeCache.set(series, new Map());
  const cache = tradeCache.get(series);
  const key = `${strategy.id}:${symbol}`;
  if (!cache.has(key)) {
    const bars = series[symbol].map(parse);
    cache.set(key, trades(bars, strategy.signals(bars)));
  }
  return cache.get(key);
}

/** The trades one week's call decided on: everything any strategy entered in the week after it. */
function gatedBy(result, context) {
  return STRATEGIES.flatMap((strategy) => strategyTrades(strategy, result.item.symbol, context)
    .filter((trade) => gatesEntry(result.item, trade.date))
    .map((trade) => ({ ...trade, strategy, allowed: result.evaluation.fit === strategy.family })));
}

/** A call is right when allowing what it allowed and refusing what it refused came out ahead. */
const callWorth = (gatedTrades, allows) => gatedTrades.reduce((sum, trade) => sum + (allows(trade) ? trade.returnPercent : -trade.returnPercent), 0);

/** Every judged week whose call had a trade to decide on, with whether the price agreed. */
function gateCalls(graded, context) {
  return graded
    .map((result) => ({ result, trades: gatedBy(result, context) }))
    .filter((call) => call.trades.length)
    .map((call) => ({ ...call, agree: callWorth(call.trades, (trade) => trade.allowed) > 0 }));
}

/** Rule: let every strategy trade next week if the last thirteen weeks drifted up, none if they did not. */
const ruleAllows = (result, context) => measured(result.item, context).driftPercent > 0;

function baselines(calls, context) {
  if (!calls.length) return undefined;
  const rightWhen = (allows) => calls.filter((call) => callWorth(call.trades, (trade) => allows(call, trade)) > 0).length;
  const model = calls.filter((call) => call.agree).length;
  const rule = rightWhen((call) => ruleAllows(call.result, context));
  const always = rightWhen(() => true);
  return [
    { label: 'Jev', detail: `weekly calls the following week’s trades agreed with, ${model} of ${calls.length}`, value: model / calls.length, model: true },
    { label: 'Rule: trade if the last thirteen weeks drifted up', detail: `one line over the weekly history in the state, ${rule} of ${calls.length}`, value: rule / calls.length },
    { label: 'Always let everything trade', detail: `no gate at all, ${always} of ${calls.length}`, value: always / calls.length },
    { label: 'Never let anything trade', detail: `${calls.length - always} of ${calls.length}`, value: (calls.length - always) / calls.length },
  ];
}

function metrics(calls) {
  const right = calls.filter((call) => call.agree).length;
  return {
    headline: { label: 'Gate calls the price agreed with', value: calls.length ? right / calls.length : 0, n: calls.length },
    accuracy: calls.length ? right / calls.length : null,
  };
}

/** No label exists, so a week is graded by what its call did to the trades entered the week after. */
function judge(result, label, context = {}) {
  if (!result.evaluation || !context.dailySeries) return null;
  const gatedTrades = gatedBy(result, context);
  if (!gatedTrades.length) return null;
  const total = gatedTrades.reduce((sum, trade) => sum + trade.returnPercent, 0);
  const allowedAny = gatedTrades.some((trade) => trade.allowed);
  const detail = gatedTrades.map((trade) => `${trade.strategy.name} on ${trade.date} ${trade.allowed ? 'allowed' : 'refused'}, later ${percent(trade.returnPercent)}`).join('; ');
  return {
    agree: callWorth(gatedTrades, (trade) => trade.allowed) > 0,
    expected: total > 0 ? 'ALLOW' : 'REFUSE',
    got: allowedAny ? 'ALLOW' : 'REFUSE',
    note: `Graded against the price, not a label. This call gated the following week: ${detail}. Weeks that gated no trade are not graded.`,
    confidence: result.answers.strategy_fit.confidence,
  };
}

const CLARITY_LEVELS = rubricOf(questions.regime_clarity);

function verdict(result, context = {}) {
  const { evaluation, item, answers } = result;
  const gatedTrades = context.dailySeries ? gatedBy(result, context) : [];
  const stayOut = evaluation.fit === 'STAY_OUT';
  const facts = [
    { label: 'Regime', value: `${sentence(evaluation.regime)} · ${Math.round(evaluation.confidence * 100)}%` },
    { label: 'How clear', value: `${CLARITY_LEVELS[Math.round(evaluation.clarity)]} · ${evaluation.clarity.toFixed(1)} of 6` },
    { label: 'Size', value: `${sentence(evaluation.sizeName)} · ${evaluation.size}×`, tone: evaluation.size > 1 ? 'warn' : undefined },
    { label: 'Turning over', value: `${evaluation.changing ? 'Yes' : 'No'} · ${Math.round(answers.regime_changing.noul * 100)}%`, tone: evaluation.changing ? 'warn' : undefined },
  ];
  for (const trade of gatedTrades.slice(0, 2)) {
    const right = trade.allowed === trade.returnPercent > 0;
    facts.push({ label: `${trade.strategy.name}, entered ${trade.date}`, value: `${trade.allowed ? 'Allowed' : 'Refused'} · later ${percent(trade.returnPercent)}`, tone: right ? 'good' : 'bad' });
  }
  return {
    eyebrow: 'What this call switches on for next week',
    headline: stayOut ? 'Stay out · nothing may trade' : `${sentence(evaluation.fit)} only · ${evaluation.size}× size`,
    detail: gatedTrades.length ? 'The call applies to trades entered in the week after this one, not to this week’s.' : 'No strategy entered a trade in the week after this one, so the call decided nothing.',
    facts,
  };
}

function kpis(graded, runs, context, { ungated, gated, calls }) {
  const stayOut = graded.filter((result) => result.evaluation.fit === 'STAY_OUT');
  const blocked = runs.reduce((sum, run) => sum + run.taken.filter((trade) => !trade.allowed).length, 0);
  const allowed = runs.reduce((sum, run) => sum + run.taken.filter((trade) => trade.allowed).length, 0);
  const blockedReturn = runs.reduce((sum, run) => sum + run.taken.filter((trade) => !trade.allowed).reduce((inner, trade) => inner + trade.returnPercent, 0), 0);
  const agrees = graded.filter((result) => result.evaluation.regime === measured(result.item, context).reading);
  const busiest = [...runs].sort((left, right) => right.taken.length - left.taken.length)[0] ?? { taken: [], strategy: { name: 'none', family: 'NONE' } };

  const right = calls.filter((call) => call.agree).length;
  const unjudged = runs.flatMap((run) => run.unjudged);
  const allowedTrades = runs.flatMap((run) => run.taken.filter((trade) => trade.allowed));
  const allowedUnscaled = allowedTrades.reduce((sum, trade) => sum + trade.returnPercent, 0);
  const points = (value) => `${Math.abs(value).toFixed(2)} points`;

  return [
    { label: 'Gate calls the price agreed with', value: `${right} of ${calls.length}`, context: 'weeks whose call decided on a trade the week after: right if allowing what it allowed and refusing what it refused came out ahead', tone: calls.length && right > calls.length / 2 ? 'good' : 'warn' },
    { label: 'Strategies always on', value: percent(ungated), context: `sum of ${blocked + allowed} trade returns across ${runs.length} strategies, inside the judged weeks only; ${unjudged.length} earlier trades had no call and are in neither run`, tone: ungated > 0 ? 'good' : 'warn' },
    { label: 'Strategies gated by the regime call', value: percent(gated), context: `${allowed} of those trades allowed through by the previous week’s call, scaled by its size answer`, tone: gated > ungated ? 'good' : 'warn' },
    { label: 'What the gate was worth', value: percent(gated - ungated), context: `refusing ${blocked} trades ${blockedReturn > 0 ? 'gave up' : 'saved'} ${points(blockedReturn)}; sizing the ${allowed} allowed ones ${gated < allowedUnscaled ? 'gave up' : 'added'} ${points(gated - allowedUnscaled)}`, tone: gated > ungated ? 'good' : 'warn' },
    { label: 'Trades the gate refused', value: `${blocked} of ${blocked + allowed}`, context: `worth ${percent(blockedReturn)} in total, which is what turning them off cost or saved` },
    { label: 'Weeks it said stay out', value: `${stayOut.length} of ${graded.length}`, context: 'no strategy allowed to open anything at all' },
    { label: 'Where the book’s trades come from', value: `${Math.round((busiest.taken.length / Math.max(blocked + allowed, 1)) * 100)}% from one rule`, context: `${busiest.strategy.name}, whose family was named in ${graded.filter((result) => result.evaluation.fit === busiest.strategy.family).length} of ${graded.length} weeks`, tone: 'warn' },
    { label: 'Agrees with the demo’s own reading', value: `${agrees.length} of ${graded.length}`, context: 'the same five names, worked out from drift, spread and gaps alone; a second crude reading, not a mark' },
  ];
}

function checks(graded, runs, context) {
  const wrongWay = runs.flatMap((run) => run.taken.filter((trade) => !trade.allowed && trade.returnPercent > 3).map((trade) => ({ run, trade })));
  const kept = runs.flatMap((run) => run.taken.filter((trade) => trade.allowed && trade.returnPercent < -3).map((trade) => ({ run, trade })));
  const disagree = graded.filter((result) => result.evaluation.regime !== measured(result.item, context).reading);
  const volatile_ = graded.filter((result) => measured(result.item, context).reading === 'HIGH_VOLATILITY');
  const sizedUp = volatile_.filter((result) => result.evaluation.size > 1);

  return [
    { id: 'blocked-winners', label: 'Gate refused a trade that worked', detail: 'The week before did not name this strategy, and the trade made over three per cent.', count: wrongWay.length, of: runs.reduce((sum, run) => sum + run.taken.filter((trade) => trade.returnPercent > 3).length, 0), items: wrongWay.slice(0, 20).map(({ trade }) => trade.weekId).filter(Boolean) },
    { id: 'allowed-losers', label: 'Gate let through a trade that lost', detail: 'The week before named this strategy, and the trade lost over three per cent.', count: kept.length, of: runs.reduce((sum, run) => sum + run.taken.filter((trade) => trade.returnPercent < -3).length, 0), items: kept.slice(0, 20).map(({ trade }) => trade.weekId).filter(Boolean) },
    { id: 'disagrees', label: 'Regime named differently from the arithmetic', detail: 'The demo names the same five from drift, weekly spread and gap count. A disagreement between two crude readings, not an error.', count: disagree.length, of: graded.length, items: disagree.slice(0, 20).map((result) => result.item.id) },
    { id: 'sized-up', label: 'Size raised in a week the numbers call volatile', detail: 'Weekly spread in the top fifth of the instrument’s own thirteen-week history.', count: sizedUp.length, of: volatile_.length, items: sizedUp.slice(0, 20).map((result) => result.item.id) },
  ];
}

function crossCheck(graded, context) {
  return {
    title: 'Regime named against the regime the arithmetic gives',
    rowLabel: 'the demo’s own arithmetic reading, itself crude',
    columnLabel: 'the regime the model named',
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
  return { title: 'Clarity against agreement with the arithmetic', xLabel: 'Weeks called this clear or clearer', yLabel: 'Of those, the ones the numbers agree with', rateLabel: 'Share that agree', of: agreeing.length, thresholdFormat: 'level', levels: 6, defaultIndex: 4, points };
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

  return { title: 'Ten thousand through the judged trades one after another, always on against gated by the previous week’s call', seriesLabel: 'Always on', compareLabel: 'Gated', points };
}

function findings(graded, runs, context, { ungated, gated, calls }) {
  const lines = [];
  const refused = runs.flatMap((run) => run.taken.filter((trade) => !trade.allowed));
  const refusedReturn = refused.reduce((sum, trade) => sum + trade.returnPercent, 0);
  const judgedTrades = runs.reduce((sum, run) => sum + run.taken.length, 0);
  lines.push(gated > ungated
    ? `The gate added ${Math.abs(gated - ungated).toFixed(2)} points over the same ${judgedTrades} trades. It refused ${refused.length} of them, and the ones it refused were worth ${percent(refusedReturn)} between them.`
    : `The gate cost ${Math.abs(ungated - gated).toFixed(2)} points over the same ${judgedTrades} trades: ${percent(gated)} gated against ${percent(ungated)} always on. Turning strategies off in the weeks it did not like them left money on the table, which is the honest result and the one worth showing.`);
  lines.push('Each trade is gated by the call made at the end of the week before its entry. Gating a trade by its own week’s call would let an answer that saw Friday decide on Monday’s entry, and it flatters the gate.');

  const right = calls.filter((call) => call.agree).length;
  if (calls.length) lines.push(`${calls.length} weekly calls had a trade to decide on the week after, and the price agreed with ${right} of them. Refusing nearly everything is right whenever the trade loses, so read this beside “never let anything trade” in the alternatives.`);

  const unjudged = runs.flatMap((run) => run.unjudged);
  if (unjudged.length) lines.push(`${unjudged.length} trades were entered before any week had been judged. They are left out of both runs rather than counted as refused.`);

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

const PRESENT = {
  number: 183,
  problem: {
    headline: 'Same rules, same bars, same costs. One switch: may this strategy trade next week.',
    stat: '312',
    statLabel: 'weeks judged across four instruments',
  },
  hero: {
    item: 'RG-0005',
    caption: 'GLD, week to 4 April 2025. Called event driven, mean reversion allowed at half size. The pullback entered the next Monday made +13.56%.',
  },
  answers: {
    caption: 'Five answers from bars that stop at the week’s last session. The fit and the size are the gate, and they apply to the week after.',
    reveal: ['regime', 'regime_clarity', 'strategy_fit', 'risk_scaling', 'regime_changing'],
  },
  miss: {
    item: 'RG-0165',
    caption: 'GLD, week to 9 January 2026. Called trend up, trend following only. The twenty-day range break entered on the Monday was refused and went on to make +12.66%.',
  },
  proof: {
    kpis: ['Gate calls the price agreed with', 'Strategies always on', 'Strategies gated by the regime call'],
    chart: 'baselines',
    closing: 'Gated +2.93% against +82.08% always on. It refused 66 of 75 trades, and breakout was named in 2 weeks of 312.',
  },
};

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
  caveat: 'Seventy-five judged trades, nine of them allowed, is too few to tell a good gate from a lucky one, and the book is lopsided: the range break makes 73 per cent of the trades and its family was named in 2 of 312 weeks.',
  grade: { judge },
  verdict,
  present: PRESENT,
  explain: {
    data: 'src/strategies/index.js#strategy:rules',
    state: 'demos/regime-classification/demo.js#demo:state',
    questions: 'demos/regime-classification/demo.js#demo:questions',
    evaluate: 'demos/regime-classification/demo.js#demo:evaluate',
  },
};
