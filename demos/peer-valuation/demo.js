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
const METRIC_NAMES = { priceToEarnings: 'P/E', priceToBook: 'P/B', priceToFreeCashFlow: 'P/FCF' };

/** The cheapest peer on each multiple. One name only counts as cheapest if it wins more multiples than any other. */
function computedSet(item) {
  const peers = item.peers.map((peer) => ({ symbol: peer.symbol, ...valuationMultiples(peer) }));
  const cheapest = Object.fromEntries(METRICS.map((metric) => {
    const valid = peers.filter((peer) => Number.isFinite(peer[metric]) && peer[metric] > 0).sort((a, b) => a[metric] - b[metric]);
    return [metric, valid[0]?.symbol ?? null];
  }));
  const votes = new Map();
  for (const symbol of Object.values(cheapest)) if (symbol) votes.set(symbol, (votes.get(symbol) ?? 0) + 1);
  const most = Math.max(0, ...votes.values());
  const leaders = [...votes.entries()].filter(([, count]) => count === most).map(([symbol]) => symbol);
  // A one-vote-each split used to be settled by member order, which named CVX cheapest on the highest P/E in its set.
  return { peers, cheapest, computedBest: leaders.length === 1 ? leaders[0] : null, tied: leaders.length > 1 ? leaders : [] };
}

const cheapestText = (computed) => computed.computedBest ?? (computed.tied.length ? `Tie: ${computed.tied.join(', ')}` : 'No computable peer');

// #region demo:report
function report(results, context = {}) {
  const sets = results.map((result) => ({ result, computed: computedSet(result.item) }));
  return {
    note: `All multiples, margins and growth rates are report-only calculations; Jev received prices, shares and raw statements. Revenue change is the total over the four years on file, not a yearly rate. ${context.note ?? ''}`,
    findings: findings(sets),
    kpis: kpis(sets),
    baselines: baselines(sets),
    metrics: metrics(sets),
    peerSets: sets.map(peerSetRow),
    checks: checks(sets),
    topItems: sets.map(({ result, computed }) => ({ id: result.item.id, label: `${result.item.name} · Jev ${result.evaluation.bestValue} · cheapest ${cheapestText(computed)}`, value: comparabilityText(result) })),
    topItemsTitle: 'The four peer sets',
  };
}
// #endregion

/** The share of the probability the pick itself holds. */
const pickWeight = (result) => result.answers.best_value.probabilities?.[result.evaluation.bestValue] ?? result.answers.best_value.confidence;

const withClearCheapest = (sets) => sets.filter((row) => row.computed.computedBest);
const pickedCheapest = (row) => row.result.evaluation.bestValue === row.computed.computedBest;
const calledLoose = (result) => !result.evaluation.comparable;
const matchesDesign = ({ result }) => calledLoose(result) === Boolean(result.item.loose);

function comparabilityText(result) {
  if (result.item.loose) return calledLoose(result) ? 'Loose by design, rejected' : 'Loose by design, accepted';
  return calledLoose(result) ? 'Sound set, rejected' : 'Sound set, accepted';
}

function peerSetRow({ result, computed }) {
  return {
    id: result.item.id, name: result.item.name, loose: result.item.loose, modelPick: result.evaluation.bestValue, computedBest: cheapestText(computed),
    cheapestPe: computed.cheapest.priceToEarnings, cheapestPb: computed.cheapest.priceToBook, cheapestPfcf: computed.cheapest.priceToFreeCashFlow,
    comparable: result.evaluation.comparable, premiumJustified: result.evaluation.premiumJustified, discountReason: title(result.evaluation.discountReason),
    peers: computed.peers.map((peer) => ({ symbol: peer.symbol, pe: peer.priceToEarnings, pb: peer.priceToBook, pfcf: peer.priceToFreeCashFlow, evFcf: peer.evToFreeCashFlow, margin: peer.operatingMarginPercent, growth: peer.revenueGrowthPercent })),
  };
}

function kpis(sets) {
  const clear = withClearCheapest(sets);
  const agreements = clear.filter(pickedCheapest);
  const valid = sets.filter((row) => row.result.evaluation.validPick);
  const designed = sets.filter(matchesDesign);
  const rejected = sets.filter((row) => calledLoose(row.result));
  const looseCaught = rejected.filter((row) => row.result.item.loose);
  const soundRejected = rejected.length - looseCaught.length;
  const meanConfidence = sets.reduce((sum, row) => sum + row.result.evaluation.confidence, 0) / sets.length;
  const meanPick = sets.reduce((sum, row) => sum + pickWeight(row.result), 0) / sets.length;
  return [
    { label: 'Cheapest-peer agreement', value: `${agreements.length} of ${clear.length}`, context: `only ${clear.length} of ${sets.length} sets have one peer cheapest on most multiples, the rest are ties; cheapest is a reference point, not the right answer` },
    { label: 'Comparability calls that match the design', value: `${designed.length} of ${sets.length}`, context: `${looseCaught.length} loose set rejected and ${soundRejected} sound sets rejected with it`, tone: designed.length === sets.length ? 'good' : 'warn' },
    { label: 'Loose set rejected', value: looseCaught.length ? 'Yes' : 'No', context: `energy mixes producers with oilfield services by design; ${rejected.length} of ${sets.length} sets were rejected in all`, tone: looseCaught.length && !soundRejected ? 'good' : 'warn' },
    { label: 'Picks inside set', value: `${valid.length} of ${sets.length}`, context: 'an instruction followed rather than a judgement; invalid cross-set choices stay visible', tone: valid.length === sets.length ? 'good' : 'warn' },
    { label: 'Average confidence', value: `${meanConfidence.toFixed(1)} / 6`, context: `model confidence in its own rankings; the pick itself holds ${Math.round(meanPick * 100)}% of the probability on average` },
  ];
}

/** Rule: pick the lowest price to earnings. Where one peer is cheapest on most multiples this finds it by construction. */
function lowestPe(computed) {
  return computed.cheapest.priceToEarnings;
}

function baselines(sets) {
  const clear = withClearCheapest(sets);
  if (!clear.length) return undefined;
  const row = (count) => ({ value: count / clear.length, display: `${count} of ${clear.length}` });
  return [
    { label: 'Jev', detail: 'picked the peer that is cheapest on most multiples', model: true, ...row(clear.filter(pickedCheapest).length) },
    { label: 'Rule: lowest price to earnings', detail: 'cheapest almost by construction; whether cheapest is best value is the judgement nothing here can grade', ...row(clear.filter((entry) => lowestPe(entry.computed) === entry.computed.computedBest).length) },
  ];
}

function metrics(sets) {
  const clear = withClearCheapest(sets);
  return {
    headline: { label: 'Cheapest-peer agreement', value: clear.length ? clear.filter(pickedCheapest).length / clear.length : 0, n: clear.length },
    comparabilityAccuracy: sets.length ? sets.filter(matchesDesign).length / sets.length : null,
  };
}

function checks(sets) {
  const differ = withClearCheapest(sets).filter((row) => !pickedCheapest(row));
  const tied = sets.filter((row) => !row.computed.computedBest);
  const rejected = sets.filter((row) => calledLoose(row.result));
  const soundRejected = rejected.filter((row) => !row.result.item.loose);
  const ids = (list) => list.map((row) => row.result.item.id);
  return [
    { id: 'pick', label: 'Picks differing from the clear cheapest peer', detail: 'Differences are not automatically errors; the reasoning stays alongside raw multiples.', count: differ.length, of: sets.length - tied.length, items: ids(differ) },
    { id: 'tied', label: 'Sets with no clear cheapest peer', detail: 'Each multiple names a different peer, so there is nothing to compare the pick with.', count: tied.length, of: sets.length, items: ids(tied) },
    { id: 'comparable', label: 'Sets called not comparable', detail: 'The energy operators set is deliberately loose.', count: rejected.length, of: sets.length, items: ids(rejected) },
    { id: 'sound-rejected', label: 'Sound sets called not comparable', detail: 'Sets built from companies in one line of business.', count: soundRejected.length, of: sets.filter((row) => !row.result.item.loose).length, items: ids(soundRejected) },
  ];
}

function findings(sets) {
  const lines = [];
  for (const row of sets) {
    const { result, computed } = row;
    if (computed.computedBest && !pickedCheapest(row)) {
      lines.push(`${result.item.name}: Jev chose ${result.evaluation.bestValue}; the plurality of raw P/E, P/B and P/FCF minima points to ${computed.computedBest}. Jev’s reason was ${title(result.evaluation.discountReason)}.`);
    }
    if (!computed.computedBest) {
      const minima = METRICS.filter((metric) => computed.cheapest[metric]).map((metric) => `${METRIC_NAMES[metric]} ${computed.cheapest[metric]}`);
      lines.push(`${result.item.name}: no clear cheapest peer (${minima.join(', ') || 'no computable multiple'}), so Jev’s pick of ${result.evaluation.bestValue} is not compared with anything.`);
    }
  }
  const rejected = sets.filter((row) => calledLoose(row.result));
  const soundRejected = rejected.filter((row) => !row.result.item.loose);
  if (soundRejected.length) lines.push(`${rejected.length} of ${sets.length} sets were called not comparable. One was built to be loose; ${soundRejected.map((row) => row.result.item.name).join(' and ')} were not, so the refusal is not telling the designed trap from a sound set.`);
  lines.push(`${sets.length} peer sets is an illustration. Every figure here is a count out of ${sets.length} or fewer, and none of them is a rate.`);
  return lines;
}

const asPercent = (number) => `${Math.round(number * 100)}%`;
const yesNo = (number) => (number >= 0.5 ? `Yes · ${asPercent(number)}` : `No · ${asPercent(1 - number)}`);
const times = (number) => (Number.isFinite(number) ? `${number.toFixed(1)}×` : 'n/a');

/** The pick with the runners-up, because 39% against 26% is a lean and not a verdict. */
function pickSpread(result) {
  const probabilities = result.answers.best_value.probabilities ?? {};
  return result.item.members
    .map((symbol) => ({ symbol, weight: probabilities[symbol] ?? 0 }))
    .filter((entry) => entry.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map((entry) => `${entry.symbol} ${asPercent(entry.weight)}`)
    .join(', ');
}

function cheapestFact(result, computed) {
  if (!computed.computedBest) {
    const minima = METRICS.filter((metric) => computed.cheapest[metric]).map((metric) => `${METRIC_NAMES[metric]} ${computed.cheapest[metric]}`);
    return { label: 'Cheapest on the multiples', value: `No clear cheapest · ${minima.join(', ')}` };
  }
  const wins = METRICS.filter((metric) => computed.cheapest[metric] === computed.computedBest).length;
  return { label: 'Cheapest on the multiples', value: `${computed.computedBest} · on ${wins} of ${METRICS.length}`, tone: pickedCheapest({ result, computed }) ? 'good' : 'warn' };
}

function verdict(result) {
  const { item, answers, evaluation } = result;
  const computed = computedSet(item);
  const picked = computed.peers.find((peer) => peer.symbol === evaluation.bestValue);
  const weakView = evaluation.confidence < 3;
  return {
    eyebrow: item.name,
    headline: `Best value: ${evaluation.bestValue} · ${asPercent(pickWeight(result))}`,
    detail: weakView ? 'A weak view: the ranking confidence is under 3 of 6 and the runners-up are close behind.' : undefined,
    facts: [
      { label: 'The pick and the runners-up', value: pickSpread(result) || evaluation.bestValue, tone: evaluation.validPick ? undefined : 'bad' },
      cheapestFact(result, computed),
      { label: 'The pick’s multiples, computed here', value: picked ? `P/E ${times(picked.priceToEarnings)} · P/B ${times(picked.priceToBook)} · P/FCF ${times(picked.priceToFreeCashFlow)}` : 'Not in this set' },
      { label: 'Set comparable', value: `${yesNo(answers.comparable_set.noul)} · ${item.loose ? 'loose by design' : 'built as a sound set'}`, tone: matchesDesign({ result }) ? 'good' : 'warn' },
      { label: 'Premium earned', value: yesNo(answers.premium_justified.noul) },
      { label: 'Confidence in the ranking', value: `${answers.confidence_in_ranking.legend?.[Math.round(evaluation.confidence)] ?? 'Score'} · ${evaluation.confidence.toFixed(1)} of 6`, tone: weakView ? 'warn' : undefined },
    ],
  };
}

const present = {
  number: 166,
  problem: {
    headline: 'Cheapest on a multiple is not the same as best value, and some peer groups should not be ranked at all.',
    stat: '4',
    statLabel: 'peer sets, 17 companies, one built to be loose',
  },
  hero: {
    item: 'PV-TECH',
    caption: 'GOOGL is cheapest on all three multiples: 15.5 times earnings against 44.7 for NVDA. The model picked it, at 39%, with NVDA at 26% behind it.',
  },
  answers: {
    caption: 'A pick, whether the premium name earns its price, why the cheap one is cheap, and whether the set can be ranked. No multiple was sent.',
    reveal: ['best_value', 'premium_justified', 'comparable_set', 'confidence_in_ranking'],
  },
  miss: {
    item: 'PV-STAPLES',
    caption: 'WMT picked at 38.7 times earnings on a 4.2% operating margin, over PG at 21.2 times and cheapest on all three multiples. The set was also called not comparable.',
  },
  proof: {
    kpis: ['Cheapest-peer agreement', 'Comparability calls that match the design', 'Average confidence'],
    chart: 'baselines',
    closing: '1 designed trap caught and 2 sound sets refused with it: 2 of 4 comparability calls match the design.',
  },
};

export default {
  id: 'peer-valuation', title: 'Peer valuation', domain: 'screening',
  value: 'Choose what is actually cheap inside a peer group and show when a premium or discount has fundamental support.',
  tags: ['screening', 'valuation', 'peers', 'fundamentals'], dataClass: 'cached-real', readMinutes: 5, view: 'peerGrid',
  itemLabel: (item) => `${item.name} · ${item.members.join(' · ')}`,
  caveat: 'Four peer sets is an illustration, not a test: every figure is a count out of four or fewer, and nothing here can say whether a pick was good value.',
  verdict, present,
  data: () => import('./data.json'), fixtures: () => import('./fixtures.json'), buildState, questions, evaluate, report,
  explain: { data: 'src/services/ratios.js#demo:valuation-data', state: 'demos/peer-valuation/demo.js#demo:state', questions: 'demos/peer-valuation/demo.js#demo:questions', evaluate: 'demos/peer-valuation/demo.js#demo:evaluate' },
};
