import { choice, noul, score } from '@typesafe-ai/sdk';
import { describeIndicators } from '../services/indicators.js';

/**
 * Builds the state for a trade decision made right after the close of the last candle in
 * `history`. The state shows the last `lookbackBars` candles; with `indicators`, it also describes
 * ten technical indicators computed from all of `history`. `instrument` is { symbol, currency,
 * exchange, instrumentType } as returned by fetchEodCandles.
 *
 * With `blind`, the symbol, exchange, currency and dates are left out and every price, including
 * the indicators, is rebased so the first close shown is 100. Volume is unchanged.
 */
export function buildTradeDecisionState({ instrument, history, lookbackBars, horizonBars, blind = false, indicators = false }) {
  const scale = blind ? 100 / history.at(-Math.min(lookbackBars, history.length)).close : 1;
  const priced = blind
    ? history.map((candle) => ({ ...candle, open: candle.open * scale, high: candle.high * scale, low: candle.low * scale, close: candle.close * scale }))
    : history;
  const bars = priced.slice(-lookbackBars);
  const now = bars.length;
  const price = blind ? (value) => Number(value.toFixed(2)) : (value) => value;
  const { symbol, currency, exchange, instrumentType } = instrument;

  return {
    task: 'You are evaluating a trading decision at one specific point in time.',
    instrument: blind ? { symbol: 'Undisclosed', type: instrumentType } : { symbol, type: instrumentType, exchange, currency },
    timeframe: 'Daily bars, one per trading day',
    decision_point: `Immediately after the close of bar ${now}. Bar ${now} represents NOW.`,
    causality_rule: `You must only use the information provided here. You do not have access to any future bars. Do not assume what happens after bar ${now}.`,
    position: 'The trading system is currently FLAT and may open a LONG position, open a SHORT position, or take NO TRADE.',
    objective: 'Identify whether the current OHLCV sequence contains a sufficiently strong short-term trading opportunity.',
    expected_trade_horizon: `Approximately 1 to ${horizonBars} future bars.`,
    trade_selection: 'A trade should only be selected if there is meaningful directional evidence in the supplied price and volume sequence.',
    no_trade_policy: {
      rule: 'NO TRADE is a fully valid outcome and should be preferred when any of these conditions apply.',
      conditions: [
        'The market structure is unclear.',
        'Directional evidence is weak.',
        'Price action is conflicting.',
        'The move appears excessively extended.',
        'The risk of reversal is high.',
        'The available evidence is insufficient.',
      ],
    },
    considerations: [
      'recent directional movement',
      'higher highs and higher lows',
      'lower highs and lower lows',
      'breakout behavior',
      'failed breakout behavior',
      'rejection candles',
      'continuation behavior',
      'consolidation',
      'momentum',
      'candle ranges',
      'candle bodies',
      'closing locations',
      'volume expansion',
      'volume contraction',
      'relationship between volume and price movement',
      'recent volatility',
      'possible overextension',
      'possible reversal risk',
      ...(indicators ? ['the supplied technical indicator values and signals'] : []),
    ],
    bars: bars.map((bar, i) => ({
      bar: i + 1,
      ...(blind ? {} : { date: bar.date }),
      open: price(bar.open),
      high: price(bar.high),
      low: price(bar.low),
      close: price(bar.close),
      volume: bar.volume,
    })),
    most_recent_price: price(bars.at(-1).close),
    ...(indicators && {
      technical_indicators: {
        note: `Computed only from bars up to and including bar ${now}; long lookbacks such as SMA(200) also use bars from before bar 1. Each signal follows the rule given with it.`,
        ...describeIndicators(priced),
      },
    }),
    execution_assumptions: [
      `The decision is made only after bar ${now} has fully closed.`,
      `The model cannot trade inside bar ${now}.`,
      'The earliest possible execution is during the next bar.',
      'No future price information is available.',
      'Transaction costs and slippage exist conceptually, although exact execution calculations are performed separately by the trading simulator.',
      'Position sizing is handled separately.',
      'Evaluate the quality of the trading setup, not the final portfolio allocation.',
    ],
    purpose:
      'This evaluation is not meant to predict the exact future price. It determines whether the currently observable market state provides sufficient evidence for a directional trade and, if so, characterizes that trade.',
  };
}

export const tradeDecisionQuestions = {
  trade_decision: choice(
    'Based only on the supplied point-in-time OHLCV state, what trading action is best supported? Prefer NO_TRADE when directional evidence is weak, conflicting, ambiguous, or insufficient.',
    { LONG: null, SHORT: null, NO_TRADE: null },
  ),
  trade_setup_exists: noul(
    'Does the supplied market state contain sufficiently strong evidence for opening a new directional trade rather than remaining flat?',
  ),
  market_direction: choice('What directional condition best describes the current market state?', {
    'Strongly bullish': null,
    'Moderately bullish': null,
    'Neutral or unclear': null,
    'Moderately bearish': null,
    'Strongly bearish': null,
  }),
  market_structure: choice('Which market structure best describes the supplied OHLCV sequence?', {
    'Bullish trend': null,
    'Bearish trend': null,
    'Bullish breakout': null,
    'Bearish breakout': null,
    'Bullish reversal': null,
    'Bearish reversal': null,
    'Range or consolidation': null,
    'Conflicting or unclear': null,
  }),
  setup_strength: score(
    'How strong is the available evidence supporting a directional trade at the current point in time?',
    ['No meaningful trading evidence', 'Very weak', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Exceptional'],
  ),
  momentum_state: choice('What best describes the most recent price momentum?', {
    'Strong bullish momentum': null,
    'Moderate bullish momentum': null,
    'No clear momentum': null,
    'Moderate bearish momentum': null,
    'Strong bearish momentum': null,
  }),
  volume_confirmation: noul(
    'Does the observed volume behavior meaningfully confirm the direction of the recent price movement?',
  ),
  price_overextended: noul(
    'Does the latest price movement appear sufficiently extended that entering immediately carries meaningful chase or reversal risk?',
  ),
  entry_style: choice(
    'If a trade is justified, which entry style is most appropriate? Select NOT_APPLICABLE if NO_TRADE is appropriate.',
    {
      ENTER_NEXT_BAR: null,
      WAIT_FOR_PULLBACK: null,
      WAIT_FOR_BREAKOUT_CONFIRMATION: null,
      WAIT_FOR_RETEST: null,
      NOT_APPLICABLE: null,
    },
  ),
  trade_direction_if_taken: choice(
    'If a trade is taken, what should the trade direction be? Select NOT_APPLICABLE if the market should not be traded.',
    { LONG: null, SHORT: null, NOT_APPLICABLE: null },
  ),
  stop_loss_distance: choice(
    'If a trade is justified, what approximate stop-loss distance from entry is most appropriate for the observed structure? Select NOT_APPLICABLE if no trade should be taken.',
    {
      '0.25_PERCENT': null,
      '0.50_PERCENT': null,
      '0.75_PERCENT': null,
      '1.00_PERCENT': null,
      '1.50_PERCENT': null,
      '2.00_PERCENT_OR_MORE': null,
      NOT_APPLICABLE: null,
    },
  ),
  take_profit_distance: choice(
    'If a trade is justified, what approximate first take-profit distance from entry is most appropriate? Select NOT_APPLICABLE if no trade should be taken.',
    {
      '0.50_PERCENT': null,
      '0.75_PERCENT': null,
      '1.00_PERCENT': null,
      '1.50_PERCENT': null,
      '2.00_PERCENT': null,
      '3.00_PERCENT_OR_MORE': null,
      NOT_APPLICABLE: null,
    },
  ),
  expected_holding_period: choice(
    'If a trade is justified, what expected holding period best fits the current setup? Select NOT_APPLICABLE if no trade should be taken.',
    { '1_BAR': null, '2_TO_3_BARS': null, '4_TO_5_BARS': null, '6_TO_8_BARS': null, NOT_APPLICABLE: null },
  ),
  risk_quality: score(
    'How attractive is the current setup from a risk-quality perspective, considering market clarity, volatility, extension, and reversal risk?',
    ['Unacceptable', 'Poor', 'Below average', 'Acceptable', 'Good', 'Very good', 'Exceptional'],
  ),
  remain_flat_due_to_uncertainty: noul(
    'Is the uncertainty in the supplied market state high enough that the trading system should remain flat?',
  ),
};

/**
 * Reads the trade to simulate from the answers, or returns null when the decision is NO_TRADE.
 *
 * Every question is answered independently, so the levels can disagree with the decision.
 * A NOT_APPLICABLE stop or target means no such level, and a NOT_APPLICABLE holding period means
 * the full horizon. Holding periods such as "2_TO_3_BARS" use their upper bound. Entry style is
 * not simulated: every trade enters at the next bar's open.
 */
export function tradePlanFromAnswers(answers, { horizonBars }) {
  const side = answers.trade_decision.choice;
  if (side !== 'LONG' && side !== 'SHORT') return null;

  const holdingBars = answers.expected_holding_period.choice.match(/\d+/g);
  return {
    side,
    stopLossPct: percentFromLabel(answers.stop_loss_distance.choice),
    takeProfitPct: percentFromLabel(answers.take_profit_distance.choice),
    maxBars: holdingBars ? Math.min(Number(holdingBars.at(-1)), horizonBars) : horizonBars,
  };
}

// "1.00_PERCENT" and "2.00_PERCENT_OR_MORE" become 1 and 2; NOT_APPLICABLE becomes null.
function percentFromLabel(label) {
  const value = Number.parseFloat(label);
  return Number.isNaN(value) ? null : value;
}
