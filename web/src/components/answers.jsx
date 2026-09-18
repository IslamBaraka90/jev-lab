import { formatShare } from '../lib/format.js';
import { nearestLevel, optionLabel, QUESTION_LABELS } from '../lib/labels.js';
import { Icon } from './Icon.jsx';
import { Meter } from './ui.jsx';

// Jev's typed answers. The chosen option or the yes-probability carries the magenta accent; the rest of
// each distribution stays in the context gray.

export function Answer({ name, answer, question }) {
  if (!answer) return null;
  return (
    <div className="answer">
      <div className="answer-head">
        <strong>{QUESTION_LABELS[name] ?? name}</strong>
        {question?.instructions && <p className="meta">{question.instructions}</p>}
      </div>
      {answer.type === 'choice' && <ChoiceAnswer answer={answer} options={question ? Object.keys(question.criteria) : undefined} />}
      {answer.type === 'score' && <ScoreAnswer answer={answer} />}
      {answer.type === 'noul' && <NoulAnswer answer={answer} />}
    </div>
  );
}

export function ChoiceAnswer({ answer, options = Object.keys(answer.probabilities) }) {
  return (
    <div className="choice-answer">
      <ul className="probabilities">
        {options.map((option) => {
          const probability = answer.probabilities[option] ?? 0;
          const chosen = option === answer.choice;
          return (
            <li key={option} className={chosen ? 'chosen' : undefined}>
              <span className="option">
                {chosen ? <Icon name="check" size={16} title="Chosen" /> : <span className="check-space" aria-hidden="true" />}
                {optionLabel(option)}
              </span>
              <Meter value={probability} tone={chosen ? 'accent' : 'context'} label={`${optionLabel(option)}: ${formatShare(probability)}`} />
              <span className="value num">{formatShare(probability)}</span>
            </li>
          );
        })}
      </ul>
      <span className="meta">Confidence {formatShare(answer.confidence)}</span>
    </div>
  );
}

export function ScoreAnswer({ answer }) {
  const levels = Object.keys(answer.legend).length;
  const position = levels > 1 ? answer.score / (levels - 1) : 0;
  const nearest = nearestLevel(answer);
  return (
    <div className="score-answer">
      <div className="score-track" role="img" aria-label={`${answer.score.toFixed(2)} on a scale of 0 to ${levels - 1}, nearest level: ${nearest}`}>
        <span className="score-fill" style={{ width: `${position * 100}%` }} />
        {Array.from({ length: levels }, (_, level) => (
          <span key={level} className="score-tick" style={{ left: `${(level / (levels - 1)) * 100}%` }} />
        ))}
        <span className="score-marker" style={{ left: `${position * 100}%` }} />
      </div>
      <div className="score-ends meta">
        <span>{answer.legend[0]}</span>
        <span>{answer.legend[levels - 1]}</span>
      </div>
      <p className="score-read">
        <strong>{nearest}</strong>
        <span className="meta">
          {answer.score.toFixed(2)} of {levels - 1}, confidence {formatShare(answer.confidence)}
        </span>
      </p>
    </div>
  );
}

export function NoulAnswer({ answer }) {
  return (
    <div className="noul-answer">
      <Meter value={answer.noul} tone={answer.noul >= 0.5 ? 'accent' : 'context'} label={`${formatShare(answer.noul)} probability of yes`} />
      <span className="value">
        <strong className="num">{formatShare(answer.noul)}</strong> yes
      </span>
    </div>
  );
}

const SIGNAL_TONES = {
  bullish: { tone: 'long', glyph: '▲', label: 'Bullish' },
  bearish: { tone: 'short', glyph: '▼', label: 'Bearish' },
  neutral: { tone: 'flat', glyph: '●', label: 'Neutral' },
  'not directional': { tone: 'flat', glyph: '◆', label: 'Not directional' },
  unavailable: { tone: 'flat', glyph: '–', label: 'Unavailable' },
};

export function SignalChip({ signal }) {
  const { tone, glyph, label } = SIGNAL_TONES[signal] ?? SIGNAL_TONES.unavailable;
  return (
    <span className={`signal-chip ${tone}`}>
      <span aria-hidden="true">{glyph}</span>
      {label}
    </span>
  );
}

/** The technical indicators a state carried: a signal count, then each indicator. */
export function IndicatorSignals({ indicators, detailed = false }) {
  if (!indicators) return null;
  const { summary } = indicators;
  return (
    <div className="indicator-signals">
      <p className="meta">
        {summary.bullish} bullish, {summary.bearish} bearish, {summary.neutral} neutral
      </p>
      <ul className={detailed ? 'indicator-list' : 'indicator-grid'}>
        {indicators.indicators.map((indicator) => (
          <li key={indicator.name}>
            <span className="indicator-name">{indicator.name}</span>
            <SignalChip signal={indicator.signal} />
            {detailed && (
              <>
                <p className="indicator-explanation">{indicator.explanation}</p>
                <p className="meta">{indicator.signal_rule}</p>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
