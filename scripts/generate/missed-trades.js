// Reproducible rule hits over three years of cached-real prices, paired with a synthetic taken-trade
// log. Forward bars are reduced into labels and never copied into a model-visible item.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { candles, MARKET_NOTE } from './lib/market.js';
import { qualifyingPullbacks } from '../../demos/missed-trades/rule.js';

export const SEED = 1156;
const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'PEP', 'PG', 'JNJ', 'WMT'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const setups = SYMBOLS.flatMap((symbol) => setupsFor(symbol));
  setups.sort((left, right) => left.date.localeCompare(right.date) || left.symbol.localeCompare(right.symbol));
  setups.forEach((setup, index) => { setup.id = `MT-${String(index + 1).padStart(3, '0')}`; });
  plantAccountContext(setups, random);
  const reasons = goodSkipReasons(setups);
  const ordinary = setups.filter((setup) => !reasons.has(setup.id));
  const missed = new Set([...ordinary].sort((left, right) => right.skipPropensity - left.skipPropensity).slice(0, 100).map((setup) => setup.id));
  const labels = [];
  for (const setup of setups) {
    const goodReason = reasons.get(setup.id) ?? null;
    const taken = !goodReason && !missed.has(setup.id);
    setup.tradeLog = { setupWasTaken: taken, entryRecordedAt: taken ? `${setup.date}T09:35:00-05:00` : null };
    const outcomeUsd = round(setup.assumedSizeUsd * setup.forwardReturnPercent / 100);
    labels.push({ setupId: setup.id, taken, goodReasonToSkip: Boolean(goodReason), goodReason, forwardReturnPercent: setup.forwardReturnPercent, outcomeUsd, outcomeDate: setup.outcomeDate });
    delete setup.forwardReturnPercent;
    delete setup.outcomeDate;
    delete setup.skipPropensity;
  }
  return {
    dataset: {
      id: 'missed-trades', class: 'mixed', generatedAt: '2026-09-19', seed,
      source: 'scripts/generate/missed-trades.js',
      context: {
        note: MARKET_NOTE,
        rule: 'Long pullback: rising 20-day average, setup low touches within 1%, close holds no more than 3% below it, and prior 20-day average range is 0.5% to 5%. The twenty closest qualifying pulls per symbol are audited.',
        riskPolicy: 'Do not add a setup when open risk is already 2.0% of equity. A known next-day earnings event is a valid skip. A mechanically qualifying bar with a gap above 2.5% may be skipped until the written rule clarifies gaps.',
        outcomePolicy: 'Report outcome is the real close-to-close return from the setup bar through ten trading sessions, applied to the visible assumed size. Positive missed outcomes are opportunity cost; justified skips are excluded.',
      },
      items: setups,
    },
    labels,
  };
}

function setupsFor(symbol) {
  const source = candles(symbol).bars.slice(-756);
  return qualifyingPullbacks(source, 20).map((candidate) => {
    const bar = source[candidate.index];
    const previous = source[candidate.index - 1];
    const outcome = source[candidate.index + 10];
    return {
      id: null, symbol, date: bar.date, weekday: WEEKDAYS[new Date(`${bar.date}T12:00:00Z`).getUTCDay()], direction: 'LONG',
      assumedSizeUsd: 10_000, setupClose: bar.close, movingAverage20: round(candidate.average, 2), averageRangePercent: round(candidate.rangePercent, 2),
      gapPercent: round((bar.open - previous.close) / previous.close * 100, 2), conditions: candidate.conditions,
      chart: { markIndex: 34, label: `${symbol} through qualifying setup ${bar.date}`, bars: source.slice(candidate.index - 34, candidate.index + 1).map(encodeBar) },
      forwardReturnPercent: round((outcome.close - bar.close) / bar.close * 100, 2), outcomeDate: outcome.date,
    };
  });
}

function plantAccountContext(setups, random) {
  for (const setup of setups) {
    const afterLosses = random.bool(setup.weekday === 'Monday' ? 0.58 : 0.32);
    const recent = afterLosses
      ? [-random.int(90, 360), -random.int(60, 280), random.int(-80, 90)]
      : [random.int(-160, 260), random.int(-120, 280), random.int(-100, 300)];
    setup.account = {
      equityUsd: 100_000, openRiskPercent: round(random.float(0.2, 1.65), 2), maximumOpenRiskPercent: 2,
      tradesToday: random.int(0, 3), lastThreeClosedResultsUsd: recent, recentState: afterLosses ? 'AFTER_LOSSES' : 'NORMAL',
    };
    setup.calendar = { earningsNextTradingDay: false, holidayNextTradingDay: random.bool(0.03) };
    setup.skipPropensity = (setup.weekday === 'Monday' ? 4 : 0) + (afterLosses ? 3 : 0) + random.next();
  }
}

function goodSkipReasons(setups) {
  const reasons = new Map();
  const unused = () => setups.filter((setup) => !reasons.has(setup.id));
  for (const setup of [...setups].sort((left, right) => Math.abs(right.gapPercent) - Math.abs(left.gapPercent)).slice(0, 10)) reasons.set(setup.id, 'GAP_RULE_SPIRIT');
  for (const setup of unused().filter((entry) => entry.weekday !== 'Friday').slice(0, 10)) { setup.calendar.earningsNextTradingDay = true; reasons.set(setup.id, 'EARNINGS_NEXT_DAY'); }
  for (const setup of unused().slice(-10)) { setup.account.openRiskPercent = 2; reasons.set(setup.id, 'RISK_LIMIT_USED'); }
  return reasons;
}

const encodeBar = (bar) => `${bar.date} ${bar.open} ${bar.high} ${bar.low} ${bar.close} ${bar.volume ?? 0}`;
