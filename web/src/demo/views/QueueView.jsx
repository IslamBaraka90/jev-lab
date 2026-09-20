import { ItemRecord } from './fields.jsx';

// Alert-shaped items: the facts, the evidence grouped the way the dataset groups it, and the free text
// set as text. Used by the fraud, orders and news demos, where an item is something a person triages.

export function QueueView({ item, demo, context }) {
  return (
    <div className="queue-view">
      <ItemRecord item={item} demo={demo} context={context} />
    </div>
  );
}
