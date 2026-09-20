import { currencyOf, formatField, humaniseKey } from '../../lib/humanise.js';

// Drawing a record nobody wrote a view for. Scalars become labelled facts, a nested record becomes a
// titled group, a list of records becomes a table, and long text is set as text. Nothing is printed
// as JSON and nothing is dropped: the fields a demo hides are the ones it names in `stage.hide`.

const isText = (value) => typeof value === 'string' && value.length > 70;
const isScalar = (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value);
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isRecordList = (value) => Array.isArray(value) && value.length > 0 && value.every(isRecord);

export function Facts({ entries, labels = {}, highlight = [], currency }) {
  if (!entries.length) return null;
  return (
    <dl className="facts record-facts">
      {entries.map(([key, value]) => (
        <div key={key} className={highlight.includes(key) ? 'highlight' : undefined}>
          <dt>{labels[key] ?? humaniseKey(key)}</dt>
          <dd className={typeof value === 'number' ? 'num' : undefined}>{formatField(key, value, { currency })}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecordTable({ rows, labels, currency }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => rows.some((row) => isScalar(row[key])));
  return (
    <div className="table-scroll">
      <table className="data-table compact record-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className={rows.some((row) => typeof row[column] === 'number') ? 'num' : undefined}>
                {labels[column] ?? humaniseKey(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((column) => (
                <td key={column} className={typeof row[column] === 'number' ? 'num' : undefined}>
                  {formatField(column, row[column], { currency: row.currency ?? currency })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One record and everything inside it, to any depth a dataset actually uses. */
export function Record({ record, labels = {}, hide = [], highlight = [], currency, depth = 0 }) {
  const entries = Object.entries(record).filter(([key, value]) => !hide.includes(key) && value !== undefined);
  const scalars = entries.filter(([, value]) => isScalar(value) && !isText(value));
  const texts = entries.filter(([, value]) => isText(value));
  const lists = entries.filter(([, value]) => Array.isArray(value));
  const groups = entries.filter(([, value]) => isRecord(value));
  const own = record.currency ?? currency;

  return (
    <div className="stack record" style={{ gap: 14 }}>
      <Facts entries={scalars} labels={labels} highlight={highlight} currency={own} />

      {texts.map(([key, value]) => (
        <blockquote key={key} className="record-text">
          <span className="eyebrow">{labels[key] ?? humaniseKey(key)}</span>
          <p className="reading">{value}</p>
        </blockquote>
      ))}

      {groups.length > 0 && (
        <div className={`record-groups${depth ? ' nested' : ''}`}>
          {groups.map(([key, value]) => (
            <section key={key} className="record-group">
              <h4>{labels[key] ?? humaniseKey(key)}</h4>
              <Record record={value} labels={labels} hide={hide} highlight={highlight} currency={own} depth={depth + 1} />
            </section>
          ))}
        </div>
      )}

      {lists.map(([key, value]) => (
        <section key={key} className="record-list">
          <h4>
            {labels[key] ?? humaniseKey(key)} <span className="meta num">{value.length}</span>
          </h4>
          {value.length === 0 ? (
            <p className="meta">None.</p>
          ) : isRecordList(value) ? (
            <RecordTable rows={value} labels={labels} currency={own} />
          ) : (
            <ul className="record-chips">
              {value.map((entry, index) => (
                <li key={index}>{isScalar(entry) ? formatField(key, entry, { currency: own }) : JSON.stringify(entry)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** The record view both generic stages share, reading a demo's optional `stage` hints. */
export function ItemRecord({ item, demo, context }) {
  const stage = demo?.stage ?? {};
  return <Record record={item} labels={stage.labels} hide={['id', ...(stage.hide ?? [])]} highlight={stage.highlight} currency={currencyOf(item, context)} />;
}
