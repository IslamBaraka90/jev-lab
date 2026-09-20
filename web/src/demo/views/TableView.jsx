import { ItemRecord } from './fields.jsx';

// The fallback stage: every field of the item, with nested records as groups and lists as tables.
// Every demo renders with this before its own view exists.

export function TableView({ item, demo, context }) {
  return (
    <div className="table-view">
      <ItemRecord item={item} demo={demo} context={context} />
    </div>
  );
}
