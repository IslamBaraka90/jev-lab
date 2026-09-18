import { CodeBlock } from '../components/CodeBlock.jsx';
import codeIndex from '../generated/code-index.json';

// The four steps behind every demo, in the same order every time, each showing the real file that
// does the work. The snippets come from `scripts/build-code-index.js`, which reads the sources at
// build time, so what is on screen is what is in the repository.

const STEPS = [
  { key: 'data', title: 'The data', caption: 'Where the dataset comes from, and how it was made.' },
  { key: 'state', title: 'The state', caption: 'One item turned into the JSON the model receives. Nothing else is sent.' },
  { key: 'questions', title: 'The questions', caption: 'Typed questions: options, rubrics and yes-or-no, defined once.' },
  { key: 'evaluate', title: 'The evaluation', caption: 'What the answers become, and how the report grades them.' },
];

export function HowItWorks({ demo }) {
  return (
    <section className="panel how-it-works stack" aria-labelledby="how-title" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h3 id="how-title">How it works</h3>
        <p className="meta">Four files, in order. These are the project's own sources, not a retyped illustration.</p>
      </div>

      <ol className="how-steps">
        {STEPS.map((step, index) => {
          const key = demo.explain?.[step.key];
          const entry = key ? codeIndex[key] : null;
          return (
            <li key={step.key}>
              <div className="how-step-head">
                <span className="chip num">{index + 1}</span>
                <strong>{step.title}</strong>
              </div>
              {entry ? <CodeBlock entry={entry} caption={step.caption} /> : <p className="meta">Not wired up yet.</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
