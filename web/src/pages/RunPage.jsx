import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Dialog, EmptyState, ErrorCallout, ProgressBar, StatusPill } from '../components/ui.jsx';
import { useRun } from '../hooks/useRun.js';
import { useRuns } from '../hooks/useRuns.jsx';
import { api } from '../lib/api.js';
import { formatCompact, formatDateTime, formatDuration } from '../lib/format.js';
import { runSymbols, runTitle } from '../lib/labels.js';
import { Link, navigate, useLocation } from '../lib/router.jsx';
import { DecisionDrawer } from './DecisionDrawer.jsx';
import { DecisionsView } from './DecisionsView.jsx';
import { ReportView } from './ReportView.jsx';
import { TheaterView } from './TheaterView.jsx';

const VIEWS = [
  { id: 'theater', label: 'Theater', icon: 'theater' },
  { id: 'report', label: 'Report', icon: 'report' },
  { id: 'decisions', label: 'Decisions', icon: 'decisions' },
];

export function RunPage({ id, view }) {
  const { run, connection } = useRun(id);
  const { pathname, searchParams } = useLocation();

  useEffect(() => {
    if (run) document.title = `${runTitle(run)} · Jev Backtest Lab`;
  }, [run?.id, run?.preset]);

  if (!run) {
    return connection === 'failed' ? (
      <EmptyState title="Backtest not found" action={<Link to="/" className="button primary">Back to backtests</Link>}>
        There is no run called {id} in results/.
      </EmptyState>
    ) : (
      <p className="meta" aria-live="polite">
        Loading the backtest…
      </p>
    );
  }

  const current = view ?? (run.status === 'running' ? 'theater' : 'report');
  const openDecision = (symbol, cutoff) => navigate(`${pathname}?decision=${encodeURIComponent(`${symbol}:${cutoff}`)}`, { scroll: false });
  const closeDecision = () => navigate(pathname, { scroll: false });

  return (
    <>
      <RunHeader run={run} connection={connection} />
      <nav className="view-tabs" aria-label="Backtest views">
        {VIEWS.map((item) => (
          <Link key={item.id} to={`/runs/${run.id}/${item.id}`} className="view-tab" aria-current={current === item.id ? 'page' : undefined}>
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
      {current === 'theater' && <TheaterView run={run} onOpenDecision={openDecision} />}
      {current === 'report' && <ReportView run={run} onOpenDecision={openDecision} />}
      {current === 'decisions' && <DecisionsView run={run} onOpenDecision={openDecision} />}
      <DecisionDrawer run={run} target={searchParams.get('decision')} onClose={closeDecision} />
    </>
  );
}

function RunHeader({ run, connection }) {
  const { refresh } = useRuns();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const now = useNow(run.status === 'running');
  const decided = run.symbols.reduce((sum, symbol) => sum + symbol.decisions.length, 0);
  const planned = run.symbols.reduce((sum, symbol) => sum + (symbol.cutoffs.length || run.settings?.cutoffs || 0), 0);
  const model = run.symbols.flatMap((symbol) => symbol.decisions).find((decision) => decision.model)?.model ?? run.model;
  const tokens = run.symbols.flatMap((symbol) => symbol.decisions).reduce((sum, decision) => sum + (decision.usage?.input_tokens ?? 0), 0);
  const elapsed = (run.finishedAt ? Date.parse(run.finishedAt) : now) - Date.parse(run.startedAt);
  const preparing = run.symbols.find((symbol) => symbol.status === 'running' && symbol.decisions.length === 0);

  async function cancel() {
    try {
      await api.cancel(run.id);
      setConfirmCancel(false);
      refresh();
    } catch (error) {
      setCancelError(error.message);
    }
  }

  return (
    <div className="page-heading run-heading">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Backtests</Link>
        <Icon name="chevron" size={16} />
        <span aria-current="page">{runTitle(run)}</span>
      </nav>
      <div className="heading-row">
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 16 }}>
            <h1>{runTitle(run)}</h1>
            <StatusPill status={run.status} />
          </div>
          <p className="run-facts">
            <span>{runSymbols(run)}</span>
            <span>
              {decided}
              {run.status === 'running' || decided < planned ? ` of ${planned}` : ''} decisions
            </span>
            <span>Started {formatDateTime(run.startedAt)}</span>
            <span>
              <Icon name="clock" size={16} /> {formatDuration(elapsed)}
            </span>
            {model && <span>{model}</span>}
            {tokens > 0 && <span>{formatCompact(tokens)} input tokens</span>}
          </p>
        </div>
        {run.status === 'running' && (
          <button type="button" className="button danger" onClick={() => setConfirmCancel(true)}>
            <Icon name="stop" />
            Cancel run
          </button>
        )}
      </div>

      {run.status === 'running' && (
        <div className="stack" style={{ gap: 8 }}>
          <ProgressBar value={decided} max={planned} label={`${decided} of ${planned} decisions`} />
          <span className="meta" aria-live="polite">
            {preparing ? `Fetching candles and choosing cutoffs for ${preparing.symbol}…` : `Jev has made ${decided} of ${planned} decisions.`}
          </span>
        </div>
      )}
      {connection === 'reconnecting' && <p className="callout warning">The live connection dropped. Reconnecting; decisions made meanwhile will appear when it returns.</p>}
      {run.error && <ErrorCallout title="The run stopped with an error">{run.error}</ErrorCallout>}

      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        eyebrow="Cancel run"
        title="Stop this backtest?"
        actions={
          <>
            <button type="button" className="button secondary" onClick={() => setConfirmCancel(false)}>
              Keep running
            </button>
            <button type="button" className="button danger" onClick={cancel}>
              <Icon name="stop" />
              Cancel run
            </button>
          </>
        }
      >
        <p>
          The run stops after the request in flight. The {decided} decisions made so far stay saved and appear in the report.
        </p>
        {cancelError && <ErrorCallout title="The run could not be cancelled">{cancelError}</ErrorCallout>}
      </Dialog>
    </div>
  );
}

function useNow(ticking) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}
