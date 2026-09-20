// Turning the dataset's own names into words a person reads. Demos keep their keys short and their
// enums in capitals because that is what the model is sent; the page should not look like the state.

const ACRONYMS = new Set(['id', 'vat', 'fx', 'aml', 'kyc', 'po', 'avs', 'cvv', 'ip', 'pnl', 'atr', 'sma', 'ema', 'etf', 'usd', 'gbp', 'eur', 'aed', 'pe', 'pb', 'fcf', 'ebitda', 'cod', 'sku', 'url', 'api', 'otp', 'sms', 'ach', 'iban']);

const word = (text) => (ACRONYMS.has(text.toLowerCase()) ? text.toUpperCase() : text.toLowerCase());

/** "refund_band", "daysSinceOrder" and "prior-disputes" all become sentence case with acronyms kept. */
export function humaniseKey(key) {
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(word);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ENUM = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$|^[A-Z]{3,}$/;

/** "NOT_RECEIVED" becomes "Not received"; ordinary text, tickers in context and ids are left alone. */
export function humaniseValue(value) {
  if (typeof value !== 'string') return value;
  if (!ENUM.test(value) || /\d{3,}/.test(value)) return value;
  if (value.length <= 5 && !value.includes('_')) return value; // tickers and currency codes
  const text = value.replace(/(\d+(?:\.\d+)?)_PERCENT/, '$1%').split('_').map(word).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const MONEY_KEY = /(amount|total|price|paid|balance|notional|value|cost|fee|refund|revenue|income|salary|limit|exposure|subtotal|tax|freight|debit|credit|deposit|withdrawal|pnl|proceeds|charge)s?$/i;
const NOT_MONEY_KEY = /(count|days|hours|minutes|share|ratio|rate|percent|pct|score|rank|index|year|quantity|qty|number|age|bps|weight)/i;

/** Whether a numeric field is an amount of money, judged from its name. */
export const isMoneyKey = (key) => MONEY_KEY.test(key) && !NOT_MONEY_KEY.test(key);

export function formatAmount(value, currency) {
  if (!Number.isFinite(value)) return '–';
  if (!currency) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?$/;

/** One scalar, ready for the page. `currency` comes from the item first and the dataset second. */
export function formatField(key, value, { currency } = {}) {
  if (value === null || value === undefined || value === '') return '–';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (isMoneyKey(key)) return formatAmount(value, currency);
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  if (typeof value === 'string' && DATE.test(value)) {
    const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
  }
  return humaniseValue(value);
}

/** The currency an item is in: its own field if it has one, else the dataset's. */
export function currencyOf(item, context) {
  return item?.currency ?? item?.invoice?.currency ?? item?.order?.currency ?? context?.currency ?? context?.baseCurrency ?? null;
}
