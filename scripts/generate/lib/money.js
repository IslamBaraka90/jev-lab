// Money helpers for the synthetic datasets: amounts that look like amounts people actually post,
// with the rounding humans use and the skew real ledgers have.

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED'];

/** Two-decimal rounding that avoids the usual floating-point tail. */
export function round(amount, digits = 2) {
  return Number(Math.round(Number(`${amount}e${digits}`)) + `e-${digits}`);
}

/**
 * An amount between `min` and `max`, skewed towards the small end, and sometimes rounded the way a
 * person rounds: whole hundreds for transfers, whole tens for petty spend.
 */
export function amount(random, { min = 5, max = 5000, skew = 2.5, roundTo = 'natural' } = {}) {
  const raw = random.skewed(min, max, skew);
  if (roundTo === 'exact') return round(raw);
  if (roundTo === 'hundred') return round(Math.max(min, Math.round(raw / 100) * 100));
  // natural: most amounts keep their cents, some land on a round figure
  if (random.bool(0.18)) return round(Math.max(min, Math.round(raw / 50) * 50));
  return round(raw);
}

/** A price-like amount with the decimals an invoice would carry. */
export function unitPrice(random, { min = 1, max = 400 } = {}) {
  return round(random.float(min, max, 2));
}

/** Splits a total into `parts` pieces that add back to the total exactly. */
export function split(total, parts, random) {
  const weights = Array.from({ length: parts }, () => random.next() + 0.15);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const pieces = weights.map((weight) => round((total * weight) / sum));
  const drift = round(total - pieces.reduce((sum, piece) => sum + piece, 0));
  pieces[0] = round(pieces[0] + drift);
  return pieces;
}

/** Percentage of a base, rounded to cents. */
export function percentOf(base, percent) {
  return round((base * percent) / 100);
}
