// Three hundred headlines, each with the chart it landed on. The bars are a real cached daily series —
// real gaps, real volatility, real forward moves — so "what happened next" is genuine market behaviour
// and not a simulation.
//
// The issuers are invented and the price level is rebased, deliberately. Writing an invented headline
// against a named real company on a real date would be fabricated financial news, and no disclaimer
// makes that all right. Rebasing costs the demo nothing: a forward return is the same number whatever
// the starting price is.
//
// Forty headlines sit in front of a real move of six per cent or more, forty equally dramatic ones sit
// in front of nothing at all, and two hundred and twenty are routine. Materiality and outcome are on
// purpose not the same thing. Labels go to data/synthetic/news-impact.labels.json.

import { createRandom } from './lib/random.js';
import { round } from './lib/money.js';
import { candles } from './lib/market.js';

export const SEED = 1171;

const SHOWN = 18;
const REVEALED = 6;
const BIG_MOVE = 6;
const FLAT_MOVE = 1;

/** An invented issuer for each cached series. The series is real; the company on the page is not. */
const ISSUERS = [
  { ticker: 'KSTL', name: 'Kestrel Technologies', sector: 'Semiconductors', series: 'NVDA', base: 64 },
  { ticker: 'NRWD', name: 'Northwind Systems', sector: 'Enterprise software', series: 'MSFT', base: 118 },
  { ticker: 'LNTN', name: 'Lantern Devices', sector: 'Consumer hardware', series: 'AAPL', base: 92 },
  { ticker: 'MRDN', name: 'Meridian Financial', sector: 'Banking', series: 'JPM', base: 47 },
  { ticker: 'HRBR', name: 'Harbour Union Bank', sector: 'Banking', series: 'BAC', base: 31 },
  { ticker: 'QRRY', name: 'Quarry Petroleum', sector: 'Oil and gas', series: 'XOM', base: 58 },
  { ticker: 'IRBK', name: 'Ironbark Energy', sector: 'Oil and gas', series: 'CVX', base: 73 },
  { ticker: 'ORCH', name: 'Orchard Beverages', sector: 'Soft drinks', series: 'KO', base: 26 },
  { ticker: 'SLMR', name: 'Saltmarsh Foods', sector: 'Packaged foods', series: 'PEP', base: 39 },
  { ticker: 'CDRH', name: 'Cedar Household', sector: 'Household goods', series: 'PG', base: 54 },
  { ticker: 'BCNM', name: 'Beacon Medical', sector: 'Pharmaceuticals', series: 'JNJ', base: 81 },
  { ticker: 'TNBR', name: 'Tinbridge Retail', sector: 'General retail', series: 'WMT', base: 44 },
];

export function generate(seed = SEED) {
  const random = createRandom(seed);
  const series = new Map(ISSUERS.map((issuer) => [issuer.ticker, rebased(issuer)]));
  const plan = random.shuffle([
    ...Array.from({ length: 40 }, () => 'MOVED'),
    ...Array.from({ length: 40 }, () => 'NOTHING'),
    ...Array.from({ length: 220 }, () => 'ROUTINE'),
  ]);

  const taken = new Map(ISSUERS.map((issuer) => [issuer.ticker, []]));
  const picked = plan.map((group, index) => {
    const issuer = ISSUERS[index % ISSUERS.length];
    const bars = series.get(issuer.ticker);
    const at = choose(random, { bars, group, taken: taken.get(issuer.ticker) });
    taken.get(issuer.ticker).push(at);
    return { issuer, bars, at, group, ...outcome(bars, at) };
  });

  picked.sort((left, right) => left.bars[left.at].date.localeCompare(right.bars[right.at].date));
  const entries = picked.map((entry, index) => ({ ...entry, id: random.id('NW', index + 1), story: story(random, entry) }));

  const labels = entries.map((entry) => ({
    headlineId: entry.id,
    actualMoveSameDayPct: entry.actualMoveSameDayPct,
    actualMovePct: entry.actualMovePct,
    actualMove20Pct: entry.actualMove20Pct,
    priorDriftPct: entry.priorDriftPct,
    intendedMateriality: entry.story.materiality,
    intendedDirection: entry.story.direction,
    group: entry.group,
  }));

  return {
    dataset: {
      id: 'news-impact',
      class: 'mixed',
      generatedAt: '2026-09-19',
      seed,
      source: 'scripts/generate/news-impact.js',
      context: {
        barsBeforeTheHeadline: SHOWN,
        issuers: ISSUERS.map(({ ticker, name, sector }) => ({ ticker, name, sector })),
        note: 'The bars are a real cached daily series, rebased to a different price level, so every gap, every run and every move after a headline is one the market actually made. The companies are invented and so is every headline: attaching invented news to a real listed company would be a fabrication, and rebasing changes nothing here, because a forward return does not depend on the starting price. None of this is investment advice.',
      },
      items: entries.map((entry) => item(entry, entries)),
    },
    labels,
  };
}

/** The same series at a different price level. Every return is untouched; only the scale moves. */
function rebased(issuer) {
  const bars = candles(issuer.series).bars;
  const scale = issuer.base / bars[0].close;
  return bars.map((bar) => ({
    date: bar.date,
    open: round(bar.open * scale, 2),
    high: round(bar.high * scale, 2),
    low: round(bar.low * scale, 2),
    close: round(bar.close * scale, 2),
    volume: Math.round((bar.volume ?? 0) / 1000),
  }));
}

const forward = (bars, at, days) => ((bars[Math.min(at + days, bars.length - 1)].close - bars[at].close) / bars[at].close) * 100;

/** What the market did afterwards. The state never sees any of it; the report is built on all of it. */
function outcome(bars, at) {
  return {
    actualMoveSameDayPct: round(forward(bars, at, 1), 2),
    actualMovePct: round(forward(bars, at, 5), 2),
    actualMove20Pct: round(forward(bars, at, 20), 2),
    priorDriftPct: round(((bars[at].close - bars[at - 5].close) / bars[at - 5].close) * 100, 2),
  };
}

/** A trading day that does what this group needs, far enough from the ones already used. */
function choose(random, { bars, group, taken }) {
  const clear = (at) => taken.every((other) => Math.abs(other - at) > SHOWN + REVEALED);
  const moved = (at) => Math.abs(forward(bars, at, 5));
  const wanted = (at) => (group === 'MOVED' ? moved(at) >= BIG_MOVE : group === 'NOTHING' ? moved(at) <= FLAT_MOVE : true);

  for (let tries = 0; tries < 600; tries++) {
    const at = random.int(SHOWN + 260, bars.length - 22);
    if (clear(at) && wanted(at)) return at;
  }
  return random.int(SHOWN + 260, bars.length - 22);
}

// #region demo:data
/** One headline: the story, the chart it landed on, and the last three stories about the same issuer. */
function item(entry, all) {
  const { issuer, bars, at } = entry;
  const window = bars.slice(at - SHOWN + 1, at + REVEALED + 1);
  const priors = all
    .filter((other) => other.issuer.ticker === issuer.ticker && other.bars[other.at].date < bars[at].date)
    .slice(-3)
    .map((prior) => `${prior.bars[prior.at].date} · ${prior.story.headline}`);

  return {
    id: entry.id,
    ticker: issuer.ticker,
    company: issuer.name,
    sector: issuer.sector,
    date: bars[at].date,
    headline: entry.story.headline,
    body: entry.story.body,
    kind: entry.story.kind,
    priorHeadlines: priors,
    close: bars[at].close,
    chart: {
      markIndex: SHOWN - 1,
      label: `${issuer.ticker} · ${bars[at].date}`,
      bars: window.map((bar) => `${bar.date} ${bar.open} ${bar.high} ${bar.low} ${bar.close} ${bar.volume}`),
    },
  };
}
// #endregion

const TEMPLATES = {
  EARNINGS: [
    ['{company} reports quarterly revenue ahead of its own guidance', 'POSITIVE', 4],
    ['{company} misses on the quarter as margins narrow', 'NEGATIVE', 4],
    ['{company} matches expectations in a quiet quarter', 'NEUTRAL', 1],
  ],
  GUIDANCE: [
    ['{company} raises its full-year outlook', 'POSITIVE', 5],
    ['{company} cuts full-year guidance, citing weaker demand', 'NEGATIVE', 5],
    ['{company} leaves full-year guidance unchanged', 'NEUTRAL', 1],
  ],
  CONTRACT: [
    ['{company} signs a multi-year supply agreement with a major customer', 'POSITIVE', 4],
    ['{company} loses a long-standing contract to a competitor', 'NEGATIVE', 4],
    ['{company} renews an existing distribution agreement', 'NEUTRAL', 1],
  ],
  REGULATORY: [
    ['Regulator clears {company} to proceed with its main programme', 'POSITIVE', 5],
    ['{company} faces a regulatory review of its largest business line', 'NEGATIVE', 5],
    ['{company} files its routine annual disclosure', 'NEUTRAL', 0],
  ],
  MANAGEMENT: [
    ['{company} appoints a chief executive from outside the company', 'POSITIVE', 4],
    ['{company} finance chief steps down with immediate effect', 'NEGATIVE', 5],
    ['{company} promotes its operations head to the board', 'NEUTRAL', 1],
  ],
  ANALYST: [
    ['Two brokers raise their price target on {company}', 'POSITIVE', 2],
    ['A broker cuts {company} to hold on valuation', 'NEGATIVE', 2],
    ['Coverage of {company} initiated at neutral', 'NEUTRAL', 1],
  ],
  ROUTINE: [
    ['{company} to present at an industry conference next month', 'NEUTRAL', 0],
    ['{company} declares its usual quarterly dividend', 'NEUTRAL', 0],
    ['{company} opens a second site in the region', 'NEUTRAL', 1],
    ['{company} publishes its annual sustainability report', 'NEUTRAL', 0],
  ],
};

const BODIES = {
  POSITIVE: ['The company said the improvement was broad rather than concentrated in one line.', 'Management described the period as ahead of its own plan and said the trend had continued since.', 'No change was made to the capital programme.'],
  NEGATIVE: ['The company said the shortfall was concentrated in its largest division.', 'Management declined to say whether the effect would carry into the following year.', 'The statement gave no revised figure for the second half.'],
  NEUTRAL: ['The statement contained no new financial information.', 'The company said the arrangement is on its usual terms.', 'No further detail was given.'],
};

/** The story. Where a real move follows, the story is written to point the way the market went — a
 *  guidance cut before a fall — because a headline pointing the other way would be a different test. */
function story(random, entry) {
  const kinds = entry.group === 'ROUTINE' ? ['ANALYST', 'ROUTINE', 'ROUTINE', 'EARNINGS', 'CONTRACT'] : ['EARNINGS', 'GUIDANCE', 'CONTRACT', 'REGULATORY', 'MANAGEMENT'];
  const kind = random.pick(kinds);
  const heavy = entry.group !== 'ROUTINE';
  const wanted = entry.group === 'MOVED' ? (entry.actualMovePct >= 0 ? 'POSITIVE' : 'NEGATIVE') : null;

  const options = TEMPLATES[kind].filter(([, direction, weight]) => (heavy ? weight >= 4 : weight <= 2) && (!wanted || direction === wanted));
  const [template, direction, materiality] = random.pick(options.length ? options : TEMPLATES[kind]);
  const body = random.shuffle(BODIES[direction]).slice(0, 2);

  return {
    kind,
    direction,
    materiality,
    headline: template.replace('{company}', entry.issuer.name),
    body: `${body.join(' ')} ${random.pick(['The shares were not halted.', 'The company did not hold a call.', 'A call is scheduled for the following morning.'])}`,
  };
}
