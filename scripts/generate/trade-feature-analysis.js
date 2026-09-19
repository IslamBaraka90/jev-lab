// Three hundred synthetic trade decisions over cached-real entry candles. Outcomes are planted from
// two visible entry features with noise; weekday, round-number price and symbol are controls.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { candles, MARKET_NOTE } from './lib/market.js';

export const SEED = 1152;
const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'PEP', 'PG', 'JNJ', 'WMT'];
const SETUPS = ['BREAKOUT', 'PULLBACK', 'REVERSAL', 'RANGE_FADE'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  for (const symbol of SYMBOLS) {
    const source = candles(symbol).bars;
    for (let sample = 0; sample < 25; sample++) {
      const index = 45 + Math.floor((sample / 24) * (source.length - 50));
      const history = source.slice(index - 34, index + 1);
      const entry = history.at(-1);
      const ma = history.slice(-20).reduce((sum, bar) => sum + bar.close, 0) / 20;
      const distancePercent = round(Math.abs(entry.close - ma) / ma * 100, 2);
      const extended = distancePercent >= 1.5;
      const range = Math.max(entry.high - entry.low, 0.0001);
      const closeLocation = round((entry.close - entry.low) / range, 3);
      const topThirdClose = closeLocation >= 2 / 3;
      const roundNumber = Math.abs(entry.close - Math.round(entry.close)) <= 0.08;
      const edgeScore = (topThirdClose ? 2 : 0) + (extended ? 0 : 2) + random.next();
      const id = `TF-${String(items.length + 1).padStart(3, '0')}`;
      const setupType = SETUPS[items.length % SETUPS.length];
      const averageVolume = history.slice(-20).reduce((sum, bar) => sum + (bar.volume || 0), 0) / 20;
      const prior = history.at(-2);
      const gapPercent = round((entry.open - prior.close) / prior.close * 100, 2);
      const context = Math.abs(gapPercent) >= 1.7 ? 'POST_GAP' : (entry.volume || 0) > averageVolume * 1.7 ? 'NEWS_DAY' : Math.abs(entry.close - ma) / ma > 0.008 ? 'TREND' : 'RANGE';
      items.push({
        id, symbol, setupType, entryDate: entry.date, entryPrice: entry.close,
        plannedStop: round(entry.close - range * 1.2, 2), plannedTarget: round(entry.close + range * 2, 2),
        recentRangePercent: round((Math.max(...history.slice(-10).map((bar) => bar.high)) - Math.min(...history.slice(-10).map((bar) => bar.low))) / entry.close * 100, 2),
        entryVolumeVsAverage: round((entry.volume || 0) / Math.max(averageVolume, 1), 2),
        movingAverage20: round(ma, 2), entryDistanceFromMaPercent: distancePercent,
        entryBarCloseLocation: closeLocation, gapPercent, dayOfWeek: DAYS[new Date(`${entry.date}T12:00:00Z`).getUTCDay()], roundNumber,
        contextEvidence: context,
        chart: { bars: history.map(encodeBar), markIndex: history.length - 1, label: `${symbol} through entry ${entry.date}`, trade: { side: 'long', entryPrice: entry.close, stopPrice: round(entry.close - range * 1.2, 2), targetPrice: round(entry.close + range * 2, 2) } },
      });
      labels.push({ tradeId: id, outcome: null, plantedEdgeFeature: 'ENTRY_DISTANCE_AND_TOP_THIRD', extendedEntry: extended, topThirdClose, edgeScore });
    }
  }
  assignOutcomes(items, labels);
  return {
    dataset: { id: 'trade-feature-analysis', class: 'mixed', generatedAt: '2026-09-19', seed, source: 'scripts/generate/trade-feature-analysis.js', context: { note: MARKET_NOTE, outcomeRule: 'Outcomes are synthetic and remain outside model state. They are planted with noise from entry distance to the 20-day average and entry-bar close location; weekday, round-number price and symbol are controls.' }, items },
    labels,
  };
}

/**
 * Rank only the two planted features, then take the strongest 44% inside every weekday. The
 * stratification makes weekday a genuine control instead of an accidental proxy for the dates on
 * which the two real features happened to occur; the twelve equal-size symbol panels are checked
 * below as a second control.
 */
function assignOutcomes(items, labels) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const cells = Map.groupBy(labels, (label) => itemById.get(label.tradeId).dayOfWeek);
  for (const cell of cells.values()) {
    const ranked = [...cell].sort((left, right) => right.edgeScore - left.edgeScore);
    const winners = Math.round(ranked.length * 0.44);
    ranked.forEach((label, index) => { label.outcome = index < winners ? 'WIN' : 'LOSS'; });
  }
  const symbolOf = (label) => itemById.get(label.tradeId).symbol;
  const dayOf = (label) => itemById.get(label.tradeId).dayOfWeek;
  const winnerCounts = () => new Map([...Map.groupBy(labels.filter((label) => label.outcome === 'WIN'), symbolOf)].map(([symbol, rows]) => [symbol, rows.length]));
  for (let pass = 0; pass < 100; pass++) {
    const counts = winnerCounts();
    const over = [...counts].filter(([, count]) => count > 11).map(([symbol]) => symbol);
    const under = SYMBOLS.filter((symbol) => (counts.get(symbol) ?? 0) < 11);
    if (!over.length || !under.length) break;
    const swaps = [];
    for (const from of over) for (const to of under) {
      for (const winner of labels.filter((label) => symbolOf(label) === from && label.outcome === 'WIN')) {
        for (const loser of labels.filter((label) => symbolOf(label) === to && label.outcome === 'LOSS' && dayOf(label) === dayOf(winner))) {
          swaps.push({ winner, loser, cost: winner.edgeScore - loser.edgeScore });
        }
      }
    }
    swaps.sort((left, right) => left.cost - right.cost);
    if (!swaps.length) break;
    swaps[0].winner.outcome = 'LOSS';
    swaps[0].loser.outcome = 'WIN';
  }
  labels.forEach((label) => { delete label.edgeScore; });
}

// #region demo:data
const encodeBar = (bar) => `${bar.date} ${bar.open} ${bar.high} ${bar.low} ${bar.close} ${bar.volume ?? 0}`;
// #endregion
