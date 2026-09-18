import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataBanner } from '../components/DataBanner.jsx';
import { DataChip } from '../components/DataChip.jsx';
import { Icon } from '../components/Icon.jsx';
import { Dialog, ErrorCallout, Segmented } from '../components/ui.jsx';
import { AnswersPanel, EvaluationStrip, StatePanel } from './panels.jsx';
import { HowItWorks } from './HowItWorks.jsx';
import { ItemView } from './views/index.jsx';
import { ReportPanel } from './widgets.jsx';
import { useDemoRun } from '../hooks/useDemoRun.js';
import { estimateRun, liveAvailable } from '../lib/mode.js';
import { navigate, useLocation } from '../lib/router.jsx';

// One page shape for every demo: pick an item, watch it read, decide and get scored, then read the
// report over the whole dataset. Demos supply data, questions and evaluation; none of this changes.

const PHASES = [
  { id: 'reading', label: 'Reads the item' },
  { id: 'deciding', label: 'Answers' },
  { id: 'checking', label: 'Checks' },
  { id: 'scored', label: 'Scored' },
];

const SPEEDS = [1, 2, 4, 8];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function DemoRuntime({ demo }) {
  const { pathname, searchParams } = useLocation();
  const [live, setLive] = useState(false);
  const [confirmingLive, setConfirmingLive] = useState(false);
  const state = useDemoRun(demo, { live });
  const [phase, setPhase] = useState('idle');
  const [revealed, setRevealed] = useState(0);
  const [speed, setSpeed] = useState(2);
  const playing = useRef(false);

  const wantedItem = searchParams.get('item');
  const wantedPhase = searchParams.get('phase');
  const present = searchParams.get('present') === '1';

  const items = state.dataset?.items ?? [];
  const item = items.find((entry) => entry.id === wantedItem) ?? items[0] ?? null;
  const result = item ? state.resultsById[item.id] : null;
  const questionCount = Object.keys(demo.questions).length;
  const estimate = estimateRun(items.length, questionCount);
  const pending = demo.status === 'pending-recording' && !live;

  const select = useCallback(
    (id) => {
      const params = new URLSearchParams(searchParams);
      params.set('item', id);
      navigate(`${pathname}?${params}`, { scroll: false });
    },
    [pathname, searchParams],
  );

  /** Plays one item through the four steps, or jumps straight to the answer when motion is off. */
  const play = useCallback(
    async (target, { instant = false } = {}) => {
      if (!target) return;
      const quick = instant || reducedMotion();
      const beat = quick ? 0 : 1;
      setRevealed(0);
      setPhase('reading');
      if (beat) await sleep(600 / speed);
      setPhase('deciding');
      await state.run(target);
      if (beat) {
        for (let index = 1; index <= questionCount; index++) {
          setRevealed(index);
          await sleep(220 / speed);
        }
      }
      setRevealed(questionCount);
      setPhase('checking');
      if (beat) await sleep(360 / speed);
      setPhase('scored');
    },
    [state.run, speed, questionCount],
  );

  // A selected item that has already been answered shows its finished state; anything else waits.
  useEffect(() => {
    if (!item) return;
    if (state.resultsById[item.id]) {
      setPhase('scored');
      setRevealed(questionCount);
    } else if (!playing.current) {
      setPhase('idle');
      setRevealed(0);
    }
  }, [item?.id, state.resultsById[item?.id]]);

  // ?phase=scored opens an item already played out, for a shot list or a link into the middle of a run.
  useEffect(() => {
    if (item && wantedPhase === 'scored' && !state.resultsById[item.id] && state.status === 'ready') {
      play(item, { instant: true });
    }
  }, [item?.id, wantedPhase, state.status]);

  const playAll = useCallback(async () => {
    if (playing.current) {
      playing.current = false;
      return;
    }
    playing.current = true;
    for (const entry of items) {
      if (!playing.current) break;
      select(entry.id);
      await play(entry);
    }
    playing.current = false;
  }, [items, play, select]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select, dialog[open]') || event.metaKey || event.ctrlKey || event.altKey) return;
      const index = items.findIndex((entry) => entry.id === item?.id);
      if (event.key === 'ArrowRight' && index < items.length - 1) select(items[index + 1].id);
      if (event.key === 'ArrowLeft' && index > 0) select(items[index - 1].id);
      if (event.key === ' ' && !event.target.closest('button, a')) {
        event.preventDefault();
        play(item);
      }
      if (event.key === 'p') {
        const params = new URLSearchParams(searchParams);
        if (present) params.delete('present');
        else params.set('present', '1');
        navigate(`${pathname}?${params}`, { scroll: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, item?.id, play, present, pathname, searchParams]);

  if (state.status === 'loading') return <p className="meta">Loading the dataset…</p>;
  if (state.status === 'error') return <ErrorCallout title="The dataset could not be loaded">{state.error}</ErrorCallout>;

  const phaseIndex = PHASES.findIndex((entry) => entry.id === phase);

  return (
    <div className={`demo-runtime${present ? ' presenting' : ''}`}>
      {!present && <DataBanner demo={demo} live={live} />}

      {pending && (
        <p className="callout warning pending-recording">
          <strong>No recorded answers yet.</strong> The dataset, the questions and the report are built; the answers are
          recorded once with <code>npm run record {demo.id}</code> and committed. Until then this page shows the data, the
          state that would be sent, and the code behind it.
        </p>
      )}

      <div className="demo-layout">
        {!present && (
          <aside className="panel item-rail" aria-label="Items">
            <div className="rail-head">
              <strong>{items.length} items</strong>
              <span className="meta">{state.results.length} answered</span>
            </div>
            <ul>
              {items.map((entry) => {
                const answered = state.resultsById[entry.id];
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={`rail-item${entry.id === item?.id ? ' current' : ''}${answered ? ' answered' : ''}`}
                      onClick={() => select(entry.id)}
                      aria-current={entry.id === item?.id ? 'true' : undefined}
                    >
                      <span className="rail-label">{demo.itemLabel?.(entry) ?? entry.id}</span>
                      {answered && <span className="meta rail-result">{answered.evaluation.label ?? 'answered'}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        <div className="demo-main stack">
          <section className="panel stage stack" aria-labelledby="stage-title" style={{ gap: 16 }}>
            <header className="row between">
              <div className="stack" style={{ gap: 4 }}>
                <span className="eyebrow">
                  Item {items.findIndex((entry) => entry.id === item?.id) + 1} of {items.length}
                </span>
                <h2 id="stage-title">{demo.itemLabel?.(item) ?? item?.id}</h2>
              </div>
              <ol className="phase-steps" aria-label="Step">
                {PHASES.map((entry, index) => (
                  <li key={entry.id} className={index < phaseIndex ? 'done' : index === phaseIndex ? 'active' : undefined}>
                    <span className="step-num">{index < phaseIndex ? <Icon name="check" size={16} /> : index + 1}</span>
                    <span className="step-label">{entry.label}</span>
                  </li>
                ))}
              </ol>
            </header>

            {item && <ItemView view={demo.view} item={item} context={state.context} demo={demo} />}
          </section>

          <section className="panel playback" aria-label="Run controls">
            <button type="button" className="button primary" onClick={() => play(item)} disabled={!item || pending}>
              <Icon name="play" />
              Run this item
            </button>
            <button type="button" className="button secondary" onClick={playAll} disabled={pending}>
              <Icon name={playing.current ? 'pause' : 'latest'} />
              {playing.current ? 'Stop' : 'Play all'}
            </button>
            <Segmented label="Speed" size="small" options={SPEEDS.map((value) => ({ value, label: `${value}×` }))} value={speed} onChange={setSpeed} />
            <span className="meta">
              {state.results.length} of {items.length} answered
            </span>
            <button type="button" className="button ghost" onClick={state.clear} disabled={state.results.length === 0}>
              <Icon name="restart" />
              Reset
            </button>
            {liveAvailable && (
              <button
                type="button"
                className={`button ${live ? 'danger' : 'ghost'}`}
                onClick={() => (live ? setLive(false) : setConfirmingLive(true))}
                title="Live runs call the TypeSafe API with your key"
              >
                <Icon name="bolt" />
                {live ? 'Live: on' : 'Run live'}
              </button>
            )}
          </section>

          {phaseIndex >= 1 && result && <AnswersPanel questions={demo.questions} answers={result.answers} revealed={revealed || questionCount} />}
          {phaseIndex >= 2 && result && <EvaluationStrip evaluation={result.evaluation} />}
          {result && <StatePanel state={result.state} />}
          <ReportPanel report={state.report} onSelect={select} />
          {!present && <HowItWorks demo={demo} />}
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
                state.clear();
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
          Every item you run then calls the TypeSafe API with your key. Playing the whole dataset would send{' '}
          <strong>{estimate.requests} requests</strong>, roughly {Math.round(estimate.inputTokens / 1000)}K input tokens.
        </p>
        <p className="meta">Results already on screen are cleared, so recorded and live answers never mix.</p>
      </Dialog>

      {!present && state.dataset && (
        <footer className="demo-foot">
          <DataChip dataset={state.dataset} file={`demos/${demo.id}/data.json`} />
        </footer>
      )}
    </div>
  );
}
