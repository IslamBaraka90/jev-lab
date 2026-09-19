// Insider trading surveillance: real cached price bars around 180 synthetic employee trades. The
// people, access records and event calendar are invented; only the Yahoo Finance candles are real.

import { readFileSync } from 'node:fs';
import { createRandom } from './lib/random.js';
import { personName } from './lib/names.js';

export const SEED = 1126;

const GENERATED_AT = '2026-09-19';
const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'JPM', 'BAC', 'XOM', 'CVX', 'KO', 'PEP', 'WMT', 'PG', 'JNJ'];
const ROLES = [
  ['Finance', 'Planning analyst'],
  ['Legal', 'Corporate counsel'],
  ['Technology', 'Platform engineer'],
  ['Operations', 'Programme manager'],
  ['Sales', 'Account director'],
  ['Treasury', 'Liquidity analyst'],
  ['Risk', 'Risk manager'],
  ['Research', 'Sector analyst'],
];
const MARKET = Object.fromEntries(SYMBOLS.map((symbol) => [
  symbol,
  JSON.parse(readFileSync(new URL(`../../data/market/candles/${symbol}.json`, import.meta.url), 'utf8')),
]));

const SPECIAL = [
  { kind: 'SUSPICIOUS', pattern: 'PRE_ANNOUNCEMENT', symbol: 'AAPL', eventDate: '2024-05-03', offset: 3, employee: 0 },
  { kind: 'SUSPICIOUS', pattern: 'PRE_ANNOUNCEMENT', symbol: 'MSFT', eventDate: '2025-05-01', offset: 3, employee: 1 },
  { kind: 'SUSPICIOUS', pattern: 'FIRST_TIME_INSTRUMENT', symbol: 'NVDA', eventDate: '2023-05-25', offset: 3, employee: 2 },
  { kind: 'SUSPICIOUS', pattern: 'UNUSUAL_SIZE', symbol: 'WMT', eventDate: '2024-08-15', offset: 4, employee: 3 },
  { kind: 'SUSPICIOUS', pattern: 'UNUSUAL_SIZE', symbol: 'PEP', eventDate: '2025-07-17', offset: 2, employee: 4, leverage: true },
  ...[6, 5, 4, 3].map((offset, index) => ({ kind: 'SUSPICIOUS', pattern: 'CLUSTERED_WITH_COLLEAGUES', symbol: 'NVDA', eventDate: '2024-02-22', offset, employee: index + 5, cluster: 'CLUSTER-NVDA-2024-02' })),
];

const SCHEDULED = [
  ['AAPL', '2024-05-03'], ['MSFT', '2025-05-01'], ['NVDA', '2023-05-25'], ['WMT', '2024-08-15'],
  ['PEP', '2025-07-17'], ['KO', '2025-02-11'], ['JNJ', '2025-07-16'], ['PG', '2024-01-23'],
].map(([symbol, eventDate], index) => ({ kind: 'SCHEDULED', pattern: 'ROUTINE', symbol, eventDate, offset: 3, employee: index + 9 }));

const SECTOR = [
  ['XOM', '2023-04-03', 2], ['CVX', '2023-04-03', 3], ['XOM', '2025-05-12', 3], ['CVX', '2025-05-12', 2],
  ['XOM', '2026-02-18', 3], ['CVX', '2026-03-11', 3], ['XOM', '2026-05-15', 2],
].map(([symbol, eventDate, offset], index) => ({ kind: 'SECTOR_MOVE', pattern: 'ROUTINE', symbol, eventDate, offset, employee: index + 17 }));

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const employees = buildEmployees(random);
  for (const plan of SPECIAL) employees[plan.employee].materialAccessSymbols.add(plan.symbol);

  const ordinary = Array.from({ length: 156 }, (_, index) => ordinaryPlan(random, index));
  const plans = random.shuffle([...SPECIAL, ...SCHEDULED, ...SECTOR, ...ordinary]);
  const items = [];
  const labels = [];

  plans.forEach((plan, index) => {
    const built = buildTrade(random, plan, employees, index);
    items.push(built.item);
    labels.push(built.label);
  });

  return {
    dataset: {
      id: 'insider-surveillance',
      class: 'mixed',
      generatedAt: GENERATED_AT,
      seed,
      source: 'Yahoo Finance daily candles cached in data/market/candles plus scripts/generate/insider-surveillance.js',
      context: {
        priceSource: {
          provider: 'Yahoo Finance chart',
          fetchedAt: GENERATED_AT,
          notice: 'Only the daily OHLCV prices are cached-real. Employees, access records, trades and every calendar event are fictional.',
        },
        fictionalNotice: 'All people, roles, trades, access lists and announcement dates in this demo are invented.',
        chartLookbackSessions: 60,
        outcomeWindowSessions: 10,
        blackoutRules: {
          coveredWindow: 'A covered employee with material access may not trade from 14 calendar days before through 2 calendar days after a material issuer event.',
          scheduledPlanExemption: 'A fixed, pre-cleared scheduled plan established before the window is exempt.',
          sectorContext: 'A sector-wide move without issuer-specific access is not by itself an issuer blackout breach.',
        },
      },
      items,
    },
    labels,
  };
}

function buildEmployees(random) {
  return Array.from({ length: 40 }, (_, index) => {
    const [department, role] = ROLES[index % ROLES.length];
    return {
      id: `EMP-${String(index + 1).padStart(3, '0')}`,
      name: personName(random),
      department,
      role,
      accessLevel: ['STANDARD', 'RESTRICTED_PROJECT', 'EXECUTIVE_SUPPORT'][index % 3],
      materialAccessSymbols: new Set(random.sample(SYMBOLS, index % 5 === 0 ? 1 : 0)),
      fictional: true,
    };
  });
}

function ordinaryPlan(random, index) {
  const symbol = random.pick(SYMBOLS);
  const bars = MARKET[symbol].bars;
  const tradeIndex = random.int(660, 1370);
  const eventOffset = random.int(6, 9);
  return {
    kind: 'ORDINARY',
    pattern: 'ROUTINE',
    symbol,
    tradeIndex,
    eventDate: bars[tradeIndex + eventOffset].date,
    offset: eventOffset,
    employee: (index + 24) % 40,
  };
}

function buildTrade(random, plan, employees, index) {
  const market = MARKET[plan.symbol];
  const eventIndex = market.bars.findIndex((bar) => bar.date === plan.eventDate);
  if (eventIndex < 0) throw new Error(`${plan.symbol} has no cached bar for ${plan.eventDate}`);
  const tradeIndex = plan.tradeIndex ?? eventIndex - plan.offset;
  const tradeBar = market.bars[tradeIndex];
  const employee = employees[plan.employee];
  const suspicious = plan.kind === 'SUSPICIOUS';
  const preClearedPlan = plan.kind === 'SCHEDULED' ? scheduledPlan(employee, plan, tradeBar) : null;
  const history = tradeHistory(random, employee, plan, market, tradeIndex, tradeBar, preClearedPlan);
  const historyMedian = median(history.map((trade) => trade.notional));
  const targetNotional = plan.pattern === 'UNUSUAL_SIZE'
    ? Math.max(48_000, historyMedian * (plan.leverage ? 7.5 : 11))
    : plan.kind === 'SCHEDULED'
      ? preClearedPlan.fixedCashAmount
      : random.float(1_200, 9_500, 2);
  const quantity = Math.max(1, Math.round(targetNotional / tradeBar.close));
  const tradeId = `TRD-${String(index + 1).padStart(4, '0')}`;
  const colleagueTrades = colleagueContext(random, plan, employees, market, eventIndex, employee);
  const event = eventFor(plan, market.bars[eventIndex]);
  const outcomeBars = market.bars.slice(tradeIndex + 1, tradeIndex + 11);
  const preTradeBars = market.bars.slice(tradeIndex - 59, tradeIndex + 1);
  const outcomeReturnPercent = Number((((outcomeBars.at(-1).close / tradeBar.close) - 1) * 100).toFixed(2));
  const employeeRecord = {
    id: employee.id,
    name: employee.name,
    department: employee.department,
    role: employee.role,
    accessLevel: employee.accessLevel,
    materialAccessSymbols: suspicious || plan.kind === 'SCHEDULED'
      ? [...employee.materialAccessSymbols]
      : [...employee.materialAccessSymbols].filter((symbol) => symbol !== plan.symbol),
    fictional: true,
  };

  // #region demo:data
  const item = {
    id: tradeId,
    employee: employeeRecord,
    trade: {
      executedAt: `${tradeBar.date}T15:35:00Z`,
      tradeDate: tradeBar.date,
      symbol: plan.symbol,
      side: 'BUY',
      quantity,
      executionPrice: tradeBar.close,
      notional: Number((quantity * tradeBar.close).toFixed(2)),
      instrumentStyle: plan.leverage ? 'THREE_X_CALL_LIKE_PROXY' : 'COMMON_STOCK',
      leverageMultiplier: plan.leverage ? 3 : 1,
      preClearedPlan,
    },
    employeeHistory: history,
    recentColleagueTrades: colleagueTrades,
    eventCalendar: [event],
    market: {
      symbol: market.symbol,
      currency: market.currency,
      exchange: market.exchange,
      instrumentType: market.instrumentType,
      source: 'Yahoo Finance chart (cached)',
      preTradeBars,
      outcomeBars,
      announcementDate: event.date,
    },
  };
  // #endregion

  return {
    item,
    label: {
      tradeId,
      suspicious,
      pattern: plan.pattern,
      blackoutBreach: suspicious,
      expectedDisposition: suspicious ? 'OPEN_CASE' : 'NO_ACTION',
      explainedByHistory: !suspicious,
      lookalike: plan.kind === 'SCHEDULED' ? 'SCHEDULED_PURCHASE' : plan.kind === 'SECTOR_MOVE' ? 'SECTOR_WIDE_MOVE' : null,
      tradeDate: tradeBar.date,
      eventDate: event.date,
      outcomeReturnPercent,
    },
  };
}

function scheduledPlan(employee, plan, tradeBar) {
  return {
    planId: `PLAN-${employee.id}`,
    approvedAt: '2022-01-10',
    effectiveFrom: '2022-02-01',
    cadence: 'MONTHLY',
    symbol: plan.symbol,
    fixedCashAmount: Number((Math.round(4200 / tradeBar.close) * tradeBar.close).toFixed(2)),
    mayBeChangedInsideBlackout: false,
  };
}

function tradeHistory(random, employee, plan, market, tradeIndex, tradeBar, preClearedPlan) {
  const history = [];
  for (let index = 0; index < 8; index++) {
    const priorIndex = Math.max(60, tradeIndex - 21 * (index + 1));
    const priorBar = market.bars[priorIndex];
    const sameSymbol = plan.kind === 'SCHEDULED' || plan.kind === 'SECTOR_MOVE' || (plan.pattern !== 'FIRST_TIME_INSTRUMENT' && index < 2);
    const symbol = sameSymbol ? plan.symbol : SYMBOLS[(SYMBOLS.indexOf(plan.symbol) + index + 1) % SYMBOLS.length];
    const base = plan.kind === 'SCHEDULED'
      ? preClearedPlan.fixedCashAmount
      : plan.pattern === 'UNUSUAL_SIZE'
        ? random.float(1_000, 4_500, 2)
        : random.float(1_000, 8_000, 2);
    history.push({
      id: `H-${employee.id}-${String(index + 1).padStart(2, '0')}`,
      date: priorBar.date,
      symbol,
      side: index % 5 === 4 ? 'SELL' : 'BUY',
      quantity: Math.max(1, Math.round(base / tradeBar.close)),
      notional: Number(base.toFixed(2)),
      planId: plan.kind === 'SCHEDULED' ? preClearedPlan.planId : null,
    });
  }
  return history.sort((left, right) => right.date.localeCompare(left.date));
}

function colleagueContext(random, plan, employees, market, eventIndex, employee) {
  if (plan.cluster) {
    return SPECIAL.filter((entry) => entry.cluster === plan.cluster && employees[entry.employee].id !== employee.id).map((entry) => ({
      employeeId: employees[entry.employee].id,
      department: employees[entry.employee].department,
      symbol: entry.symbol,
      side: 'BUY',
      tradeDate: market.bars[eventIndex - entry.offset].date,
      notionalBand: 'USD 10k–25k',
    }));
  }
  if (plan.kind === 'SECTOR_MOVE') {
    const peer = plan.symbol === 'XOM' ? 'CVX' : 'XOM';
    return [{ employeeId: `EMP-${String(((plan.employee + 8) % 40) + 1).padStart(3, '0')}`, department: 'Operations', symbol: peer, side: 'BUY', tradeDate: market.bars[eventIndex - 2].date, notionalBand: 'USD 1k–5k' }];
  }
  return random.bool(0.18) ? [{ employeeId: `EMP-${String(((plan.employee + 11) % 40) + 1).padStart(3, '0')}`, department: 'Sales', symbol: SYMBOLS[(SYMBOLS.indexOf(plan.symbol) + 3) % SYMBOLS.length], side: 'BUY', tradeDate: market.bars[eventIndex - 5].date, notionalBand: 'USD 1k–5k' }] : [];
}

function eventFor(plan, bar) {
  const sector = plan.kind === 'SECTOR_MOVE';
  return {
    id: `EVT-${plan.symbol}-${bar.date}`,
    date: bar.date,
    issuerSymbol: plan.symbol,
    eventType: sector ? 'SECTOR_POLICY_UPDATE' : 'CORPORATE_ANNOUNCEMENT',
    title: sector ? 'Fictional sector policy briefing' : 'Fictional scheduled corporate announcement',
    materialToIssuer: !sector,
    fictional: true,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
