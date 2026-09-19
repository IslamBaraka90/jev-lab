// A reusable aligned two-record view for identity candidates and portfolio pairs.

const readable = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
const show = (value) => {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export function ComparisonView({ item, demo }) {
  const [leftKey, rightKey] = demo.pairKeys ?? Object.keys(item).filter((key) => typeof item[key] === 'object').slice(0, 2);
  const left = item[leftKey] ?? {};
  const right = item[rightKey] ?? {};
  const rows = demo.comparisonRows?.(item);
  const fields = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return (
    <div className="comparison-view stack">
      {demo.comparisonTitle && <p className="comparison-goal"><strong>Goal</strong> · {demo.comparisonTitle(item)}</p>}
      <div className="table-scroll">
      <table className="data-table comparison-table">
        <thead><tr><th scope="col">Field</th><th scope="col">{readable(leftKey)}</th><th scope="col">{readable(rightKey)}</th></tr></thead>
        <tbody>{rows
          ? rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{show(row.left)}</td><td>{show(row.right)}</td></tr>)
          : fields.map((field) => <tr key={field}><th scope="row">{readable(field)}</th><td>{show(left[field])}</td><td>{show(right[field])}</td></tr>)}</tbody>
      </table>
      </div>
    </div>
  );
}
