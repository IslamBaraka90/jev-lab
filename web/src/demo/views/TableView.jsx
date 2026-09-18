// The fallback stage: an item's fields as a two-column table, with anything nested shown as JSON.
// Every demo renders with this before its own view exists.

const readable = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

const show = (value) => {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export function TableView({ item }) {
  return (
    <div className="table-scroll">
      <table className="data-table compact item-table">
        <tbody>
          {Object.entries(item).map(([key, value]) => (
            <tr key={key}>
              <th scope="row">{readable(key)}</th>
              <td className={typeof value === 'number' ? 'num' : undefined}>{show(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
