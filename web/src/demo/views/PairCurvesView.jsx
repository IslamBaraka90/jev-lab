// Two running totals on one set of axes, with the stress window shaded. A pair of strategies that
// are really the same bet look like one line drawn twice, and that is the thing to be able to see
// before reading a correlation off a table.
//
// A demo hands it `item.curves = { left, right, stressFromWeek, stressToWeek }`, each a list of
// cumulative weekly totals, and `item.left` / `item.right` for the names.

const WIDTH = 760;
const HEIGHT = 240;
const PAD = { top: 18, right: 20, bottom: 34, left: 56 };

export function PairCurvesView({ item }) {
  const curves = item.curves;
  if (!curves?.left?.length) return <p className="meta">This item has no curves to draw.</p>;

  const all = [...curves.left, ...curves.right];
  const low = Math.min(0, ...all);
  const high = Math.max(0, ...all);
  const span = Math.max(high - low, 1);
  const weeks = Math.max(curves.left.length, curves.right.length);
  const x = (index) => PAD.left + (index / Math.max(weeks - 1, 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (value) => PAD.top + ((high - value) / span) * (HEIGHT - PAD.top - PAD.bottom);
  const path = (series) => series.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join('');
  const last = (series) => series.at(-1);

  return (
    <div className="stack pair-curves" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">{item.id}</span>
        <h3>{item.pair}</h3>
      </div>

      <svg
        className="behaviour-report-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Cumulative result of ${item.left.name} and ${item.right.name} over ${weeks} weeks, in basis points. ${item.left.name} ends at ${last(curves.left)} and ${item.right.name} at ${last(curves.right)}. The stress window is weeks ${curves.stressFromWeek} to ${curves.stressToWeek}.`}
      >
        {Number.isFinite(curves.stressFromWeek) && (
          <rect className="stress-window" x={x(curves.stressFromWeek)} y={PAD.top} width={Math.max(2, x(curves.stressToWeek) - x(curves.stressFromWeek))} height={HEIGHT - PAD.top - PAD.bottom} />
        )}
        <line className="report-axis" x1={PAD.left} y1={y(0)} x2={WIDTH - PAD.right} y2={y(0)} />
        <path className="report-line" d={path(curves.left)} />
        <path className="report-line compare" d={path(curves.right)} />
        <text className="report-axis-text" x={PAD.left} y={HEIGHT - 10}>Weeks · shaded band is the stress window · basis points, cumulative</text>
        <text className="candle-axis" x={PAD.left - 8} y={y(high) + 4} textAnchor="end">{Math.round(high)}</text>
        <text className="candle-axis" x={PAD.left - 8} y={y(low) + 4} textAnchor="end">{Math.round(low)}</text>
      </svg>

      <p className="meta equity-legend">
        <span><i className="legend-line series-key" />{item.left.name}</span>
        <span><i className="legend-line compare-key" />{item.right.name}</span>
      </p>

      <dl className="facts">
        <div><dt>{item.left.id}</dt><dd>{item.left.rule}</dd></div>
        <div><dt>{item.right.id}</dt><dd>{item.right.rule}</dd></div>
      </dl>
    </div>
  );
}
