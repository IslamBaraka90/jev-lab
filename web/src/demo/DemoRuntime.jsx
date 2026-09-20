import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataChip } from '../components/DataChip.jsx';
import { Icon } from '../components/Icon.jsx';
import { Dialog, ErrorCallout, Segmented } from '../components/ui.jsx';
import { AnswersPanel, StatePanel, VerdictCard } from './panels.jsx';
import { HowItWorks } from './HowItWorks.jsx';
import { ItemRail } from './ItemRail.jsx';
import { ReportPanel } from './ReportPanel.jsx';
import { RunChip } from './RunChip.jsx';
import { ItemView } from './views/index.jsx';
import { KpiRow } from './widgets.jsx';
import { useDemoRun } from '../hooks/useDemoRun.js';
import { agreement, percent } from '../../../demos/lib/metrics.js';
import { estimateRun, liveAvailable } from '../lib/mode.js';
import { navigate, useLocation } from '../lib/router.jsx';

// One page shape for every demo, result first: the run's headline numbers, then one item with its
// typed answers and the decision they make, then the whole report. Replaying is animation over a run
// that is already graded; only a live run has to wait for anything.

const PHASES = [
  { id: 'reading', label: 'Reads the item' },
  { id: 'deciding', label: 'Answers' },
  { id: 'checking', label: 'Decides' },
  { id: 'scored', label: 'Graded' },
];

const SPEEDS = [1, 2, 4];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function DemoRuntime({ demo }) {
  const { pathname, searchParams } = useLocation();
  const [live, setLive] = useState(false);
  const [confirmingLive, setConfirmingLive] = useState(false);
  const run = useDemoRun(demo, { live });
  const [phase, setPhase] = useState('scored');
  const [revealed, setRevealed] = useState(Infinity);
  const [speed, setSpeed] = useState(2);
  const [touring, setTouring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [idFilter, setIdFilter] = useState(null);
  const tour = useRef(false);

  const items = run.dataset?.items ?? [];
  const wantedItem = searchParams.get('item');
  const item = items.find((entry) => entry.id === wantedItem) ?? items[0] ?? null;
  const index = item ? items.indexOf(item) : -1;
  const result = item ? run.resultsById[item.id] : null;
  const grade = item ? run.gradesById[item.id] : null;
  const questionCount = Object.keys(demo.questions).length;
  const estimate = estimateRun(items.length, questionCount);
  const pending = demo.status === 'pending-recording' && !live;
  const grades = useMemo(() => Object.values(run.gradesById), [run.gradesById]);
  const graded = useMemo(() => agreement(grades), [grades]);
  const itemState = useMemo(() => run.stateFor(item), [run.stateFor, item?.id]);

  const select = useCallback(
    (id) => {
      const params = new URLSearchParams(searchParams);
      params.set('item', id);
      navigate(`${pathname}?${params}`, { scroll: false });
    },
    [pathname, searchParams],
  );

  const openItem = useCallback(
    (id) => {
      select(id);
      document.getElementById('workbench')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    },
    [select],
  );

  const filterTo = useCallback(
    (label, ids) => {
      setIdFilter({ label, ids: new Set(ids) });
      if (ids[0]) openItem(ids[0]);
    },
    [openItem],
  );

  /** Plays one item through its four steps. A live item is asked for first; a recorded one already has its answer. */
  const play = useCallback(
    async (target) => {
      if (!target) return;
      setError(null);
      const quick = reducedMotion();
      setRevealed(0);
      setPhase('reading');
      try {
        if (live && !run.resultsById[target.id]) {
          setBusy(true);
          await run.runLive(target);
        } else if (!quick) {
          await sleep(700 / speed);
        }
      } catch (failure) {
        setError(failure.message);
        setPhase('scored');
        setRevealed(Infinity);
        return;
      } finally {
        setBusy(false);
      }
      setPhase('deciding');
      if (!quick) {
        for (let step = 1; step <= questionCount; step++) {
          setRevealed(step);
          await sleep(320 / speed);
        }
      }
      setRevealed(Infinity);
      setPhase('checking');
      if (!quick) await sleep(500 / speed);
      setPhase('scored');
    },
    [live, run.resultsById, run.runLive, speed, questionCount],
  );

  // Choosing an item shows it finished. The steps are something you ask to watch, not something you wait through.
  useEffect(() => {
    if (tour.current) return;
    setPhase('scored');
    setRevealed(Infinity);
  }, [item?.id]);

  const toggleTour = useCallback(async () => {
    if (tour.current) {
      tour.current = false;
      setTouring(false);
      return;
    }
    tour.current = true;
    setTouring(true);
    for (const entry of items.slice(Math.max(index, 0))) {
      if (!tour.current) break;
      select(entry.id);
      await play(entry);
      if (!reducedMotion()) await sleep(900 / speed);
    }
    tour.current = false;
    setTouring(false);
  }, [items, index, play, select, speed]);

  useEffect(() => () => void (tour.current = false), []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select, button, a, summary, dialog[open]') || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.key === 'j' || event.key === 'ArrowRight') && index < items.length - 1) select(items[index + 1].id);
      if ((event.key === 'k' || event.key === 'ArrowLeft') && index > 0) select(items[index - 1].id);
      if (event.key === ' ') {
        event.preventDefault();
        play(item);
      }
      if (event.key === 'p') navigate(`${pathname}?present=1`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, index, item?.id, play, select, pathname]);

  if (run.status === 'loading') return <p className="meta" aria-live="polite">Loading the run…</p>;
  if (run.status === 'error') return <ErrorCallout title="The dataset could not be loaded">{run.error}</ErrorCallout>;

  const phaseIndex = PHASES.findIndex((entry) => entry.id === phase);
  const showAnswers = result && phaseIndex >= 1;
  const showVerdict = result && phaseIndex >= 2;
  const headline = run.report?.kpis ?? [];

  return (
    <div className="demo-runtime">
      <RunChip demo={demo} run={run.run} live={live} items={items.length} graded={graded} />

      {demo.caveat && <p className="callout warning demo-caveat">{demo.caveat}</p>}

      {pending && (
        <p className="callout warning pending-recording">
          <strong>No recorded answers yet.</strong> The dataset, the questions and the report are built; the answers are recorded once with{' '}
          <code>npm run record {demo.id}</code> and committed. Until then this page shows the data, the state that would be sent, and the code behind it.
        </p>
      )}

      {run.report && (
        <section className="headline-strip stack" aria-label="What this run found" style={{ gap: 12 }}>
          <KpiRow kpis={headline} limit={5} />
          {run.report.findings?.[0] && (
            <p className="headline-finding">
              <Icon name="info" size={18} />
              <span>{run.report.findings[0]}</span>
              <a href="#report" className="headline-link">
                Read the full report
                <Icon name="chevron" size={14} />
              </a>
            </p>
          )}
        </section>
      )}

      <div className="demo-layout" id="workbench">
        <ItemRail
          demo={demo}
          items={items}
          current={item}
          resultsById={run.resultsById}
          gradesById={run.gradesById}
          idFilter={idFilter}
          onClearIdFilter={() => setIdFilter(null)}
          onSelect={select}
        />

        <div className="demo-main stack">
          <div className="workbench">
            <div className="workbench-item stack">
              <section className="panel stage stack" aria-labelledby="stage-title" style={{ gap: 16 }}>
                <header className="stage-head">
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="eyebrow">
                      Item {index + 1} of {items.length}
                      {item ? ` · ${item.id}` : ''}
                    </span>
                    <h2 id="stage-title">{demo.itemLabel?.(item) ?? item?.id}</h2>
                  </div>
                  <div className="stage-nav">
                    <button type="button" className="button ghost icon-only" onClick={() => index > 0 && select(items[index - 1].id)} disabled={index <= 0} aria-label="Previous item (k)">
                      <Icon name="previous" size={18} />
                    </button>
                    <button type="button" className="button ghost icon-only" onClick={() => index < items.length - 1 && select(items[index + 1].id)} disabled={index >= items.length - 1} aria-label="Next item (j)">
                      <Icon name="next" size={18} />
                    </button>
                  </div>
                </header>
                {item && <ItemView view={demo.view} item={item} context={run.context} demo={demo} result={phase === 'scored' ? result : null} />}
              </section>

              {showVerdict && <VerdictCard demo={demo} result={result} grade={grade} context={run.context} />}
            </div>

            <div className="workbench-answers stack">
              <section className="panel playback" aria-label="Replay">
                <ol className="phase-steps" aria-label="Step">
                  {PHASES.map((entry, step) => (
                    <li key={entry.id} className={step < phaseIndex || phase === 'scored' ? 'done' : step === phaseIndex ? 'active' : undefined}>
                      <span className="step-num">{step < phaseIndex || phase === 'scored' ? <Icon name="check" size={14} /> : step + 1}</span>
                      <span className="step-label">{entry.label}</span>
                    </li>
                  ))}
                </ol>
                <div className="playback-actions">
                  <button type="button" className="button primary" onClick={() => play(item)} disabled={!item || pending || busy || touring}>
                    <Icon name={live && !result ? 'bolt' : 'play'} />
                    {live && !result ? 'Ask Jev' : 'Replay'}
                  </button>
                  <button type="button" className="button secondary" onClick={toggleTour} disabled={pending || live}>
                    <Icon name={touring ? 'pause' : 'latest'} />
                    {touring ? 'Stop' : 'Play the run'}
                  </button>
                  <Segmented label="Speed" size="small" options={SPEEDS.map((value) => ({ value, label: `${value}×` }))} value={speed} onChange={setSpeed} />
                </div>
                <p className="meta sr-hint">Space replays · j and k step through items · p presents</p>
              </section>

              {error && <ErrorCallout title="That item could not be answered">{error}</ErrorCallout>}

              {showAnswers ? (
                <AnswersPanel key={item.id} questions={demo.questions} answers={result.answers} revealed={revealed} />
              ) : (
                <section className="panel answers-panel answers-waiting" aria-live="polite">
                  <h3>Typed answers</h3>
                  <p className="meta">
                    {busy ? 'Asking Jev…' : live && !result ? `This item has not been asked yet. Asking it sends one request with ${questionCount} questions.` : phase === 'reading' ? 'Reading the item…' : 'No recorded answer for this item.'}
                  </p>
                </section>
              )}
            </div>
          </div>

          <StatePanel state={itemState} />

          <ReportPanel report={run.report} grades={grades} currency={run.context?.currency} onSelect={openItem} onFilter={filterTo} />

          <HowItWorks demo={demo} />
        </div>
      </div>

      <Dialog
        open={confirmingLive}
        onClose={() => setConfirmingLive(false)}
        eyebrow="Approval required"
        title="Switch this demo to live?"
        actions={
          <>
            <button type="button" className="button secondary" onClick={() => setConfirmingLive(false)}>
              Keep recorded answers
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                setLive(true);
                run.clearLive();
                setConfirmingLive(false);
              }}
            >
              <Icon name="bolt" />
              Run live
            </button>
          </>
        }
      >
        <p>
          Every item you ask then calls the TypeSafe API with your key. Asking the whole dataset would send <strong>{estimate.requests} requests</strong>, roughly{' '}
          {Math.round(estimate.inputTokens / 1000)}K input tokens.
        </p>
        <p className="meta">The recorded run is put aside, so recorded and live answers never mix. The report then covers only what you have asked.</p>
      </Dialog>

      <footer className="demo-foot">
        {run.dataset && <DataChip dataset={run.dataset} file={`demos/${demo.id}/data.json`} />}
        {liveAvailable && (
          <button type="button" className={`button ${live ? 'danger' : 'ghost'}`} onClick={() => (live ? setLive(false) : setConfirmingLive(true))} title="Live runs call the TypeSafe API with your key">
            <Icon name="bolt" />
            {live ? 'Live: on — back to the recorded run' : 'Run live'}
          </button>
        )}
        {graded.graded > 0 && (
          <span className="meta">
            {graded.right} of {graded.graded} graded items match ground truth ({percent(graded.share)})
          </span>
        )}
      </footer>
    </div>
  );
}
