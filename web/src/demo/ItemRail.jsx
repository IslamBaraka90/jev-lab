import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon.jsx';

// The dataset as a list you can interrogate: every item carries its grade from the first paint, and
// the filters answer the question an evaluator actually has, which is "show me the ones it got wrong".

const LOW_CONFIDENCE = 0.6;

/**
 * How sure the item's headline answer was: the first choice question, since that is the decision, or
 * the first yes-or-no where a demo has no choice. Rubric scores sit mid-scale by nature and are left out.
 */
function weakest(result) {
  const answers = Object.values(result?.answers ?? {});
  const choice = answers.find((answer) => answer?.type === 'choice');
  if (choice) return choice.confidence ?? null;
  const noul = answers.find((answer) => answer?.type === 'noul');
  return noul ? 0.5 + Math.abs(noul.noul - 0.5) : null;
}

export function ItemRail({ demo, items, current, resultsById, gradesById, idFilter, onClearIdFilter, onSelect }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const list = useRef(null);
  const hasGrades = Object.keys(gradesById).length > 0;

  const rows = useMemo(
    () =>
      items.map((item) => {
        const result = resultsById[item.id];
        const grade = gradesById[item.id];
        return { item, label: demo.itemLabel?.(item) ?? item.id, outcome: result?.evaluation?.label ?? null, grade, unsure: (weakest(result) ?? 1) < LOW_CONFIDENCE };
      }),
    [items, resultsById, gradesById, demo],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      wrong: rows.filter((row) => row.grade && !row.grade.agree).length,
      unsure: rows.filter((row) => row.unsure).length,
    }),
    [rows],
  );

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (idFilter && !idFilter.ids.has(row.item.id)) return false;
    if (filter === 'wrong' && !(row.grade && !row.grade.agree)) return false;
    if (filter === 'unsure' && !row.unsure) return false;
    if (needle && !`${row.label} ${row.outcome ?? ''}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  // Keep the current item in view when it changes from outside the list: a report chip, a key press.
  useEffect(() => {
    list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [current?.id]);

  const FILTERS = [
    { id: 'all', label: 'All', count: counts.all },
    ...(hasGrades ? [{ id: 'wrong', label: 'Wrong', count: counts.wrong }] : []),
    { id: 'unsure', label: 'Unsure', count: counts.unsure },
  ];

  return (
    <aside className="panel item-rail" aria-label="Items">
      <div className="rail-head">
        <strong>{items.length.toLocaleString('en-US')} items</strong>
        <span className="meta">
          {visible.length === rows.length ? 'all shown' : `${visible.length} shown`}
        </span>
      </div>

      <div className="rail-tools">
        <label className="rail-search">
          <Icon name="search" size={14} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter items" aria-label="Filter items" />
        </label>
        <div className="rail-filters" role="group" aria-label="Show">
          {FILTERS.map((entry) => (
            <button key={entry.id} type="button" className={`rail-filter${filter === entry.id ? ' selected' : ''}`} aria-pressed={filter === entry.id} onClick={() => setFilter(entry.id)}>
              {entry.label}
              <span className="num">{entry.count}</span>
            </button>
          ))}
        </div>
        {idFilter && (
          <p className="rail-idfilter">
            <span>{idFilter.label}</span>
            <button type="button" className="link-button" onClick={onClearIdFilter}>
              Clear
            </button>
          </p>
        )}
      </div>

      <ul ref={list}>
        {visible.map((row) => (
          <li key={row.item.id}>
            <button type="button" className={`rail-item${row.item.id === current?.id ? ' current' : ''}`} onClick={() => onSelect(row.item.id)} aria-current={row.item.id === current?.id ? 'true' : undefined}>
              <span className={`rail-dot ${row.grade ? (row.grade.agree ? 'agree' : 'disagree') : 'ungraded'}`} aria-hidden="true" />
              <span className="rail-text">
                <span className="rail-label">{row.label}</span>
                {row.outcome && <span className="meta rail-result">{row.outcome}</span>}
              </span>
              {row.grade && <span className="sr-only">{row.grade.agree ? 'matches ground truth' : 'differs from ground truth'}</span>}
            </button>
          </li>
        ))}
        {visible.length === 0 && <li className="meta rail-empty">Nothing matches.</li>}
      </ul>
    </aside>
  );
}
