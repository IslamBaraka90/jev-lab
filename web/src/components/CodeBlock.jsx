import { Icon } from './Icon.jsx';
import { repoFile } from '../lib/links.js';
import { highlight } from '../lib/highlight.js';

// A snippet of the project's own source, with its path and line range. Highlighting is deliberately
// small: comments, strings, numbers and keywords, and nothing else. A syntax library would cost more
// than the whole demo runtime.

export function CodeBlock({ entry, caption }) {
  if (!entry) return null;
  const lines = entry.startLine ? `lines ${entry.startLine}–${entry.endLine}` : 'whole file';

  return (
    <figure className="code-block">
      <figcaption>
        <span className="code-path mono">{entry.path}</span>
        <span className="meta">{lines}</span>
        <span className="code-actions">
          <button type="button" className="button ghost" onClick={() => navigator.clipboard?.writeText(entry.path)}>
            <Icon name="copy" size={14} />
            Copy path
          </button>
          <a className="button ghost" href={repoFile(entry.path, entry)} target="_blank" rel="noreferrer">
            <Icon name="code" size={14} />
            Open
          </a>
        </span>
      </figcaption>
      {entry.code ? (
        <pre className="code" tabIndex={0}>
          <code dangerouslySetInnerHTML={{ __html: highlight(entry.code) }} />
        </pre>
      ) : (
        <p className="meta code-missing">This step is a whole file rather than a marked region; open it to read it.</p>
      )}
      {caption && <p className="meta code-caption">{caption}</p>}
    </figure>
  );
}
