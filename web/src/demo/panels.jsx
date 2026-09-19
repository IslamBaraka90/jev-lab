import { useState } from 'react';
import { Answer } from '../components/answers.jsx';
import { Icon } from '../components/Icon.jsx';

// The three panels every demo page shows around its stage: what went to the model, what came back,
// and what the demo made of it.

/** The exact JSON the model receives, with its size, because size is cost. */
export function StatePanel({ state }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(state, null, 2);
  const bytes = new TextEncoder().encode(text).length;
  const tokens = Math.round(text.length / 4);

  return (
    <section className="panel state-panel stack" aria-labelledby="state-title" style={{ gap: 12 }}>
      <div className="row between">
        <div className="stack" style={{ gap: 4 }}>
          <h3 id="state-title">State sent to Jev</h3>
          <p className="meta">
            {(bytes / 1024).toFixed(1)} KB · roughly {tokens.toLocaleString('en-US')} tokens · nothing else is sent
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

/** Every answer, in the order the questions were asked. */
export function AnswersPanel({ questions, answers, revealed = Infinity }) {
  const names = Object.keys(questions);
  return (
    <section className="panel answers-panel stack" aria-labelledby="answers-title" style={{ gap: 12 }}>
      <h3 id="answers-title">Answers</h3>
      {names.slice(0, revealed).map((name) => (
        <Answer key={name} name={name} answer={answers?.[name]} question={questions[name]} />
      ))}
      {revealed < names.length && <p className="meta">{names.length - revealed} more coming…</p>}
    </section>
  );
}

const TITLE = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());

/** What the demo derived from the answers: the flag, the action, the grade. */
export function EvaluationStrip({ evaluation }) {
  if (!evaluation) return null;
  const entries = Object.entries(evaluation).filter(([key, value]) => key !== 'label' && value !== null && value !== undefined && typeof value !== 'object');

  return (
    <section className="panel evaluation-strip" aria-label="What the demo made of it">
      {evaluation.label && <strong className="evaluation-label">{evaluation.label}</strong>}
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{TITLE(key)}</dt>
            <dd className={typeof value === 'number' ? 'num' : undefined}>
              {typeof value === 'boolean' ? (
                <span className={`badge ${value ? 'warn' : 'pass'}`}>
                  <Icon name={value ? 'alert' : 'check'} size={14} />
                  {value ? 'Yes' : 'No'}
                </span>
              ) : typeof value === 'number' ? (
                value.toFixed(2).replace(/\.00$/, '')
              ) : (
                String(value).toLowerCase().replaceAll('_', ' ')
              )}
            </dd>
          </div>
        ))}
      </dl>
      {evaluation.call && (
        <div className="evaluation-call">
          <span className="eyebrow">The call this builds</span>
          <pre className="state-json call-json">{JSON.stringify(evaluation.call, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}
