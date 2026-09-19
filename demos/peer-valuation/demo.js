import { choice, noul, score } from '../lib/questions.js';
import { valuationMultiples } from '../../src/services/ratios.js';

const SYMBOLS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'JPM', 'BAC', 'WFC', 'C', 'XOM', 'CVX', 'COP', 'SLB', 'KO', 'PG', 'JNJ', 'WMT', 'PEP'];
const REASONS = ['GOVERNANCE', 'GROWTH', 'CYCLICAL_TROUGH', 'BALANCE_SHEET', 'NO_DISCOUNT'];
const title = (value) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const display = (value) => Number.isFinite(value) ? value.toFixed(2) : '–';

// #region demo:state
function buildState(item, context) {
  return {
    task: 'Choose the best value only from peer_set_members by reading prices and raw statements. Decide whether the most expensive peer earns its premium, explain any discount, and reject the set if its members are not genuinely comparable.',
    source_note: context.note, units_and_nulls: context.units, coverage_note: context.coverage,
    peer_set: { id: item.id, name: item.name, note: item.note },
    peer_set_members: item.members,
    peers: item.peers.map((peer) => ({ symbol: peer.symbol, sector: peer.sector, industry: peer.industry, currency: peer.currency, price: peer.price, price_date: peer.priceDate, shares_outstanding: peer.sharesOutstanding, annual_statements_oldest_to_newest: peer.annualStatements })),
  };
}
// #endregion

// #region demo:questions
const questions = {
  best_value: choice('Which supplied peer offers the best value after considering price, statements, quality and comparability? Choose only a symbol present in peer_set_members.', Object.fromEntries(SYMBOLS.map((symbol) => [symbol, symbol]))),
  premium_justified: noul('Does the most expensive operating peer earn its premium through growth, margin or balance-sheet quality?', { yes: 'The premium is supported by stronger fundamentals.', no: 'The premium is not supported by the supplied fundamentals.' }),
  discount_reason: choice('What best explains the discount of the cheapest credible operating peer?', Object.fromEntries(REASONS.map((key) => [key, title(key)]))),
  confidence_in_ranking: score('How confident are you in this peer ranking?', ['None', 'Very low', 'Low', 'Moderate', 'High', 'Very high', 'Certain']),
  comparable_set: noul('Are the supplied members genuinely comparable enough for a relative valuation?', { yes: 'Business models and accounting are sufficiently comparable.', no: 'The set mixes structures that make a ranking misleading.' }),
};
// #endregion

// #region demo:evaluate
function evaluate(answers, item) {
  return {
    bestValue: answers.best_value.choice, premiumJustified: answers.premium_justified.noul >= 0.5,
    discountReason: answers.discount_reason.choice, confidence: answers.confidence_in_ranking.score,
    comparable: answers.comparable_set.noul >= 0.5,
    validPick: item.members.includes(answers.best_value.choice),
    label: `${item.name} · ${answers.best_value.choice} · ${answers.confidence_in_ranking.score.toFixed(1)}/6 confidence`,
  };
}
// #endregion

const METRICS = ['priceToEarnings', 'priceToBook', 'priceToFreeCashFlow'];
function computedSet(item) {
  const peers = item.peers.map((peer) => ({ symbol: peer.symbol, ...valuationMultiples(peer) }));
  const cheapest = Object.fromEntries(METRICS.map((metric) => {
    const valid = peers.filter((peer) => Number.isFinite(peer[metric]) && peer[metric] > 0).sort((a, b) => a[metric] - b[metric]);
    return [metric, valid[0]?.symbol ?? null];
  }));
  const votes = Object.values(cheapest).reduce((map, symbol) => symbol ? map.set(symbol, (map.get(symbol) ?? 0) + 1) : map, new Map());
  const computedBest = [...votes.entries()].sort((a, b) => b[1] - a[1] || item.members.indexOf(a[0]) - item.members.indexOf(b[0]))[0]?.[0] ?? null;
  return { peers, cheapest, computedBest };
}

// #region demo:report
function report(results, context = {}) {
  const sets = results.map((result) => ({ result, computed: computedSet(result.item) }));
  const valid = sets.filter((row) => row.result.evaluation.validPick);
  const agreements = sets.filter((row) => row.result.evaluation.bestValue === row.computed.computedBest);
  const looseCalled = sets.filter((row) => row.result.item.loose && !row.result.evaluation.comparable);
  return {
    note: `All multiples, margins and growth rates are report-only calculations; Jev received prices, shares and raw statements. ${context.note ?? ''}`,
    findings: sets.filter((row) => row.result.evaluation.bestValue !== row.computed.computedBest).map((row) => `${row.result.item.name}: Jev chose ${row.result.evaluation.bestValue}; the plurality of raw P/E, P/B and P/FCF minima points to ${row.computed.computedBest ?? 'no computable peer'}. Jev’s reason was ${title(row.result.evaluation.discountReason)}.`),
    kpis: [
      { label: 'Picks inside set', value: `${valid.length} of ${sets.length}`, context: 'invalid cross-set choices stay visible', tone: valid.length === sets.length ? 'good' : 'warn' },
      { label: 'Plurality-cheapest agreement', value: `${agreements.length} of ${sets.length}`, context: 'Jev pick against three raw-multiple minima' },
      { label: 'Loose set rejected', value: looseCalled.length ? 'Yes' : 'No', context: 'energy mixes producers with oilfield services by design', tone: looseCalled.length ? 'good' : 'warn' },
      { label: 'Average confidence', value: `${(sets.reduce((sum, row) => sum + row.result.evaluation.confidence, 0) / sets.length).toFixed(1)} / 6`, context: 'model confidence in its own rankings' },
    ],
    peerSets: sets.map(({ result, computed }) => ({
      id: result.item.id, name: result.item.name, loose: result.item.loose, modelPick: result.evaluation.bestValue, computedBest: computed.computedBest,
      cheapestPe: computed.cheapest.priceToEarnings, cheapestPb: computed.cheapest.priceToBook, cheapestPfcf: computed.cheapest.priceToFreeCashFlow,
      comparable: result.evaluation.comparable, premiumJustified: result.evaluation.premiumJustified, discountReason: title(result.evaluation.discountReason),
      peers: computed.peers.map((peer) => ({ symbol: peer.symbol, pe: peer.priceToEarnings, pb: peer.priceToBook, pfcf: peer.priceToFreeCashFlow, evFcf: peer.evToFreeCashFlow, margin: peer.operatingMarginPercent, growth: peer.revenueGrowthPercent })),
    })),
    checks: [
      { id: 'pick', label: 'Picks differing from multiple plurality', detail: 'Differences are not automatically errors; the reasoning stays alongside raw multiples.', count: sets.length - agreements.length, of: sets.length, items: sets.filter((row) => row.result.evaluation.bestValue !== row.computed.computedBest).map((row) => row.result.item.id) },
      { id: 'comparable', label: 'Sets called not comparable', detail: 'The energy operators set is deliberately loose.', count: sets.filter((row) => !row.result.evaluation.comparable).length, of: sets.length, items: sets.filter((row) => !row.result.evaluation.comparable).map((row) => row.result.item.id) },
    ],
    topItems: sets.map(({ result, computed }) => ({ id: result.item.id, label: `${result.item.name} · Jev ${result.evaluation.bestValue} · computed ${computed.computedBest ?? 'n/a'}`, value: result.evaluation.comparable ? 'Comparable' : 'Loose set' })),
  };
}
// #endregion

export default {
  id: 'peer-valuation', title: 'Peer valuation', domain: 'screening',
  value: 'Choose what is actually cheap inside a peer group and show when a premium or discount has fundamental support.',
  tags: ['screening', 'valuation', 'peers', 'fundamentals'], dataClass: 'cached-real', readMinutes: 5, view: 'peerGrid', status: 'pending-recording',
  itemLabel: (item) => `${item.name} · ${item.members.join(' · ')}`,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  explain: { data: 'src/services/ratios.js#demo:valuation-data', state: 'demos/peer-valuation/demo.js#demo:state', questions: 'demos/peer-valuation/demo.js#demo:questions', evaluate: 'demos/peer-valuation/demo.js#demo:evaluate' },
};
