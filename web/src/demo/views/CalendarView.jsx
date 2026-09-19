const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value ?? 0);

export function CalendarView({ item, demo }) {
  const months = item.calendar ?? [];
  if (!months.length) return <p className="meta">This item has no calendar to draw.</p>;
  const width = 760;
  const height = 310;
  const pad = { top: 22, right: 18, bottom: 45, left: 60 };
  const plotHeight = height - pad.top - pad.bottom;
  const step = (width - pad.left - pad.right) / months.length;
  const max = Math.max(...months.flatMap((entry) => [entry.income, entry.commitment]), 1);
  const y = (value) => pad.top + plotHeight - (value / max) * plotHeight;
  const textAlternative = months.map((entry) => `${entry.month}: income ${money(entry.income)}, commitments ${money(entry.commitment)}, gap ${money(entry.gap)}, projected cash ${money(entry.projectedCash)}`).join('; ');
  return (
    <div className="stack income-calendar" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 4 }}><span className="eyebrow">{item.id}</span><h3>{demo?.itemLabel?.(item) ?? item.id}</h3></div>
      <svg className="calendar-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Twelve-month income and commitments. ${textAlternative}`}>
        {[0, 0.5, 1].map((fraction) => <g key={fraction}><line className="calendar-grid" x1={pad.left} x2={width - pad.right} y1={y(max * fraction)} y2={y(max * fraction)} /><text className="calendar-axis" x={pad.left - 7} y={y(max * fraction) + 4} textAnchor="end">{money(max * fraction)}</text></g>)}
        {months.map((entry, index) => {
          const x = pad.left + index * step;
          const barWidth = Math.max(5, step * 0.28);
          return <g key={entry.month}>
            {entry.gap < 0 && <rect className="calendar-gap" x={x + step * 0.08} y={y(entry.commitment)} width={step * 0.84} height={Math.max(2, y(entry.income) - y(entry.commitment))}><title>{`${entry.month} gap ${money(entry.gap)}`}</title></rect>}
            <rect className="calendar-income" x={x + step * 0.16} y={y(entry.income)} width={barWidth} height={plotHeight - (y(entry.income) - pad.top)}><title>{`${entry.month} income ${money(entry.income)}`}</title></rect>
            <rect className="calendar-commitment" x={x + step * 0.54} y={y(entry.commitment)} width={barWidth} height={plotHeight - (y(entry.commitment) - pad.top)}><title>{`${entry.month} commitments ${money(entry.commitment)}`}</title></rect>
            <text className="calendar-axis" x={x + step / 2} y={height - 18} textAnchor="middle">{entry.month}</text>
          </g>;
        })}
      </svg>
      <div className="calendar-legend" aria-label="Chart legend"><span><i className="calendar-key income" />Expected income</span><span><i className="calendar-key commitment" />Commitments</span><span><i className="calendar-key gap" />Uncovered monthly gap</span></div>
      <details><summary>Calendar as a table</summary><div className="table-scroll details-content"><table className="data-table compact"><thead><tr><th>Month</th><th className="num">Income</th><th className="num">Commitments</th><th className="num">Gap</th><th className="num">Projected cash</th></tr></thead><tbody>{months.map((entry) => <tr key={entry.month}><th scope="row">{entry.month}</th><td className="num">{money(entry.income)}</td><td className="num">{money(entry.commitment)}</td><td className="num">{money(entry.gap)}</td><td className="num">{money(entry.projectedCash)}</td></tr>)}</tbody></table></div></details>
    </div>
  );
}
