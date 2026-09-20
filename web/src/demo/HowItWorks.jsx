import { useState } from 'react';
import { CodeBlock } from '../components/CodeBlock.jsx';
import codeIndex from '../generated/code-index.json';

// The four files behind every demo, in the same order every time, each showing the real source that
// does the work. The snippets come from `scripts/build-code-index.js`, which reads the sources at
// build time, so what is on screen is what is in the repository.

const STEPS = [
  { key: 'data', title: 'The data', caption: 'Where the dataset comes from, and how it was made.' },
  { key: 'state', title: 'The state', caption: 'One item turned into the JSON the model receives. Nothing else is sent.' },
  { key: 'questions', title: 'The questions', caption: 'Typed questions: options, rubrics and yes-or-no, defined once.' },
  { key: 'evaluate', title: 'The evaluation', caption: 'What the answers become, and how the report grades them.' },
];

export function HowItWorks({ demo }) {
  const [active, setActive] = useState('state');
  const step = STEPS.find((entry) => entry.key === active);
  const key = demo.explain?.[step.key];
  const entry = key ? codeIndex[key] : null;

  return (
    <section className="panel how-it-works stack" id="how" aria-labelledby="how-title" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">The code</span>
        <h2 id="how-title">How it works</h2>
        <p className="meta">Four files, in order. These are the project's own sources, not a retyped illustration.</p>
      </div>

      <div className="how-tabs" role="tablist" aria-label="The four files">
        {STEPS.map((entryStep, index) => (
          <button key={entryStep.key} type="button" role="tab" id={`how-tab-${entryStep.key}`} aria-selected={active === entryStep.key} aria-controls="how-panel" className={`how-tab${active === entryStep.key ? ' selected' : ''}`} onClick={() => setActive(entryStep.key)}>
            <span className="how-tab-num num">{index + 1}</span>
            {entryStep.title}
          </button>
        ))}
      </div>

      <div id="how-panel" role="tabpanel" aria-labelledby={`how-tab-${active}`}>
        {entry ? <CodeBlock entry={entry} caption={step.caption} /> : <p className="meta">Not wired up yet.</p>}
      </div>
    </section>
  );
}
