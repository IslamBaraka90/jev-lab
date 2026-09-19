import { CandlesView } from './CandlesView.jsx';
import { DocumentView } from './DocumentView.jsx';
import { GraphView } from './GraphView.jsx';
import { LedgerView } from './LedgerView.jsx';
import { QueueView } from './QueueView.jsx';
import { TableView } from './TableView.jsx';

// How an item is drawn on the stage. A demo names one in its definition; anything unknown falls back
// to the plain field table, so a new demo always renders something.

export const VIEWS = {
  table: TableView,
  ledger: LedgerView,
  queue: QueueView,
  graph: GraphView,
  candles: CandlesView,
  document: DocumentView,
};

export function ItemView({ view, ...props }) {
  const Component = VIEWS[view] ?? TableView;
  return <Component {...props} />;
}
