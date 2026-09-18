import { useEffect, useState } from 'react';
import { applyRunEvent } from '../../../src/services/run-model.js';
import { followRun } from '../lib/api.js';

// A run, kept current while it is live. `connection` is "connecting", "open", "reconnecting", "closed" or "failed".
export function useRun(id) {
  const [state, setState] = useState({ id, run: null, connection: 'connecting' });

  useEffect(() => {
    let run = null;
    setState({ id, run: null, connection: 'connecting' });
    return followRun(id, {
      onEvent: (event) => {
        run = applyRunEvent(run, event);
        setState((current) => ({ ...current, run }));
      },
      onConnection: (connection) => setState((current) => ({ ...current, connection })),
    });
  }, [id]);

  return state.id === id ? state : { id, run: null, connection: 'connecting' };
}
