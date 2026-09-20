import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon.jsx';
import { ErrorCallout } from '../components/ui.jsx';
import { CalibrationPanel, ConfusionMatrix, CoverageCurve, DistributionBar } from './charts.jsx';
import { FitBox } from './FitBox.jsx';
import { AnswersPanel, VerdictCard } from './panels.jsx';
import { BaselineBars } from './ReportPanel.jsx';
import { ItemView } from './views/index.jsx';
import { DOMAIN_BY_ID } from '../../../demos/domains.js';
import { useDemoRun } from '../hooks/useDemoRun.js';
import { navigate, useLocation } from '../lib/router.jsx';

// Presenter mode: the demo as five full-screen beats, one idea each, stepped with the arrow keys.
// It is for recording and for showing someone the use case in a minute, so nothing scrolls and nothing
// generic is on screen: the demo supplies the words and the items, the runtime supplies the rest.

const BEATS = [
  { id: 'problem', label: 'The job' },
  { id: 'item', label: 'One item' },
  { id: 'answers', label: 'Typed answers' },
  { id: 'miss', label: 'Where it missed' },
  { id: 'proof', label: 'The whole run' },
];

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A story for a demo that has not written its own: honest, generic, and built from the run itself. */
function fallbackStory(demo, run) {
  const items = run.dataset?.items ?? [];
  const graded = Object.entries(run.gradesById);
  const right = graded.find(([, grade]) => grade.agree)?.[0];
  const wrong = graded.find(([, grade]) => !grade.agree)?.[0];
  const report = run.report ?? {};
  return {
    number: null,
    problem: { headline: demo.value, stat: items.length.toLocaleString('en-US'), statLabel: 'items in this dataset' },
    hero: { item: right ?? items[0]?.id, caption: 'One item from the dataset, exactly as the model is given it.' },
    answers: { caption: `${Object.keys(demo.questions).length} typed answers, each with a probability, become one decision.` },
    miss: { item: wrong ?? items[1]?.id ?? items[0]?.id, caption: wrong ? 'One the model got wrong, with the planted answer beside it.' : 'Another item from the same run.' },
    proof: {
      kpis: (report.kpis ?? []).slice(0, 3).map((kpi) => kpi.label),
      chart: report.curve ? 'curve' : report.matrix ? 'matrix' : 'distribution',
      closing: report.findings?.[0] ?? report.note ?? '',
    },
  };
}

export function Presenter({ demo }) {
  const { pathname, searchParams } = useLocation();
  const run = useDemoRun(demo);
  const [revealed, setRevealed] = useState(0);
  const [copied, setCopied] = useState(false);

  const beatIndex = Math.min(BEATS.length - 1, Math.max(0, Number(searchParams.get('beat') ?? 1) - 1));
  const beat = BEATS[beatIndex];
  const story = useMemo(() => (run.status === 'ready' ? (demo.present ?? fallbackStory(demo, run)) : null), [demo, run.status, run.gradesById, run.report]);
  const items = run.dataset?.items ?? [];
  const find = (id) => items.find((entry) => entry.id === id) ?? items[0] ?? null;

  const go = useCallback(
    (index) => {
      const params = new URLSearchParams(searchParams);
      params.set('present', '1');
      params.set('beat', String(Math.min(BEATS.length, Math.max(1, index + 1))));
      navigate(`${pathname}?${params}`, { replace: true, scroll: false });
    },
    [pathname, searchParams],
  );

  const exit = useCallback(() => navigate(pathname), [pathname]);

  const questionKeys = useMemo(() => {
    const all = Object.keys(demo.questions);
    const chosen = story?.answers?.reveal?.filter((key) => demo.questions[key]);
    return chosen?.length ? chosen : all;
  }, [demo, story]);

  // The answers beat reveals one answer at a time on its own; the arrow keys still move between beats.
  useEffect(() => {
    if (beat.id !== 'answers') return undefined;
    if (reducedMotion()) {
      setRevealed(questionKeys.length);
      return undefined;
    }
    setRevealed(0);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setRevealed(step);
      if (step >= questionKeys.length) clearInterval(timer);
    }, 900);
    return () => clearInterval(timer);
  }, [beat.id, questionKeys.length]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(event.key)) {
        event.preventDefault();
        if (beat.id === 'answers' && revealed < questionKeys.length) setRevealed(questionKeys.length);
        else go(beatIndex + 1);
      }
      if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        go(beatIndex - 1);
      }
      if (event.key === 'Escape' || event.key === 'p') exit();
      if (/^[1-5]$/.test(event.key)) go(Number(event.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beat.id, beatIndex, revealed, questionKeys.length, go, exit]);

  // The page behind must not scroll or show through while presenting.
  useEffect(() => {
    document.documentElement.classList.add('is-presenting');
    return () => document.documentElement.classList.remove('is-presenting');
  }, []);

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (run.status === 'loading') return <div className="presenter"><p className="meta presenter-loading">Loading the run…</p></div>;
  if (run.status === 'error') return <div className="presenter"><ErrorCallout title="The dataset could not be loaded">{run.error}</ErrorCallout></div>;

  const domain = DOMAIN_BY_ID[demo.domain];
  const hero = find(story.hero.item);
  const miss = find(story.miss.item);
  const subject = beat.id === 'miss' ? miss : hero;
  const result = subject ? run.resultsById[subject.id] : null;
  const grade = subject ? run.gradesById[subject.id] : null;
  const shownQuestions = Object.fromEntries(questionKeys.map((key) => [key, demo.questions[key]]));
  const kpis = (run.report?.kpis ?? []).filter((kpi) => story.proof.kpis?.includes(kpi.label)).slice(0, 3);
  const grades = Object.values(run.gradesById);

  // Rendered on the body: the page animates its content with a transform, and a transformed ancestor
  // would become the containing block of a fixed element, so the beats would not fill the screen.
  return createPortal(
    <div className={`presenter domain-${demo.domain} on-${beat.id}`} role="region" aria-label={`Presenting ${demo.title}`}>
      <main className="presenter-beat" key={beat.id} aria-live="polite">
        {beat.id === 'problem' && (
          <div className="beat-problem">
            <span className="eyebrow">{domain?.title}</span>
            <h1>{demo.title}</h1>
            <p className="beat-lede">{story.problem.headline}</p>
            <p className="beat-stat">
              <strong className="num">{story.problem.stat}</strong>
              <span>{story.problem.statLabel}</span>
            </p>
          </div>
        )}

        {beat.id === 'item' && hero && (
          <div className="beat-item">
            <header className="beat-head">
              <span className="eyebrow">One item · {hero.id}</span>
              <h2>{demo.itemLabel?.(hero) ?? hero.id}</h2>
            </header>
            <FitBox className="beat-stage panel">
              <ItemView view={demo.view} item={hero} context={run.context} demo={demo} result={null} compact />
            </FitBox>
            <p className="beat-caption">{story.hero.caption}</p>
          </div>
        )}

        {beat.id === 'answers' && hero && result && (
          <div className="beat-answers">
            <header className="beat-head">
              <span className="eyebrow">What came back · {hero.id}</span>
              <h2>{demo.itemLabel?.(hero) ?? hero.id}</h2>
            </header>
            <div className="beat-columns">
              <AnswersPanel questions={shownQuestions} answers={result.answers} revealed={revealed} collapsed />
              <div className={`beat-verdict${revealed >= questionKeys.length ? ' landed' : ''}`}>
                <VerdictCard demo={demo} result={result} grade={grade} context={run.context} />
              </div>
            </div>
            <p className="beat-caption">{story.answers.caption}</p>
          </div>
        )}

        {beat.id === 'miss' && miss && run.resultsById[miss.id] && (
          <div className="beat-answers beat-miss">
            <header className="beat-head">
              <span className="eyebrow">{grade && !grade.agree ? 'One it got wrong' : 'A harder one'} · {miss.id}</span>
              <h2>{demo.itemLabel?.(miss) ?? miss.id}</h2>
            </header>
            <div className="beat-columns">
              <FitBox className="beat-stage panel">
                <ItemView view={demo.view} item={miss} context={run.context} demo={demo} result={run.resultsById[miss.id]} compact />
              </FitBox>
              <VerdictCard demo={demo} result={run.resultsById[miss.id]} grade={grade} context={run.context} />
            </div>
            <p className="beat-caption">{story.miss.caption}</p>
          </div>
        )}

        {beat.id === 'proof' && run.report && (
          <div className="beat-proof">
            <header className="beat-head">
              <span className="eyebrow">
                The whole run · {items.length.toLocaleString('en-US')} items{run.run?.model ? ` · ${run.run.model}` : ''}
              </span>
            </header>
            <div className="beat-kpis">
              {kpis.map((kpi) => (
                <article key={kpi.label} className={`beat-kpi tone-${kpi.tone ?? 'plain'}`}>
                  <span>{kpi.label}</span>
                  <strong className="num">{kpi.value}</strong>
                  {kpi.context && <small>{kpi.context}</small>}
                </article>
              ))}
            </div>
            <FitBox className="beat-chart panel" floor={0.7}>
              {story.proof.chart === 'curve' && run.report.curve && <CoverageCurve curve={run.report.curve} />}
              {story.proof.chart === 'matrix' && run.report.matrix && <ConfusionMatrix matrix={run.report.matrix} />}
              {story.proof.chart === 'baselines' && run.report.baselines && <BaselineBars rows={run.report.baselines} />}
              {story.proof.chart === 'distribution' && run.report.distribution && <DistributionBar title={run.report.distributionTitle} items={run.report.distribution} />}
              {story.proof.chart === 'calibration' && <CalibrationPanel grades={grades} />}
            </FitBox>
            <p className="beat-closing">{story.proof.closing}</p>
          </div>
        )}
      </main>

      <footer className="presenter-bar">
        <span className="presenter-slug">
          {story.number ? <span className="num">{story.number}</span> : null}
          <strong>{demo.title}</strong>
        </span>
        <ol className="presenter-dots" aria-label="Beats">
          {BEATS.map((entry, index) => (
            <li key={entry.id}>
              <button type="button" className={index === beatIndex ? 'current' : index < beatIndex ? 'done' : undefined} onClick={() => go(index)} aria-current={index === beatIndex ? 'step' : undefined}>
                <span className="num">{index + 1}</span>
                <span className="dot-label">{entry.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <span className="presenter-tools">
          <button type="button" className="button ghost small" onClick={() => go(beatIndex - 1)} disabled={beatIndex === 0} aria-label="Previous beat">
            <Icon name="previous" size={16} />
          </button>
          <button type="button" className="button ghost small" onClick={() => go(beatIndex + 1)} disabled={beatIndex === BEATS.length - 1} aria-label="Next beat">
            <Icon name="next" size={16} />
          </button>
          <button type="button" className="button ghost small" onClick={copyLink}>
            <Icon name="copy" size={14} />
            {copied ? 'Copied' : 'Shot link'}
          </button>
          <button type="button" className="button ghost small" onClick={exit} aria-label="Leave presenter mode (Esc)">
            <Icon name="close" size={16} />
          </button>
        </span>
      </footer>
    </div>,
    document.body,
  );
}
