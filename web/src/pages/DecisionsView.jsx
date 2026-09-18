import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { ActionBadge, EmptyState, Segmented, Signed } from '../components/ui.jsx';
import { consistencyChecks, runDecisions } from '../lib/analytics.js';
import { formatDate, formatShare } from '../lib/format.js';
import { EXIT_REASONS } from '../lib/labels.js';

const OUTCOMES = [
  { value: 'all', label: 'All' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'flat', label: 'No trade' },
];

const COLUMNS = [
  { key: 'symbol', label: 'Symbol', value: (decision) => decision.symbol },
  { key: 'date', label: 'Date', value: (decision) => decision.date },
  { key: 'action', label: 'Action', value: (decision) => decision.action ?? '' },
  { key: 'confidence', label: 'Confidence', numeric: true, value: (decision) => decision.confidence ?? -1 },
  { key: 'plan', label: 'Stop / target / hold', value: (decision) => decision.plan?.stopLossPct ?? -1 },
  { key: 'exit', label: 'Exit', value: (decision) => decision.trade?.exitReason ?? '' },
  { key: 'net', label: 'Net return', numeric: true, value: (decision) => decision.trade?.netReturnPct ?? -Infinity },
  { key: 'pnl', label: 'P&L', numeric: true, value: (decision) => decision.trade?.pnl ?? -Infinity },
  { key: 'move', label: 'Move after', numeric: true, value: (decision) => decision.forwardReturnsPct?.at(-1) ?? -Infinity },
  { key: 'flags', label: 'Flags', numeric: true, value: (decision) => decision.flags },
];

export function DecisionsView({ run, onOpenDecision }) {
  const [symbol, setSymbol] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [sort, setSort] = useState({ key: 'date', direction: 'ascending' });

  const decisions = useMemo(() => {
    const all = runDecisions(run);
    const flags = new Map();
    for (const check of consistencyChecks(all)) {
      for (const decision of check.decisions) {
        const key = `${decision.symbol}:${decision.cutoff}`;
        flags.set(key, [...(flags.get(key) ?? []), check.label]);
      }
    }
    return all.map((decision) => {
      const labels = flags.get(`${decision.symbol}:${decision.cutoff}`) ?? [];
      return { ...decision, flags: labels.length, flagLabels: labels };
    });
  }, [run]);

  const visible = useMemo(() => {
    const column = COLUMNS.find((item) => item.key === sort.key);
    const filtered = decisions.filter((decision) => {
      if (symbol !== 'all' && decision.symbol !== symbol) return false;
      if (outcome === 'won') return decision.trade?.netReturnPct > 0;
      if (outcome === 'lost') return decision.trade?.netReturnPct <= 0;
      if (outcome === 'flat') return decision.action === 'NO_TRADE';
      return true;
    });
    return filtered.sort((a, b) => {
      const [left, right] = [column.value(a), column.value(b)];
      const order = typeof left === 'number' ? left - right : String(left).localeCompare(String(right));
      return (sort.direction === 'ascending' ? order : -order) || a.date.localeCompare(b.date);
    });
  }, [decisions, symbol, outcome, sort]);

  if (decisions.length === 0) return <EmptyState title="No decisions yet">Decisions appear here as soon as Jev answers.</EmptyState>;

  const toggleSort = (key) =>
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending' }));

  return (
    <section className="stack" aria-labelledby="decisions-title">
      <div className="filterbar">
        <div className="field">
          <label htmlFor="symbol-filter">Symbol</label>
          <select id="symbol-filter" value={symbol} onChange={(event) => setSymbol(event.target.value)}>
            <option value="all">All symbols</option>
            {run.symbols.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="label" id="outcome-label">
            Outcome
          </span>
          <Segmented label="Outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />
        </div>
        <p className="meta filter-summary" aria-live="polite">
          Showing {visible.length} of {decisions.length} decisions
        </p>
      </div>

      <h2 id="decisions-title" className="sr-only">
        Decisions
      </h2>
      <div className="table-scroll">
        <table className="data-table decisions-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} scope="col" className={column.numeric ? 'num' : undefined} aria-sort={sort.key === column.key ? sort.direction : 'none'}>
                  <button type="button" className="sort-button" onClick={() => toggleSort(column.key)}>
                    {column.label}
                    {sort.key === column.key && <Icon name={sort.direction === 'ascending' ? 'up' : 'down'} size={14} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((decision) => (
              <tr key={`${decision.symbol}-${decision.cutoff}`} className="clickable" onClick={() => onOpenDecision(decision.symbol, decision.cutoff)}>
                <th scope="row">
                  <button type="button" className="link-button" onClick={(event) => (event.stopPropagation(), onOpenDecision(decision.symbol, decision.cutoff))}>
                    {decision.symbol} #{decision.cutoff}
                  </button>
                </th>
                <td>{formatDate(decision.date)}</td>
                <td>
                  <ActionBadge action={decision.error ? null : decision.action} />
                </td>
                <td className="num">{formatShare(decision.confidence)}</td>
                <td>
                  {decision.plan
                    ? `${decision.plan.stopLossPct === null ? 'none' : `${decision.plan.stopLossPct}%`} / ${decision.plan.takeProfitPct === null ? 'none' : `${decision.plan.takeProfitPct}%`} / ${decision.plan.maxBars} bars`
                    : '–'}
                </td>
                <td>{decision.trade ? `${EXIT_REASONS[decision.trade.exitReason]}, ${decision.trade.barsHeld} bars` : '–'}</td>
                <td className="num">{decision.trade ? <Signed value={decision.trade.netReturnPct} /> : '–'}</td>
                <td className="num">{decision.trade ? <Signed value={decision.trade.pnl} kind="money" currency={decision.currency} /> : '–'}</td>
                <td className="num">
                  <Signed value={decision.forwardReturnsPct?.at(-1)} />
                </td>
                <td className="num">
                  {decision.flags ? (
                    <span className="badge warn" title={decision.flagLabels.join('\n')}>
                      <Icon name="alert" size={14} />
                      {decision.flags}
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
