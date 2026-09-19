// Two hundred journal entries beside the trades they describe. Seventy-four of the notes drift from
// what the record says happened, in the five ways a trading journal drifts: the size, the entry, the
// exit, the instrument, and the plan that appeared afterwards. The other hundred and twenty-six are
// honest. Labels go to data/synthetic/journal-vs-reality.labels.json, outside the demo folder.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';

export const SEED = 1155;

const SYMBOLS = ['NVDA', 'MSFT', 'AAPL', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'WMT', 'GLD', 'SPY', 'XLE', 'PEP', 'JNJ'];
const SETUPS = ['breakout', 'pullback to the twenty', 'gap fill', 'range break', 'trend continuation', 'reversal at support'];

export const TRADER_RULES = [
  'Starter positions are a quarter of a full position. A full position is only taken after it moves in my favour.',
  'I do not chase. If the pullback does not come, I do not take the trade.',
  'Targets and stops are written before entry and I do not move them.',
  'The journal is written the same evening, before I know what the next day does.',
];

const HONEST = [
  'Took the {setup} at {entry}. Stop under the low at {stop}, target {target}. {size} position. Nothing clever, it just set up.',
  'Waited for the {setup}, filled {entry}. Sized {size} because the stop is wide. Out at {exit}, {result}.',
  '{setup} again. Same as last week, same levels. In {entry}, out {exit}. Boring is fine.',
  'Missed the first leg, took the {setup} at {entry} with a {size} position. Closed at {exit} when it stalled.',
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const items = [];
  const labels = [];
  const add = (item, drift) => { items.push(item); labels.push({ key: item.key, drift }); };

  for (let index = 0; index < 22; index++) add(entryFor(random, 'SIZE'), 'SIZE');
  for (let index = 0; index < 18; index++) add(entryFor(random, 'ENTRY'), 'ENTRY');
  for (let index = 0; index < 14; index++) add(entryFor(random, 'EXIT'), 'EXIT');
  for (let index = 0; index < 11; index++) add(entryFor(random, 'INSTRUMENT'), 'INSTRUMENT');
  for (let index = 0; index < 9; index++) add(entryFor(random, 'RATIONALISATION'), 'RATIONALISATION');
  for (let index = 0; index < 126; index++) add(entryFor(random, 'NONE'), 'NONE');

  items.sort((left, right) => left.tradeDate.localeCompare(right.tradeDate) || left.key.localeCompare(right.key));
  items.forEach((item, index) => {
    const id = `JR-${String(index + 1).padStart(4, '0')}`;
    labels.find((label) => label.key === item.key).entryId = id;
    item.id = id;
    delete item.key;
  });
  for (const label of labels) delete label.key;

  return {
    dataset: {
      id: 'journal-vs-reality',
      class: 'synthetic',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/journal-vs-reality.js',
      context: {
        trader: 'One trader, one year, one notebook',
        currency: 'USD',
        rules: TRADER_RULES,
        fullPositionUsd: 40_000,
        note: 'Invented trades and invented notes, written the way a journal is written: short, sometimes defensive, occasionally wrong about what happened.',
      },
      items,
    },
    labels,
  };
}

// #region demo:data
/** One journal entry: the note as written, and the record of what the fills actually did. */
function entryFor(random, drift) {
  const symbol = random.pick(SYMBOLS);
  const setup = random.pick(SETUPS);
  const entryPrice = round(random.float(24, 480), 2);
  const stop = round(entryPrice * random.float(0.955, 0.985), 2);
  const target = round(entryPrice * random.float(1.02, 1.07), 2);
  const full = 40_000;
  const size = drift === 'SIZE' ? full : random.pick([full * 0.25, full * 0.5, full]);
  const exit = exitFor(random, { drift, entryPrice, stop, target });
  const trade = {
    symbol,
    setup,
    tradeDate: `2026-${String(random.int(1, 8)).padStart(2, '0')}-${String(random.int(1, 28)).padStart(2, '0')}`,
    entryPrice,
    plannedStop: stop,
    plannedTarget: target,
    sizeUsd: size,
    sizeLabel: size === full ? 'full' : size === full / 2 ? 'half' : 'starter',
    exitPrice: exit.price,
    exitReason: exit.reason,
    resultPercent: round(((exit.price - entryPrice) / entryPrice) * 100, 2),
    filledAt: drift === 'ENTRY' ? 'the breakout, without waiting' : 'the level in the plan',
    noteWrittenAt: drift === 'RATIONALISATION' ? 'two days later' : 'the same evening',
  };

  return { key: `${symbol}-${trade.tradeDate}-${random.int(1_000, 9_999)}`, id: null, ...trade, note: noteFor(random, { drift, trade }) };
}
// #endregion

function exitFor(random, { drift, entryPrice, stop, target }) {
  if (drift === 'EXIT') return { price: round(entryPrice * random.float(1.002, 1.012), 2), reason: 'closed by hand well before the target' };
  return random.weighted([
    [{ price: target, reason: 'target hit' }, 40],
    [{ price: stop, reason: 'stop hit' }, 35],
    [{ price: round(entryPrice * random.float(0.99, 1.02), 2), reason: 'closed at the end of the day' }, 25],
  ]);
}

/** The note, in the trader's own voice — and, where it drifts, in the voice that drifts. */
function noteFor(random, { drift, trade }) {
  const fill = (template) => template
    .replace('{setup}', trade.setup)
    .replace('{entry}', trade.entryPrice)
    .replace('{stop}', trade.plannedStop)
    .replace('{target}', trade.plannedTarget)
    .replace('{exit}', trade.exitPrice)
    .replace('{size}', trade.sizeLabel)
    .replace('{result}', trade.resultPercent >= 0 ? 'small win' : 'small loss');

  if (drift === 'SIZE') return `Small starter position in ${trade.symbol} on the ${trade.setup}, in at ${trade.entryPrice}. Keeping it light until it proves itself. Out at ${trade.exitPrice}.`;
  if (drift === 'ENTRY') return `Waited for the pullback on ${trade.symbol} and got filled at ${trade.entryPrice}. Patience paid, no chasing today. Closed ${trade.exitPrice}.`;
  if (drift === 'EXIT') return `${trade.symbol} ${trade.setup}, in at ${trade.entryPrice}. Took profit at the target, ${trade.plannedTarget}, exactly as planned. Textbook.`;
  if (drift === 'INSTRUMENT') return `${random.pick(SYMBOLS.filter((symbol) => symbol !== trade.symbol))} ${trade.setup} at ${trade.entryPrice}, out at ${trade.exitPrice}. Same setup I have been running all month.`;
  if (drift === 'RATIONALISATION') return `Was watching the ${trade.setup} all week and had decided in advance that ${trade.exitPrice} was where I would take it off, which is exactly what happened. The plan was always to scale out into strength rather than hold for the target.`;
  return fill(random.pick(HONEST));
}
