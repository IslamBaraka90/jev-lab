export function linear([domainStart, domainEnd], [rangeStart, rangeEnd]) {
  const span = domainEnd - domainStart || 1;
  const scale = (value) => rangeStart + ((value - domainStart) / span) * (rangeEnd - rangeStart);
  scale.invert = (position) => domainStart + ((position - rangeStart) / (rangeEnd - rangeStart)) * span;
  return scale;
}

export function extent(values) {
  let low = Infinity;
  let high = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  return low === Infinity ? [0, 1] : [low, high];
}

// Round tick values (1, 2, 2.5 or 5 times a power of ten) inside [low, high].
export function niceTicks(low, high, count = 5) {
  if (low === high) return [low];
  const raw = (high - low) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * power;
  const ticks = [];
  for (let value = Math.ceil(low / step) * step; value <= high + step * 1e-9; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}

// A column with a 4 px rounded data end and a square base.
export function columnPath(x, y, width, base) {
  const height = base - y;
  if (height <= 0) return '';
  const radius = Math.min(4, width / 2, height);
  return `M${x},${base}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + width - radius}Q${x + width},${y} ${x + width},${y + radius}V${base}Z`;
}
