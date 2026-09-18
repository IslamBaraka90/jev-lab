import { formatMoney } from '../../lib/format.js';

/**
 * Bookkeeping items: the selected line in the middle of its document, with debits and credits in their
 * own columns and the document's totals underneath.
 */
export function LedgerView({ item, context }) {
  const lines = (context?.items ?? []).filter((line) => line.documentId === item.documentId);
  const totals = lines.reduce(
    (sums, line) => ({ debit: sums.debit + (line.debit ?? 0), credit: sums.credit + (line.credit ?? 0) }),
    { debit: 0, credit: 0 },
  );
  const balanced = Math.abs(totals.debit - totals.credit) < 0.005;
  const currency = item.currency ?? context?.currency ?? 'USD';

  return (
    <div className="stack ledger-view" style={{ gap: 12 }}>
      <div className="row between">
        <span className="eyebrow">
          {item.documentId} · {item.date}
        </span>
        <span className={`badge ${balanced ? 'pass' : 'warn'}`}>{balanced ? 'Document balances' : 'Document does not balance'}</span>
      </div>

      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              <th scope="col">Line</th>
              <th scope="col">Account</th>
              <th scope="col">Memo</th>
              <th scope="col" className="num">
                Debit
              </th>
              <th scope="col" className="num">
                Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className={line.id === item.id ? 'selected' : undefined}>
                <th scope="row">{line.id}</th>
                <td>
                  {line.account} {line.accountName}
                </td>
                <td>{line.memo}</td>
                <td className="num">{line.debit ? formatMoney(line.debit, currency, { signed: false }) : '–'}</td>
                <td className="num">{line.credit ? formatMoney(line.credit, currency, { signed: false }) : '–'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Document totals
              </th>
              <td className="num">{formatMoney(totals.debit, currency, { signed: false })}</td>
              <td className="num">{formatMoney(totals.credit, currency, { signed: false })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
