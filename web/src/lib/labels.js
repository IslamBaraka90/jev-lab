export const ACTIONS = {
  LONG: { label: 'Long', tone: 'long' },
  SHORT: { label: 'Short', tone: 'short' },
  NO_TRADE: { label: 'No trade', tone: 'flat' },
};

export const EXIT_REASONS = {
  take_profit: 'Take profit',
  stop_loss: 'Stop loss',
  time_exit: 'Time exit',
};

export const RUN_STATUS = {
  running: { label: 'Live', tone: 'live' },
  completed: { label: 'Completed', tone: 'pass' },
  cancelled: { label: 'Cancelled', tone: 'warn' },
  interrupted: { label: 'Interrupted', tone: 'warn' },
  failed: { label: 'Failed', tone: 'error' },
  pending: { label: 'Queued', tone: 'muted' },
};

export function runTitle(run) {
  const name = run.preset === 'suite' ? 'Full suite' : 'Pilot';
  return `${name}${run.settings?.indicators ? ' with indicators' : ''}${run.settings?.blind ? ' (blind)' : ''}`;
}

export function runSymbols(run) {
  return run.symbols.map((symbol) => symbol.symbol).join(', ');
}

export const QUESTION_GROUPS = [
  { title: 'Decision', keys: ['trade_decision', 'trade_setup_exists', 'remain_flat_due_to_uncertainty'] },
  { title: 'Market read', keys: ['market_direction', 'market_structure', 'momentum_state', 'volume_confirmation', 'price_overextended'] },
  { title: 'Setup quality', keys: ['setup_strength', 'risk_quality'] },
  { title: 'Trade plan', keys: ['trade_direction_if_taken', 'entry_style', 'stop_loss_distance', 'take_profit_distance', 'expected_holding_period'] },
];

export const QUESTION_LABELS = {
  trade_decision: 'Trade decision',
  trade_setup_exists: 'A trade setup exists',
  remain_flat_due_to_uncertainty: 'Stay flat because of uncertainty',
  market_direction: 'Market direction',
  market_structure: 'Market structure',
  momentum_state: 'Momentum',
  volume_confirmation: 'Volume confirms the move',
  price_overextended: 'Price is overextended',
  setup_strength: 'Setup strength',
  risk_quality: 'Risk quality',
  trade_direction_if_taken: 'Direction if traded',
  entry_style: 'Entry style',
  stop_loss_distance: 'Stop-loss distance',
  take_profit_distance: 'Take-profit distance',
  expected_holding_period: 'Holding period',
};

// "2.00_PERCENT_OR_MORE" -> "2.00% or more", "ENTER_NEXT_BAR" -> "Enter next bar"; readable labels stay as they are.
export function optionLabel(option) {
  if (!/^[A-Z0-9_.]+$/.test(option)) return option;
  const text = option.replace(/(\d+(?:\.\d+)?)_PERCENT/, '$1%').replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The score level nearest to a Score answer, e.g. "Moderate" for 3.2 on a 0-6 scale.
export function nearestLevel(answer) {
  return answer?.legend?.[Math.round(answer.score)] ?? null;
}
