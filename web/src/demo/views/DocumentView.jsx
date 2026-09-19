// A document on the stage: the thing itself, readable, with the period before it alongside where
// there is one. A filing in a two-column field table is a wall of text in one cell, and the whole
// point of these demos is that somebody can read what the model read.
//
// A demo hands it `item.text` and, optionally, `item.priorPeriod`, `item.title` and a few short
// fields for the header. Line breaks in the text are kept, because in a filing they carry the
// numbering.

const HEADER = ['ticker', 'company', 'sector', 'kind', 'quarter', 'publishedOn', 'words'];

const readable = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

export function DocumentView({ item, demo }) {
  if (typeof item.text !== 'string') return <p className="meta">This item has no document to show.</p>;

  return (
    <div className="stack document-view" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">{item.id}</span>
        <h3>{item.title ?? demo?.itemLabel?.(item) ?? item.id}</h3>
        <dl className="document-meta">
          {HEADER.filter((key) => item[key] !== undefined && item[key] !== null).map((key) => (
            <div key={key}>
              <dt>{readable(key)}</dt>
              <dd>{String(item[key])}</dd>
            </div>
          ))}
        </dl>
      </div>

      <article className="document-body">{item.text}</article>

      {item.priorPeriod ? (
        <details className="document-prior">
          <summary>The period before it</summary>
          <article className="document-body muted">{item.priorPeriod}</article>
        </details>
      ) : null}
    </div>
  );
}
