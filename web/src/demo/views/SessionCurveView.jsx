const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const time = (value) => new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function SessionCurveView({ item, demo }) {
  const points = [item.startingEquityUsd];
  for (const trade of item.trades) points.push(points.at(-1) + trade.resultUsd);
  const width = 760;
  const height = 230;
  const pad = { top: 22, right: 22, bottom: 35, left: 72 };
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const x = (index) => pad.left + index / Math.max(points.length - 1, 1) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (max - value) / span * (height - pad.top - pad.bottom);
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point).toFixed(1)}`).join('');
  return (
    <div className="stack trading-session" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 4 }}><span className="eyebrow">{item.id}</span><h3>{demo?.itemLabel?.(item) ?? item.date}</h3></div>
      <dl className="facts trading-facts">
        <div><dt>Prior day</dt><dd>{money(item.previousDayResultUsd)}</dd></div>
        <div><dt>30-day trades/day</dt><dd>{item.norms.averageTradesPerDay}</dd></div>
        <div><dt>Median size</dt><dd>{money(item.norms.medianSizeUsd)}</dd></div>
        <div><dt>Winner hold norm</dt><dd>{item.norms.medianWinningHoldMinutes} min</dd></div>
      </dl>
      <svg className="session-equity" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Session equity: ${points.map((point, index) => `${index ? `after trade ${index}` : 'start'} ${money(point)}`).join(', ')}`}>
        {[min, min + span / 2, max].map((value) => <g key={value}><line className="session-grid" x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} /><text className="session-axis" x={pad.left - 8} y={y(value) + 4} textAnchor="end">{money(value)}</text></g>)}
        <path className="session-line" d={path} />
        {points.map((point, index) => <circle key={index} className={index && item.trades[index - 1].resultUsd < 0 ? 'session-point loss' : 'session-point'} cx={x(index)} cy={y(point)} r={index ? Math.min(8, 3 + item.trades[index - 1].sizeUsd / item.norms.medianSizeUsd) : 3}><title>{index ? `${item.trades[index - 1].tradeId}: ${money(item.trades[index - 1].resultUsd)}, size ${money(item.trades[index - 1].sizeUsd)}` : `Start ${money(point)}`}</title></circle>)}
        <text className="session-axis" x={pad.left} y={height - 10}>Trade sequence · marker size follows position size</text>
      </svg>
      <div className="table-scroll"><table className="data-table compact"><thead><tr><th>Trade</th><th>Time</th><th>Symbol</th><th>Side</th><th className="num">Size</th><th className="num">Result</th><th className="num">Hold</th><th className="num">Gap</th><th className="num">At normal hold</th></tr></thead><tbody>{item.trades.map((trade) => <tr key={trade.tradeId}><th scope="row">{trade.tradeId}</th><td>{time(trade.enteredAt)}–{time(trade.exitedAt)}</td><td>{trade.symbol}</td><td>{trade.side.toLowerCase()}</td><td className="num">{money(trade.sizeUsd)}</td><td className="num">{money(trade.resultUsd)}</td><td className="num">{trade.holdingMinutes}m</td><td className="num">{trade.minutesAfterPreviousExit == null ? '–' : `${trade.minutesAfterPreviousExit}m`}</td><td className="num">{trade.missedAtNormHoldUsd ? `+${money(trade.missedAtNormHoldUsd)}` : '–'}</td></tr>)}</tbody></table></div>
    </div>
  );
}
