import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const RunsContext = createContext(null);

// The runs list, presets and the running backtest, refreshed often while a run is live.
export function RunsProvider({ children }) {
  const [state, setState] = useState({ runs: [], activeRunId: null, presets: null, settings: null, loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const data = await api.runs();
      setState({ ...data, loading: false, error: null });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(refresh, state.activeRunId ? 4000 : 20000);
    return () => clearInterval(timer);
  }, [refresh, state.activeRunId]);

  return <RunsContext value={{ ...state, refresh }}>{children}</RunsContext>;
}

export function useRuns() {
  return useContext(RunsContext);
}
