import { CandlesView } from './CandlesView.jsx';
import { DocumentView } from './DocumentView.jsx';
import { PairCurvesView } from './PairCurvesView.jsx';
import { GraphView } from './GraphView.jsx';
import { LedgerView } from './LedgerView.jsx';
import { QueueView } from './QueueView.jsx';
import { TableView } from './TableView.jsx';
import { TimelineView } from './TimelineView.jsx';
import { ComparisonView } from './ComparisonView.jsx';
import { CalendarView } from './CalendarView.jsx';
import { SessionCurveView } from './SessionCurveView.jsx';
import { StatementsView } from './StatementsView.jsx';
import { PeerGridView } from './PeerGridView.jsx';
import { TimingGridView } from './TimingGridView.jsx';
import { BacktestCurveView } from './BacktestCurveView.jsx';

// How an item is drawn on the stage. A demo names one in its definition; anything unknown falls back
// to the plain field table, so a new demo always renders something.

export const VIEWS = {
  table: TableView,
  ledger: LedgerView,
  queue: QueueView,
  timeline: TimelineView,
  comparison: ComparisonView,
  graph: GraphView,
  candles: CandlesView,
  calendar: CalendarView,
  sessionCurve: SessionCurveView,
  statements: StatementsView,
  peerGrid: PeerGridView,
  timingGrid: TimingGridView,
  document: DocumentView,
  pairCurves: PairCurvesView,
  curve: BacktestCurveView,
};

export function ItemView({ view, ...props }) {
  const Component = VIEWS[view] ?? TableView;
  return <Component {...props} />;
}
