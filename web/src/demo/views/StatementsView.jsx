const LINES = [
  ['revenue', 'Revenue'], ['grossProfit', 'Gross profit'], ['operatingIncome', 'Operating income'], ['netIncome', 'Net income'],
  ['operatingCashFlow', 'Operating cash flow'], ['capitalExpenditure', 'Capital expenditure'], ['totalDebt', 'Total debt'], ['cash', 'Cash & short-term investments'],
  ['receivables', 'Receivables'], ['inventory', 'Inventory'], ['equity', 'Equity'], ['dividendsPaid', 'Dividends paid'],
];
const amount = (number, currency) => Number.isFinite(number) ? number.toLocaleString('en-US', { style: 'currency', currency: currency ?? 'USD', notation: 'compact', maximumFractionDigits: 1 }) : '–';

export function StatementsView({ item, demo }) {
  const years = item.annualStatements;
  return <div className="stack statement-view" style={{ gap: 12 }}>
    <div className="stack" style={{ gap: 4 }}><span className="eyebrow">{item.id}</span><h3>{demo?.itemLabel?.(item) ?? item.symbol}</h3></div>
    {!years.length ? <div className="statement-empty"><strong>No issuer statements in the cache</strong><p>This instrument remains in the demo so the missing history is reported rather than silently dropped.</p></div> : <div className="table-scroll"><table className="data-table statement-table"><thead><tr><th>Statement line</th>{years.map((year) => <th key={year.fiscalYearEnd} className="num">{year.fiscalYearEnd}</th>)}</tr></thead><tbody>{LINES.map(([key, label]) => <tr key={key}><th scope="row">{label}</th>{years.map((year, index) => { const prior = years[index - 1]?.[key]; const current = year[key]; const change = Number.isFinite(current) && Number.isFinite(prior) && prior !== 0 ? (current - prior) / Math.abs(prior) : null; return <td key={year.fiscalYearEnd} className="num"><span>{amount(current, item.currency)}</span>{Number.isFinite(change) && <small className={`statement-change ${change >= 0 ? 'up' : 'down'}`}>{change >= 0 ? '↑' : '↓'} {Math.abs(change * 100).toFixed(1)}%</small>}</td>; })}</tr>)}</tbody></table></div>}
    <p className="meta">Amounts are cached provider values in {item.currency ?? 'the unavailable reporting currency'}. Null is shown as “–”; reported zero remains zero. Quarterly coverage: {item.cacheCoverage.quarterlyPeriods} periods.</p>
  </div>;
}
