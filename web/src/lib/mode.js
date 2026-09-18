// The site replays recorded answers. The local Express server marks the page as live when it has an
// API key, and only then can a demo call the model for real.

export const isLive = typeof window !== 'undefined' && window.__JEV_LIVE__ === true;

export const modeLabel = isLive ? 'Live' : 'Recorded';

export const modeExplainer = isLive
  ? 'This page can run demos against the TypeSafe API with your key. Each run costs a request.'
  : 'Answers on this page were recorded once and committed to the repository. Nothing is sent anywhere.';
