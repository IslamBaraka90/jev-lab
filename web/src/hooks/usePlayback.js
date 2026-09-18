import { useCallback, useEffect, useReducer } from 'react';

// Replays decisions one at a time. Each goes through four phases: Jev reads the bars, decides, the bars
// after the decision play out one by one, and the result is scored. Durations are for 1x speed.

export const PHASES = [
  { id: 'reading', label: 'Reads the bars' },
  { id: 'deciding', label: 'Decides' },
  { id: 'playing', label: 'Trade plays out' },
  { id: 'scored', label: 'Scored' },
];
export const SPEEDS = [1, 2, 4, 8];
const DURATION = { reading: 900, deciding: 1300, bar: 280, scored: 1700 };

function reducer(state, action) {
  switch (action.type) {
    case 'tick':
      if (state.phase === 'reading') return { ...state, phase: 'deciding' };
      if (state.phase === 'deciding') return { ...state, phase: 'playing', revealed: 1 };
      if (state.phase === 'playing') {
        return state.revealed < action.horizon ? { ...state, revealed: state.revealed + 1 } : { ...state, phase: 'scored' };
      }
      return state.index + 1 < action.total ? { ...state, index: state.index + 1, phase: 'reading', revealed: 0 } : state;
    case 'play':
      // Playing from a finished replay starts it again.
      return action.restart ? { ...state, playing: true, index: 0, phase: 'reading', revealed: 0 } : { ...state, playing: true };
    case 'pause':
      return { ...state, playing: false };
    case 'seek':
      return state.playing
        ? { ...state, index: action.index, phase: 'reading', revealed: 0 }
        : { ...state, index: action.index, phase: 'scored', revealed: action.horizon };
    case 'speed':
      return { ...state, speed: action.speed };
    default:
      return state;
  }
}

// `start` opens a finished replay paused on that decision, fully played out.
export function usePlayback({ total, horizon, live, start }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    if (Number.isInteger(start) && start >= 0 && start < total) {
      return { index: start, phase: 'scored', revealed: horizon, playing: false, speed: 1 };
    }
    return { index: live ? Math.max(0, total - 1) : 0, phase: 'reading', revealed: 0, playing: live, speed: live ? 2 : 1 };
  });
  const atEnd = state.phase === 'scored' && state.index + 1 >= total;

  useEffect(() => {
    if (!state.playing || total === 0) return;
    if (atEnd) {
      if (!live) dispatch({ type: 'pause' });
      return; // A live run waits here for its next decision.
    }
    const duration = state.phase === 'playing' ? DURATION.bar : DURATION[state.phase];
    const timer = setTimeout(() => dispatch({ type: 'tick', total, horizon }), duration / state.speed);
    return () => clearTimeout(timer);
  }, [state, total, horizon, live, atEnd]);

  const seek = useCallback((index) => dispatch({ type: 'seek', index: Math.max(0, Math.min(index, total - 1)), horizon }), [total, horizon]);

  return {
    ...state,
    index: Math.min(state.index, Math.max(0, total - 1)),
    atEnd,
    waiting: live && atEnd && state.playing,
    play: () => dispatch({ type: 'play', restart: atEnd && !live }),
    pause: () => dispatch({ type: 'pause' }),
    toggle: () => (state.playing ? dispatch({ type: 'pause' }) : dispatch({ type: 'play', restart: atEnd && !live })),
    seek,
    setSpeed: (speed) => dispatch({ type: 'speed', speed }),
  };
}
