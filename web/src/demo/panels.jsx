import { useState } from 'react';
import { ChoiceAnswer, NoulAnswer, ScoreAnswer } from '../components/answers.jsx';
import { Icon } from '../components/Icon.jsx';
import { Meter } from '../components/ui.jsx';
import { formatShare } from '../lib/format.js';
import { formatField, humaniseKey, humaniseValue } from '../lib/humanise.js';
import { nearestLevel, optionLabel, QUESTION_LABELS } from '../lib/labels.js';

// The panels around the stage: what the model answered, what the demo made of it and whether that
// was right, and the exact state that was sent.

const questionTitle = (name, question) => question?.title ?? QUESTION_LABELS[name] ?? humaniseKey(name);

/** The answer in a few words, for the collapsed row: the option, the rubric level, or yes and no. */
function summarise(answer) {
  if (!answer) return { text: '–', share: 0 };
  if (answer.type === 'choice') return { text: optionLabel(answer.choice), share: answer.probabilities?.[answer.choice] ?? answer.confidence ?? 0 };
  if (answer.type === 'score') {
    const top = Object.keys(answer.legend ?? {}).length - 1;
    return { text: `${nearestLevel(answer) ?? answer.score.toFixed(1)} · ${answer.score.toFixed(1)} of ${top}`, share: top ? answer.score / top : 0 };
  }
  return { text: answer.noul >= 0.5 ? 'Yes' : 'No', share: answer.noul };
}

function AnswerRow({ name, question, answer, open, onToggle }) {
  const summary = summarise(answer);
  // A rubric score sits between levels by design, so only a choice or a yes-or-no can be "unsure".
  const unsure = answer?.type === 'noul' ? Math.abs(answer.noul - 0.5) < 0.15 : answer?.type === 'choice' && (answer.confidence ?? 1) < 0.6;
  return (
    <li className={`answer-row${open ? ' open' : ''}`}>
      <button type="button" className="answer-summary" onClick={onToggle} aria-expanded={open}>
        <span className="answer-question">
          <span className={`answer-type type-${answer?.type}`}>{answer?.type === 'noul' ? 'yes / no' : answer?.type}</span>
          <strong>{questionTitle(name, question)}</strong>
        </span>
        <span className="answer-value">
          <strong>{summary.text}</strong>
          <Meter value={summary.share} tone="accent" label={`${summary.text}: ${formatShare(summary.share)}`} />
          <span className="num meta">{formatShare(summary.share)}</span>
        </span>
        {unsure && <span className="badge warn answer-unsure">unsure</span>}
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="answer-detail">
          {question?.instructions && <p className="meta">{question.instructions}</p>}
          {answer.type === 'choice' && <ChoiceAnswer answer={answer} options={question ? Object.keys(question.criteria) : undefined} />}
          {answer.type === 'score' && <ScoreAnswer answer={answer} />}
          {answer.type === 'noul' && <NoulAnswer answer={answer} />}
        </div>
      )}
    </li>
  );
}

/** Every answer as one line, in question order; any of them opens to its full distribution. */
export function AnswersPanel({ questions, answers, revealed = Infinity, collapsed = false }) {
  const names = Object.keys(questions);
  const [open, setOpen] = useState(() => new Set(collapsed ? [] : names.slice(0, 1)));
  const toggle = (name) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const allOpen = open.size === names.length;

  return (
    <section className="panel answers-panel stack" aria-labelledby="answers-title" style={{ gap: 12 }}>
      <div className="row between">
        <div className="stack" style={{ gap: 2 }}>
          <h3 id="answers-title">Typed answers</h3>
          <p className="meta">{names.length} questions, each answered with a probability rather than a sentence.</p>
        </div>
        <button type="button" className="button ghost small" onClick={() => setOpen(allOpen ? new Set() : new Set(names))}>
          {allOpen ? 'Collapse' : 'Expand'} all
        </button>
      </div>
      <ul className="answer-rows">
        {names.slice(0, revealed).map((name) => (
          <AnswerRow key={name} name={name} question={questions[name]} answer={answers?.[name]} open={open.has(name)} onToggle={() => toggle(name)} />
        ))}
      </ul>
      {revealed < names.length && <p className="meta answer-pending">{names.length - revealed} more coming…</p>}
    </section>
  );
}

const TONE_ICON = { good: 'check', bad: 'alert', warn: 'alert' };

function Fact({ label, value, tone }) {
  return (
    <div className={tone ? `tone-${tone}` : undefined}>
      <dt>{label}</dt>
      <dd>
        {tone && TONE_ICON[tone] && <Icon name={TONE_ICON[tone]} size={14} />}
        {value}
      </dd>
    </div>
  );
}

/**
 * What the demo made of the answers, and whether that was right. A demo may describe its own verdict
 * with `verdict(result, context)`; otherwise the evaluation's own fields are shown as they are, with
 * nothing coloured, because only the demo knows whether "yes" is good news.
 */
export function VerdictCard({ demo, result, grade, context }) {
  if (!result?.evaluation) return null;
  const { evaluation } = result;
  const custom = demo.verdict?.(result, context) ?? null;
  const facts =
    custom?.facts ??
    Object.entries(evaluation)
      .filter(([key, value]) => key !== 'label' && value !== null && value !== undefined && typeof value !== 'object')
      .slice(0, 8)
      .map(([key, value]) => ({
        label: humaniseKey(key),
        value: typeof value === 'number' ? value.toFixed(2).replace(/\.00$/, '') : formatField(key, value, { currency: context?.currency }),
      }));

  return (
    <section className={`panel verdict-card${grade ? (grade.agree ? ' agrees' : ' disagrees') : ''}`} aria-label="What the demo made of the answers">
      <div className="verdict-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">{custom?.eyebrow ?? 'The decision these answers make'}</span>
          <strong className="verdict-headline">{custom?.headline ?? evaluation.label ?? 'Answered'}</strong>
          {custom?.detail && <p className="meta">{custom.detail}</p>}
        </div>
        <GradeBadge grade={grade} />
      </div>

      {facts.length > 0 && (
        <dl className="verdict-facts">
          {facts.map((fact) => (
            <Fact key={fact.label} {...fact} />
          ))}
        </dl>
      )}

      {grade && !grade.agree && (grade.expected || grade.note) && (
        <p className="verdict-truth">
          <Icon name="info" size={16} />
          <span>
            {grade.expected && (
              <>
                The planted answer was <strong>{humaniseValue(grade.expected)}</strong>
                {grade.got ? (
                  <>
                    ; the model said <strong>{humaniseValue(grade.got)}</strong>
                  </>
                ) : null}
                .{' '}
              </>
            )}
            {grade.note}
          </span>
        </p>
      )}
      {grade?.agree && grade.note && (
        <p className="verdict-truth agrees">
          <Icon name="check" size={16} />
          <span>{grade.note}</span>
        </p>
      )}

      {evaluation.call && (
        <div className="evaluation-call">
          <span className="eyebrow">The call this builds</span>
          <pre className="state-json call-json">
            <code>
              <span className="call-endpoint">{evaluation.call.endpoint}</span>
              {'\n'}
              {JSON.stringify(evaluation.call.body, null, 2)}
            </code>
          </pre>
        </div>
      )}
    </section>
  );
}

export function GradeBadge({ grade, compact = false }) {
  if (!grade) return compact ? null : <span className="grade-badge ungraded">Not graded per item</span>;
  return (
    <span className={`grade-badge ${grade.agree ? 'agree' : 'disagree'}`}>
      <Icon name={grade.agree ? 'check' : 'close'} size={compact ? 12 : 16} />
      {!compact && (grade.agree ? 'Matches ground truth' : 'Differs from ground truth')}
    </span>
  );
}

/** The exact JSON the model receives, with its size, because size is cost. */
export function StatePanel({ state }) {
  const [open, setOpen] = useState(false);
  if (!state) return null;
  const text = JSON.stringify(state, null, 2);
  const bytes = new TextEncoder().encode(text).length;
  const tokens = Math.round(text.length / 4);

  return (
    <section className="panel state-panel stack" aria-labelledby="state-title" style={{ gap: 12 }}>
      <div className="row between">
        <div className="stack" style={{ gap: 4 }}>
          <h3 id="state-title">State sent to Jev</h3>
          <p className="meta">
            {(bytes / 1024).toFixed(1)} KB · roughly {tokens.toLocaleString('en-US')} tokens · this is everything the model sees, and no label is in it
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="button ghost" onClick={() => navigator.clipboard?.writeText(text)}>
            <Icon name="copy" size={16} />
            Copy
          </button>
          <button type="button" className="button secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {open ? 'Hide' : 'Show'} JSON
          </button>
        </div>
      </div>
      {open && <pre className="state-json">{text}</pre>}
    </section>
  );
}
