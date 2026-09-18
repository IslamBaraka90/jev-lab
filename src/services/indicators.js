import { rsi } from 'fintech-algorithms/technical-indicators/momentum/rsi';
import { stochastic } from 'fintech-algorithms/technical-indicators/momentum/stochastic-oscillator';
import { calculateEma } from 'fintech-algorithms/technical-indicators/trend-smoothing/ema';
import { calculateSma } from 'fintech-algorithms/technical-indicators/trend-smoothing/sma';
import { adx } from 'fintech-algorithms/technical-indicators/trend-systems/adx';
import { macd } from 'fintech-algorithms/technical-indicators/trend-systems/macd';
import { averageTrueRange } from 'fintech-algorithms/technical-indicators/volatility-and-channels/atr';
import { bollingerBands } from 'fintech-algorithms/technical-indicators/volatility-and-channels/bollinger-bands';
import { moneyFlowIndex } from 'fintech-algorithms/technical-indicators/volume-indicators/money-flow-index';

const RECENT_BARS = 5;

/**
 * Describes ten common indicators as of the last candle, computed only from the candles given.
 *
 * Every indicator has its current values, a bullish, bearish or neutral signal with the rule that
 * produced it, and a plain-language explanation. Oscillators and MACD also list their last five
 * values. ATR is not directional, and an indicator without enough history is marked unavailable;
 * neither counts towards the summary.
 */
export function describeIndicators(candles) {
  const column = (field) => candles.map((candle) => candle[field]);
  const close = column('close');
  const priceDigits = Math.abs(close.at(-1)) >= 10 ? 2 : 4;
  const context = {
    close,
    high: column('high'),
    low: column('low'),
    volume: column('volume'),
    last: candles.length - 1,
    priceDigits,
    price: (value) => round(value, priceDigits),
  };
  const sma50 = calculateSma(close, 50);

  const indicators = [
    movingAverage(context, 'EMA(20)', calculateEma(close, 20)),
    movingAverage(context, 'SMA(50)', sma50),
    movingAverage(context, 'SMA(200)', calculateSma(close, 200), sma50),
    macdIndicator(context),
    rsiIndicator(context),
    stochasticIndicator(context),
    adxIndicator(context),
    bollingerIndicator(context),
    atrIndicator(context),
    mfiIndicator(context),
  ];
  const count = (signal) => indicators.filter((indicator) => indicator.signal === signal).length;
  return { summary: { bullish: count('bullish'), bearish: count('bearish'), neutral: count('neutral') }, indicators };
}

// Price against a moving average. For SMA(200), `sma50` adds the golden or death cross state.
function movingAverage({ close, last, price }, name, average, sma50) {
  const rule = `Bullish when the close is above ${name}, bearish when it is below.`;
  if (!ready(average[last], average[last - 5])) return unavailable(name, 'moving average', rule);

  const above = close[last] > average[last];
  const side = above ? 'above' : 'below';
  const distancePct = percentChange(average[last], close[last]);
  const changePct = percentChange(average[last - 5], average[last]);
  const barsOnSide = streak(last, (i) => ready(average[i]) && close[i] > average[i] === above);
  const indicator = {
    name,
    category: 'moving average',
    signal: close[last] === average[last] ? 'neutral' : above ? 'bullish' : 'bearish',
    signal_rule: rule,
    values: {
      value: price(average[last]),
      close_vs_average_pct: round(distancePct, 2),
      change_over_5_bars_pct: round(changePct, 2),
      bars_closed_on_this_side: barsOnSide,
    },
    explanation:
      `${name} is ${price(average[last])}. The close of ${price(close[last])} is ${Math.abs(round(distancePct, 2))}% ${side} it, ` +
      `and price has closed ${side} it for ${barsOnSide} bars. ${name} ${moved(changePct)} over the last 5 bars.`,
  };
  if (!sma50 || !ready(sma50[last])) return indicator;

  const fiftyAbove = sma50[last] > average[last];
  const barsCrossed = streak(last, (i) => ready(sma50[i], average[i]) && sma50[i] > average[i] === fiftyAbove);
  indicator.values.sma50_vs_sma200_pct = round(percentChange(average[last], sma50[last]), 2);
  indicator.values.bars_sma50_on_this_side = barsCrossed;
  indicator.explanation +=
    ` SMA(50) is ${price(sma50[last])} and has been ${fiftyAbove ? 'above' : 'below'} SMA(200) for ${barsCrossed} bars` +
    ` (${fiftyAbove ? 'golden' : 'death'} cross state).`;
  return indicator;
}

function macdIndicator({ close, last, priceDigits }) {
  const name = 'MACD(12, 26, 9)';
  const rule = 'Bullish when the MACD line is above its signal line, bearish when it is below.';
  const rows = macd(close, 12, 26, 9);
  if (rows[last - RECENT_BARS + 1]?.status !== 'ready') return unavailable(name, 'trend momentum', rule);

  const digits = priceDigits + 1;
  const { macd: line, signal, histogram } = rows[last];
  const above = histogram > 0;
  const barsOnSide = streak(last, (i) => rows[i].status === 'ready' && rows[i].histogram > 0 === above);
  const recentValues = recent(
    last,
    { macd_line: rows.map((row) => row.macd), signal_line: rows.map((row) => row.signal), histogram: rows.map((row) => row.histogram) },
    digits,
  );
  return {
    name,
    category: 'trend momentum',
    signal: histogram === 0 ? 'neutral' : above ? 'bullish' : 'bearish',
    signal_rule: rule,
    values: { macd_line: round(line, digits), signal_line: round(signal, digits), histogram: round(histogram, digits) },
    recent: recentValues,
    explanation:
      `The MACD line is ${round(line, digits)} and the signal line is ${round(signal, digits)}, so the histogram is ${round(histogram, digits)}. ` +
      `The MACD line has been ${above ? 'above' : 'below'} the signal line for ${barsOnSide} bars and is ${line >= 0 ? 'above' : 'below'} zero. ` +
      `Over the last 5 bars the histogram went ${recentValues.map((row) => row.histogram).join(' -> ')}.`,
  };
}

function rsiIndicator({ close, last }) {
  const name = 'RSI(14)';
  const rule = 'Bullish when RSI is below 30 and rising, bearish when it is above 70 and falling, otherwise neutral.';
  const values = rsi(close, 14).rsi;
  if (!ready(values[last], values[last - RECENT_BARS])) return unavailable(name, 'momentum oscillator', rule);

  const [now, previous] = [values[last], values[last - 1]];
  return {
    name,
    category: 'momentum oscillator',
    signal: now < 30 && now > previous ? 'bullish' : now > 70 && now < previous ? 'bearish' : 'neutral',
    signal_rule: rule,
    values: { rsi: round(now, 2) },
    recent: recent(last, { rsi: values }, 2),
    explanation:
      `RSI(14) is ${round(now, 2)}, ${zone(now, 30, 70)}. It ${movedFrom(now, previous, 2)} on the latest bar ` +
      `and was ${round(values[last - RECENT_BARS], 2)} five bars ago.`,
  };
}

function stochasticIndicator({ high, low, close, last }) {
  const name = 'Stochastic(14, 3, 3)';
  const rule = 'Bullish when %K is below 20 and above %D, bearish when %K is above 80 and below %D, otherwise neutral.';
  const { slow_k: k, slow_d: d } = stochastic(high, low, close, 14, 3, 3);
  if (!ready(d[last - RECENT_BARS + 1], d[last])) return unavailable(name, 'momentum oscillator', rule);

  const kAbove = k[last] > d[last];
  const barsOnSide = streak(last, (i) => ready(k[i], d[i]) && k[i] > d[i] === kAbove);
  return {
    name,
    category: 'momentum oscillator',
    signal: k[last] < 20 && kAbove ? 'bullish' : k[last] > 80 && k[last] < d[last] ? 'bearish' : 'neutral',
    signal_rule: rule,
    values: { percent_k: round(k[last], 2), percent_d: round(d[last], 2) },
    recent: recent(last, { percent_k: k, percent_d: d }, 2),
    explanation:
      `Slow %K is ${round(k[last], 2)} and %D is ${round(d[last], 2)}, so %K is ${zone(k[last], 20, 80)}. ` +
      `%K has been ${kAbove ? 'above' : 'below'} %D for ${barsOnSide} bars.`,
  };
}

function adxIndicator({ high, low, close, last }) {
  const name = 'ADX(14)';
  const rule =
    'Bullish when ADX is at least 20 and rising with +DI above -DI, bearish when ADX is at least 20 and rising with -DI above +DI, otherwise neutral.';
  const { adx: strength, plus_di: plusDi, minus_di: minusDi } = adx(high, low, close, 14);
  if (!ready(strength[last], strength[last - RECENT_BARS])) return unavailable(name, 'trend strength', rule);

  const trending = strength[last] >= 20 && strength[last] > strength[last - 1];
  const upward = plusDi[last] > minusDi[last];
  return {
    name,
    category: 'trend strength',
    signal: trending && upward ? 'bullish' : trending && minusDi[last] > plusDi[last] ? 'bearish' : 'neutral',
    signal_rule: rule,
    values: { adx: round(strength[last], 2), plus_di: round(plusDi[last], 2), minus_di: round(minusDi[last], 2) },
    recent: recent(last, { adx: strength, plus_di: plusDi, minus_di: minusDi }, 2),
    explanation:
      `ADX(14) is ${round(strength[last], 2)}, which suggests ${trendStrength(strength[last])}. ` +
      `+DI is ${round(plusDi[last], 2)} and -DI is ${round(minusDi[last], 2)}, so ${upward ? 'upward' : 'downward'} movement dominates. ` +
      `ADX ${movedFrom(strength[last], strength[last - 1], 2)} on the latest bar and was ${round(strength[last - RECENT_BARS], 2)} five bars ago.`,
  };
}

function bollingerIndicator({ close, last, price }) {
  const name = 'Bollinger Bands(20, 2)';
  const rule =
    'Mean-reversion reading: bearish when the close is above the upper band (%B above 1), bullish when it is below the lower band (%B below 0), otherwise neutral.';
  const { middle, upper, lower, percent_b: percentB } = bollingerBands(close, 20, 2);
  if (!ready(middle[last - 20], percentB[last - RECENT_BARS + 1], percentB[last])) {
    return unavailable(name, 'volatility bands', rule);
  }

  const width = (i) => ((upper[i] - lower[i]) / middle[i]) * 100;
  const b = percentB[last];
  return {
    name,
    category: 'volatility bands',
    signal: b > 1 ? 'bearish' : b < 0 ? 'bullish' : 'neutral',
    signal_rule: rule,
    values: {
      upper: price(upper[last]),
      middle: price(middle[last]),
      lower: price(lower[last]),
      percent_b: round(b, 2),
      band_width_pct: round(width(last), 2),
    },
    recent: recent(last, { percent_b: percentB }, 2),
    explanation:
      `The upper band is ${price(upper[last])}, the middle band (20-bar SMA) ${price(middle[last])} and the lower band ${price(lower[last])}. ` +
      `The close of ${price(close[last])} has a %B of ${round(b, 2)}, ${bandPosition(b)}. ` +
      `The bands are ${round(width(last), 2)}% of the middle band wide, ${width(last) >= width(last - 20) ? 'wider' : 'narrower'} than ${round(width(last - 20), 2)}% 20 bars ago.`,
  };
}

function atrIndicator({ high, low, close, last, price }) {
  const name = 'ATR(14)';
  const rule = 'Not directional: ATR measures how far price typically moves in one bar.';
  const { atr } = averageTrueRange(high, low, close, 14);
  if (!ready(atr[last], atr[last - 20])) return unavailable(name, 'volatility', rule);

  const percentOfClose = round((atr[last] / close[last]) * 100, 2);
  const changePct = percentChange(atr[last - 20], atr[last]);
  return {
    name,
    category: 'volatility',
    signal: 'not directional',
    signal_rule: rule,
    values: { atr: price(atr[last]), atr_pct_of_close: percentOfClose, change_over_20_bars_pct: round(changePct, 2) },
    explanation:
      `ATR(14) is ${price(atr[last])}, ${percentOfClose}% of the close, so a typical bar spans about ${percentOfClose}%. ` +
      `ATR ${moved(changePct)} over the last 20 bars, so volatility is ${changePct >= 0 ? 'expanding' : 'contracting'}.`,
  };
}

function mfiIndicator({ high, low, close, volume, last }) {
  const name = 'MFI(14)';
  const rule = 'Bullish when MFI is below 20, bearish when it is above 80, otherwise neutral.';
  const { mfi } = moneyFlowIndex(high, low, close, volume, 14);
  if (!ready(mfi[last], mfi[last - RECENT_BARS])) return unavailable(name, 'volume oscillator', rule);

  const priceChangePct = percentChange(close[last - RECENT_BARS], close[last]);
  const mfiChange = mfi[last] - mfi[last - RECENT_BARS];
  const confirms = Math.sign(priceChangePct) === Math.sign(mfiChange);
  return {
    name,
    category: 'volume oscillator',
    signal: mfi[last] < 20 ? 'bullish' : mfi[last] > 80 ? 'bearish' : 'neutral',
    signal_rule: rule,
    values: { mfi: round(mfi[last], 2) },
    recent: recent(last, { mfi }, 2),
    explanation:
      `MFI(14) is ${round(mfi[last], 2)}, ${zone(mfi[last], 20, 80)}. Over the last 5 bars price ${moved(priceChangePct)} ` +
      `and MFI ${movedFrom(mfi[last], mfi[last - RECENT_BARS], 2)}, so volume-weighted money flow ${confirms ? 'confirms' : 'does not confirm'} the price move.`,
  };
}

function unavailable(name, category, rule) {
  return { name, category, signal: 'unavailable', signal_rule: rule, explanation: `Not enough history to compute ${name}.` };
}

// The last RECENT_BARS values of each series, oldest first.
function recent(last, series, digits) {
  return Array.from({ length: RECENT_BARS }, (_, k) => {
    const i = last - RECENT_BARS + 1 + k;
    const values = Object.entries(series).map(([key, values]) => [key, round(values[i], digits)]);
    return { bars_ago: RECENT_BARS - 1 - k, ...Object.fromEntries(values) };
  });
}

// Consecutive bars, counting back from `last`, for which `test` holds.
function streak(last, test) {
  let bars = 0;
  while (last - bars >= 0 && test(last - bars)) bars++;
  return bars;
}

function zone(value, oversold, overbought) {
  if (value >= overbought) return `at or above the overbought level of ${overbought}`;
  if (value <= oversold) return `at or below the oversold level of ${oversold}`;
  return `between the oversold level of ${oversold} and the overbought level of ${overbought}`;
}

function trendStrength(value) {
  if (value < 20) return 'no clear trend';
  if (value < 25) return 'a developing trend';
  if (value < 50) return 'a strong trend';
  return 'a very strong trend';
}

function bandPosition(percentB) {
  if (percentB > 1) return 'above the upper band';
  if (percentB < 0) return 'below the lower band';
  if (percentB >= 0.8) return 'inside the bands near the upper band';
  if (percentB <= 0.2) return 'inside the bands near the lower band';
  return 'inside the bands';
}

function moved(changePct) {
  if (changePct === 0) return 'was unchanged';
  return `${changePct > 0 ? 'rose' : 'fell'} ${Math.abs(round(changePct, 2))}%`;
}

function movedFrom(now, before, digits) {
  if (now === before) return `was unchanged at ${round(now, digits)}`;
  return `${now > before ? 'rose' : 'fell'} from ${round(before, digits)}`;
}

function percentChange(from, to) {
  return (to / from - 1) * 100;
}

function ready(...values) {
  return values.every(Number.isFinite);
}

function round(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}
