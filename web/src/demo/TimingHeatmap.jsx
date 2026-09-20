// The timing grid as small multiples: one weekday-by-month-phase block per instrument and direction.
// Colour is the realised return, and a cell with too few instances to support a claim is hatched, so
// the eye is not drawn to a strong colour that rests on three trades.

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const PHASES = ['START', 'MIDDLE', 'END'];

// Weekdays and month phases arrive in capitals; short ones like END would otherwise be read as a ticker.
const humaniseValue = (value) => String(value).charAt(0) + String(value).slice(1).toLowerCase().replaceAll('_', ' ');

const orderBy = (list, reference) => [...list].sort((a, b) => (reference.indexOf(a) + 1 || 99) - (reference.indexOf(b) + 1 || 99));

function cellColor(value, scale) {
  if (!Number.isFinite(value) || !scale) return 'transparent';
  const strength = Math.min(1, Math.abs(value) / scale);
  return `color-mix(in srgb, var(--${value >= 0 ? 'long' : 'short'}) ${Math.round(18 + strength * 72)}%, transparent)`;
}

export function TimingHeatmap({ grid }) {
  const cells = grid.cells ?? [];
  if (!cells.length) return null;

  const blocks = new Map();
  for (const cell of cells) {
    const key = `${cell.symbol}|${cell.direction}`;
    if (!blocks.has(key)) blocks.set(key, { symbol: cell.symbol, direction: cell.direction, cells: [] });
    blocks.get(key).cells.push(cell);
  }
  const weekdays = orderBy([...new Set(cells.map((cell) => cell.weekday))], WEEKDAYS);
  const phases = orderBy([...new Set(cells.map((cell) => cell.monthPhase))], PHASES);
  const scale = Math.max(...cells.filter((cell) => cell.sufficient).map((cell) => Math.abs(cell.realisedReturn)), 0) || Math.max(...cells.map((cell) => Math.abs(cell.realisedReturn)), 1);
  const supported = cells.filter((cell) => cell.sufficient).length;

  return (
    <div className="stack timing-heatmap" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 2 }}>
        <h4>{grid.title ?? 'Realised five-bar return by weekday and month phase'}</h4>
        <p className="meta">
          {blocks.size} instrument and direction pairs, {cells.length} cells. {supported} of them have the {grid.minimum ?? 20} instances a timing claim needs; the rest are hatched and should
          be read as noise.
        </p>
      </div>

      <div className="heatmap-blocks">
        {[...blocks.values()].map((block) => (
          <figure key={`${block.symbol}-${block.direction}`} className="heatmap-block">
            <figcaption>
              <strong>{block.symbol}</strong> <span className={`heatmap-side ${block.direction.toLowerCase()}`}>{humaniseValue(block.direction)}</span>
            </figcaption>
            <table>
              <thead>
                <tr>
                  <th />
                  {weekdays.map((day) => (
                    <th key={day} scope="col" title={humaniseValue(day)}>
                      {day.slice(0, 2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phases.map((phase) => (
                  <tr key={phase}>
                    <th scope="row">{humaniseValue(phase)}</th>
                    {weekdays.map((day) => {
                      const cell = block.cells.find((entry) => entry.weekday === day && entry.monthPhase === phase);
                      if (!cell) return <td key={day} className="none" />;
                      return (
                        <td key={day} className={cell.sufficient ? undefined : 'thin'} style={{ backgroundColor: cellColor(cell.realisedReturn, scale) }} title={`${humaniseValue(day)}, ${humaniseValue(phase).toLowerCase()} of month: ${cell.realisedReturn.toFixed(2)}% over ${cell.count} instances; model called ${Math.round(cell.expectedRate * 100)}% favourable`}>
                          <span className="num">{cell.realisedReturn >= 0 ? '+' : '−'}{Math.abs(cell.realisedReturn).toFixed(1)}</span>
                          <small className="num">n={cell.count}</small>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        ))}
      </div>

      <p className="meta heatmap-legend">
        <span><i className="swatch" style={{ background: cellColor(scale, scale) }} /> gained</span>
        <span><i className="swatch" style={{ background: cellColor(-scale, scale) }} /> lost</span>
        <span><i className="swatch thin" /> fewer than {grid.minimum ?? 20} instances</span>
        <span>Figures are the average realised return in percent.</span>
      </p>
    </div>
  );
}
