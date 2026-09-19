import { candles, MARKET_NOTE } from './lib/market.js';
import { movingAveragePullbacks } from '../../src/strategies/pullback.js';
import { rangeBreaks } from '../../src/strategies/range-break.js';

const SYMBOLS = ['NVDA', 'JPM', 'SPY', 'BTC-USD'];
const TARGET = 480;
const SETUPS = [{ id: 'PULLBACK', detect: movingAveragePullbacks }, { id: 'RANGE_BREAK', detect: rangeBreaks }];
const round = (value, digits = 3) => Number(value.toFixed(digits));

export function generate() {
  const candidates = [];
  for (const symbol of SYMBOLS) {
    const source = candles(symbol);
    for (const setup of SETUPS) {
      for (const signal of setup.detect(source.bars)) {
        if (signal.index + 8 >= source.bars.length) continue;
        candidates.push(buildCandidate(source, setup.id, signal));
      }
    }
  }
  const buckets = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.symbol}:${candidate.setup}:${candidate.direction}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(candidate);
  }
  const selected = [];
  for (let roundIndex = 0; selected.length < TARGET; roundIndex++) {
    let added = false;
    for (const bucket of buckets.values()) {
      if (bucket[roundIndex]) { selected.push(bucket[roundIndex]); added = true; if (selected.length === TARGET) break; }
    }
    if (!added) break;
  }
  selected.sort((a, b) => a.setupDate.localeCompare(b.setupDate) || a.symbol.localeCompare(b.symbol));
  selected.forEach((item, index) => { item.id = `ST-${String(index + 1).padStart(4, '0')}`; });
  return {
    dataset: {
      id: 'setup-timing', class: 'cached-real', generatedAt: '2026-09-19', source: 'data/market/candles/{NVDA,JPM,SPY,BTC-USD}.json',
      context: { note: MARKET_NOTE, timeframe: 'Daily candles only. Intraday or time-of-day timing is out of scope.', coverage: 'The committed cache spans 2020-09 through 2026-09. Each model state includes the sixty bars through the setup and never a forward bar.', candidateCount: candidates.length },
      items: selected,
    },
  };
}

function buildCandidate(source, setup, signal) {
  const bars = source.bars;
  const bar = bars[signal.index];
  const directionSign = signal.direction === 'LONG' ? 1 : -1;
  const signedReturn = (ahead) => round((bars[signal.index + ahead].close / bar.close - 1) * 100 * directionSign);
  const returns = { 1: signedReturn(1), 3: signedReturn(3), 5: signedReturn(5), 8: signedReturn(8) };
  const holds = [['ONE_BAR', 1], ['TWO_TO_THREE', 3], ['FOUR_TO_FIVE', 5], ['SIX_TO_EIGHT', 8]];
  const bestHold = [...holds].sort((a, b) => returns[b[1]] - returns[a[1]])[0][0];
  const date = new Date(`${bar.date}T00:00:00Z`);
  const monthDay = date.getUTCDate();
  const monthPhase = monthDay <= 10 ? 'START' : monthDay <= 20 ? 'MIDDLE' : 'END';
  const weekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getUTCDay()];
  let lastGap = null;
  for (let index = signal.index; index > 0; index--) if (Math.abs(bars[index].open / bars[index - 1].close - 1) >= 0.03) { lastGap = index; break; }
  const history = bars.slice(0, signal.index + 1);
  const sameSlotReturns = history.slice(1).filter((entry) => {
    const current = new Date(`${entry.date}T00:00:00Z`);
    const phase = current.getUTCDate() <= 10 ? 'START' : current.getUTCDate() <= 20 ? 'MIDDLE' : 'END';
    return current.getUTCDay() === date.getUTCDay() && phase === monthPhase;
  }).map((entry) => { const index = history.indexOf(entry); return (entry.close / history[index - 1].close - 1) * 100; });
  return {
    id: 'pending', symbol: source.symbol, currency: source.currency, setup, direction: signal.direction, setupDate: bar.date,
    conditions: signal.conditions,
    calendar: { weekday, monthPhase, daysSinceLastLargeGap: lastGap === null ? null : signal.index - lastGap },
    typicalPastSlotReturnPercent: sameSlotReturns.length ? round(sameSlotReturns.reduce((sum, value) => sum + value, 0) / sameSlotReturns.length) : null,
    candleWindowThroughSetup: bars.slice(Math.max(0, signal.index - 59), signal.index + 1),
    outcome: { signedReturnsPercent: returns, bestHold, realisedFiveBarReturnPercent: returns[5] },
  };
}
