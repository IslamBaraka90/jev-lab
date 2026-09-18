import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Dialog, EmptyState, ErrorCallout, ProgressBar, Signed, StatusPill, Switch } from '../components/ui.jsx';
import { MixBar } from '../charts/small.jsx';
import { useRuns } from '../hooks/useRuns.jsx';
import { api } from '../lib/api.js';
import { formatCompact, formatDateTime, formatDuration, formatNumber, formatPercent } from '../lib/format.js';
import { runTitle } from '../lib/labels.js';
import { Link, navigate } from '../lib/router.jsx';

// Measured on the pilots: tokens per request without and with indicators, and seconds per request.
const TOKENS_PER_REQUEST = { plain: 9_300, indicators: 12_300 };
const SECONDS_PER_REQUEST = 1.3;

export function RunsPage() {
  const { runs, activeRunId, presets, settings, loading, error, refresh } = useRuns();
  const activeRun = runs.find((run) => run.id === activeRunId);

  useEffect(() => {
    document.title = 'Backtests · Jev Backtest Lab';
    if (window.location.hash === '#new-backtest') document.getElementById('new-backtest')?.scrollIntoView();
  }, []);

  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TypeSafe Jev · trade decision evaluation</span>
        <h1>Backtest lab</h1>
        <p>Run Jev on historical daily candles, watch every decision play out on the chart, and evaluate what the trades earned.</p>
      </div>

      {activeRun && (
        <section className="panel active-run" aria-label="Running backtest">
          <div className="row between">
            <div className="stack" style={{ gap: 4 }}>
              <span className="row">
                <StatusPill status="running" />
                <strong>{runTitle(activeRun)}</strong>
              </span>
              <span className="meta">
                {activeRun.symbols.map((symbol) => symbol.symbol).join(', ')} · started {formatDateTime(activeRun.startedAt)}
              </span>
            </div>
            <Link to={`/runs/${activeRun.id}/theater`} className="button primary">
              <Icon name="theater" />
              Watch live
            </Link>
          </div>
          <RunProgress run={activeRun} />
        </section>
      )}

      <div className="runs-layout">
        <NewBacktest presets={presets} settings={settings} activeRunId={activeRunId} onStarted={refresh} />

        <section className="stack" aria-labelledby="runs-title">
          <div className="section-title">
            <h2 id="runs-title">Runs</h2>
            <Link to="/compare" className="button ghost">
              <Icon name="compare" />
              Compare runs
            </Link>
          </div>
          {loading && <p className="meta">Loading runs…</p>}
          {error && (
            <ErrorCallout title="The runs could not be loaded">
              {error} Check that the server is running, then reload the page.
            </ErrorCallout>
          )}
          {!loading && !error && runs.length === 0 && (
            <EmptyState title="No backtests yet">Start the pilot to see Jev decide on 12 AAPL cutoffs. Runs you start from the command line appear here too.</EmptyState>
          )}
          {runs.length > 0 && <RunList runs={runs} />}
        </section>
      </div>
    </>
  );
}

function RunProgress({ run }) {
  const decided = run.symbols.reduce((sum, symbol) => sum + symbol.decided, 0);
  const planned = run.symbols.reduce((sum, symbol) => sum + symbol.planned, 0);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <ProgressBar value={decided} max={planned} label={`${decided} of ${planned} decisions`} />
      <span className="meta">
        {decided} of {planned} decisions
      </span>
    </div>
  );
}

function RunList({ runs }) {
  return (
    <ul className="run-list">
      {runs.map((run) => {
        const overall = run.overall;
        const currency = run.symbols.find((symbol) => symbol.currency)?.currency ?? 'USD';
        const decided = run.symbols.reduce((sum, symbol) => sum + symbol.decided, 0);
        const live = run.status === 'running';
        return (
          <li key={run.id} className={`run-card${live ? ' live' : ''}`}>
            <div className="run-card-head">
              <div className="stack" style={{ gap: 2 }}>
                <Link to={`/runs/${run.id}/${live ? 'theater' : 'report'}`} className="run-link">
                  {runTitle(run)}
                </Link>
                <span className="meta">
                  {run.symbols.map((symbol) => symbol.symbol).join(', ') || 'No symbols saved'} · {formatDateTime(run.startedAt)}
                </span>
              </div>
              <StatusPill status={run.status} />
            </div>

            {overall ? (
              <>
                <div className="run-mix">
                  <MixBar long={overall.long} short={overall.short} noTrade={overall.noTrade} />
                  <span className="meta">
                    {overall.long} long · {overall.short} short · {overall.noTrade} no trade
                  </span>
                </div>
                <dl className="run-stats">
                  <div>
                    <dt>Net return</dt>
                    <dd>
                      <Signed value={overall.totalNetReturnPct} />
                    </dd>
                  </div>
                  <div>
                    <dt>P&amp;L</dt>
                    <dd>
                      <Signed value={overall.totalPnl} kind="money" currency={currency} digits={0} />
                    </dd>
                  </div>
                  <div>
                    <dt>Win rate</dt>
                    <dd>{overall.winRatePct === null ? '–' : formatPercent(overall.winRatePct, { digits: 1, signed: false })}</dd>
                  </div>
                  <div>
                    <dt>Trades</dt>
                    <dd>{formatNumber(overall.trades)}</dd>
                  </div>
                </dl>
              </>
            ) : live ? (
              <RunProgress run={run} />
            ) : (
              <p className="meta">{decided} decisions saved before the run stopped.</p>
            )}

            <div className="run-card-actions">
              <Link to={`/runs/${run.id}/theater`} className="button ghost">
                <Icon name="theater" />
                {live ? 'Watch live' : 'Replay'}
              </Link>
              <Link to={`/runs/${run.id}/report`} className="button ghost">
                <Icon name="report" />
                Report
              </Link>
              <Link to={`/runs/${run.id}/decisions`} className="button ghost">
                <Icon name="decisions" />
                Decisions
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function NewBacktest({ presets, settings, activeRunId, onStarted }) {
  const [preset, setPreset] = useState('pilot');
  const [indicators, setIndicators] = useState(false);
  const [blind, setBlind] = useState(false);
  const [symbolsText, setSymbolsText] = useState('');
  const [cutoffs, setCutoffs] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!presets) return;
    setSymbolsText(presets[preset].symbols.join(', '));
    setCutoffs(String(presets[preset].cutoffs));
  }, [presets, preset]);

  const symbols = useMemo(
    () => [...new Set(symbolsText.split(/[\s,]+/).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))],
    [symbolsText],
  );
  const cutoffCount = Number(cutoffs);
  const valid = symbols.length > 0 && Number.isInteger(cutoffCount) && cutoffCount >= 1 && cutoffCount <= 200;
  const requests = valid ? symbols.length * cutoffCount : 0;
  const tokens = requests * (indicators ? TOKENS_PER_REQUEST.indicators : TOKENS_PER_REQUEST.plain);
  const name = `${preset === 'suite' ? 'Full suite' : 'Pilot'}${indicators ? ' with indicators' : ''}${blind ? ' (blind)' : ''}`;

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const { id } = await api.start({ preset, symbols, cutoffs: cutoffCount, indicators, blind });
      setConfirming(false);
      onStarted();
      navigate(`/runs/${id}/theater`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  if (!presets) return <section className="panel new-backtest" id="new-backtest" aria-busy="true" />;

  return (
    <section className="panel new-backtest stack" id="new-backtest" aria-labelledby="new-backtest-title">
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">New backtest</span>
        <h2 id="new-backtest-title">Choose what Jev decides on</h2>
      </div>

      <fieldset className="preset-options">
        <legend className="sr-only">Preset</legend>
        {Object.entries(presets).map(([key, value]) => (
          <label key={key} className={`preset-card${preset === key ? ' selected' : ''}`}>
            <input type="radio" name="preset" value={key} checked={preset === key} onChange={() => setPreset(key)} />
            <span className="stack" style={{ gap: 4 }}>
              <strong>{value.label}</strong>
              <span className="meta">
                {value.symbols.join(', ')} · {value.cutoffs} decisions {value.symbols.length > 1 ? 'each' : ''}
              </span>
              <span className="preset-count">{value.symbols.length * value.cutoffs} requests</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="stack" style={{ gap: 4 }}>
        <Switch label="Add technical indicators" hint="Ten indicators with their values, signals and explanations in every state." checked={indicators} onChange={setIndicators} />
        <Switch label="Blind mode" hint="Hide symbols and dates and rebase prices to 100, so Jev can't rely on remembered history." checked={blind} onChange={setBlind} />
      </div>

      <details>
        <summary>Adjust symbols and cutoffs</summary>
        <div className="details-content stack" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="symbols">Symbols</label>
            <span className="hint" id="symbols-hint">
              Yahoo Finance symbols separated by commas, such as AAPL, BTC-USD or GLD.
            </span>
            <input id="symbols" aria-describedby="symbols-hint" value={symbolsText} onChange={(event) => setSymbolsText(event.target.value)} autoComplete="off" spellCheck="false" />
          </div>
          <div className="field">
            <label htmlFor="cutoffs">Decisions per symbol</label>
            <span className="hint" id="cutoffs-hint">
              From 1 to 200, spread evenly over the last two years.
            </span>
            <input id="cutoffs" aria-describedby="cutoffs-hint" type="number" min="1" max="200" inputMode="numeric" value={cutoffs} onChange={(event) => setCutoffs(event.target.value)} />
          </div>
        </div>
      </details>

      <dl className="estimate">
        <div>
          <dt>Requests</dt>
          <dd>{formatNumber(requests)}</dd>
        </div>
        <div>
          <dt>Input tokens</dt>
          <dd>≈ {formatCompact(tokens)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>≈ {formatDuration(requests * SECONDS_PER_REQUEST * 1000)}</dd>
        </div>
      </dl>

      {activeRunId && <p className="callout warning">Another backtest is running. Wait for it to finish or cancel it before starting a new one.</p>}
      {!valid && <p className="field-error">Enter at least one symbol and a whole number of decisions from 1 to 200.</p>}

      <button type="button" className="button primary start-button" disabled={!valid || Boolean(activeRunId)} onClick={() => setConfirming(true)}>
        <Icon name="play" />
        Review and start
      </button>

      <Dialog
        open={confirming}
        onClose={() => !starting && setConfirming(false)}
        eyebrow="Approval required"
        title={`Start ${name.charAt(0).toLowerCase()}${name.slice(1)}?`}
        actions={
          <>
            <button type="button" className="button secondary" onClick={() => setConfirming(false)} disabled={starting}>
              Cancel
            </button>
            <button type="button" className="button primary" onClick={start} disabled={starting}>
              <Icon name="play" />
              {starting ? 'Starting…' : 'Start backtest'}
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 16 }}>
          <p>
            This sends <strong>{formatNumber(requests)} requests</strong> to Jev using your TypeSafe API key, about {formatCompact(tokens)} input tokens.
          </p>
          <dl className="confirm-list">
            <div>
              <dt>Symbols</dt>
              <dd>{symbols.join(', ')}</dd>
            </div>
            <div>
              <dt>Decisions</dt>
              <dd>
                {cutoffCount} per symbol over the last two years, each seeing up to {settings?.lookbackBars ?? 90} daily bars
              </dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>
                {indicators ? 'Prompt, candles and ten technical indicators' : 'Prompt and candles'}
                {blind ? ', with symbols and dates hidden' : ''}
              </dd>
            </div>
            <div>
              <dt>Scoring</dt>
              <dd>
                Trades enter at the next open, {settings?.costBpsPerSide ?? 5} bps per side, {formatNumber(settings?.notional ?? 10000)} per trade
              </dd>
            </div>
            <div>
              <dt>Estimated time</dt>
              <dd>{formatDuration(requests * SECONDS_PER_REQUEST * 1000)}</dd>
            </div>
          </dl>
          <p className="meta">You can cancel the run at any time; decisions made so far stay saved in results/.</p>
          {error && <ErrorCallout title="The backtest did not start">{error}</ErrorCallout>}
        </div>
      </Dialog>
    </section>
  );
}
