export const EMPTY = '–';

const formats = new Map();

function format(options) {
  const key = JSON.stringify(options);
  if (!formats.has(key)) formats.set(key, new Intl.NumberFormat('en-US', options));
  return formats.get(key);
}

const missing = (value) => value === null || value === undefined || Number.isNaN(value);

export function formatNumber(value, digits = 0) {
  return missing(value) ? EMPTY : format({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatPrice(value) {
  if (missing(value)) return EMPTY;
  const digits = Math.abs(value) >= 10 ? 2 : 4;
  return format({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value, { digits = 2, signed = true } = {}) {
  if (missing(value)) return EMPTY;
  return `${format({ minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: signed ? 'exceptZero' : 'auto' }).format(value)}%`;
}

// A 0 to 1 probability or share as a whole percentage.
export function formatShare(value) {
  return missing(value) ? EMPTY : `${Math.round(value * 100)}%`;
}

export function formatMoney(value, currency = 'USD', { signed = true, digits = 2 } = {}) {
  if (missing(value)) return EMPTY;
  return format({
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);
}

export function formatCompact(value) {
  return missing(value) ? EMPTY : format({ notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatDate(day, { year = true } = {}) {
  if (!day) return EMPTY;
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(year ? { year: 'numeric' } : {}),
  });
}

export function formatDateTime(iso) {
  if (!iso) return EMPTY;
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(ms) {
  if (missing(ms)) return EMPTY;
  const seconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
  return `${seconds}s`;
}

// Direction as a word for screen readers and tooltips.
export function directionWord(value) {
  if (missing(value) || value === 0) return 'unchanged';
  return value > 0 ? 'up' : 'down';
}
