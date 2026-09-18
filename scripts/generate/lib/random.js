// Seeded randomness for the synthetic datasets. Every generator takes a seed and produces the same
// data on every run, so a dataset can be regenerated, diffed and trusted. Nothing here uses Math.random.

/** A small, fast, seedable generator (mulberry32). */
export function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const random = {
    next,

    /** Whole number from min to max, both included. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),

    /** Number from min to max with `digits` decimals. */
    float: (min, max, digits = 2) => Number((min + next() * (max - min)).toFixed(digits)),

    /** True with probability `p`. */
    bool: (p = 0.5) => next() < p,

    /** One item from a list. */
    pick: (items) => items[Math.floor(next() * items.length)],

    /** One item from `[value, weight]` pairs; heavier values come up more often. */
    weighted: (pairs) => {
      const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
      let point = next() * total;
      for (const [value, weight] of pairs) {
        point -= weight;
        if (point <= 0) return value;
      }
      return pairs.at(-1)[0];
    },

    /** Normally distributed value (Box-Muller), clamped to `min`/`max` when given. */
    normal: (mean, deviation, { min = -Infinity, max = Infinity } = {}) => {
      const u = Math.max(next(), Number.EPSILON);
      const value = mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
      return Math.min(max, Math.max(min, value));
    },

    /** Skewed towards `min`: many small values, a few large ones. Higher `power` skews harder. */
    skewed: (min, max, power = 2.5) => min + (max - min) * next() ** power,

    /** A copy of the list in a new order. */
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },

    /** `count` different items from a list. */
    sample: (items, count) => random.shuffle(items).slice(0, count),

    /** An id such as `L-0042`. */
    id: (prefix, index, width = 4) => `${prefix}-${String(index).padStart(width, '0')}`,

    /** A date between two ISO days, as an ISO day. */
    day: (from, to) => {
      const start = Date.parse(`${from}T00:00:00Z`);
      const end = Date.parse(`${to}T00:00:00Z`);
      return new Date(start + Math.floor(next() * (end - start))).toISOString().slice(0, 10);
    },

    /** A timestamp on `day`, mostly in working hours with a small night-time tail. */
    timeOnDay: (day) => {
      const hour = random.weighted([
        [random.int(9, 17), 82],
        [random.int(18, 22), 13],
        [random.int(0, 6), 5],
      ]);
      const time = `${String(hour).padStart(2, '0')}:${String(random.int(0, 59)).padStart(2, '0')}:${String(random.int(0, 59)).padStart(2, '0')}`;
      return `${day}T${time}Z`;
    },
  };

  return random;
}

/** Adds `days` to an ISO day, skipping nothing; use `nextWorkday` for business days. */
export function addDays(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The next Monday to Friday on or after `day`. */
export function nextWorkday(day) {
  let current = day;
  while ([0, 6].includes(new Date(`${current}T00:00:00Z`).getUTCDay())) current = addDays(current, 1);
  return current;
}
