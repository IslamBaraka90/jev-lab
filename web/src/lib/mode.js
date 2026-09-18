// The site replays recorded answers. The local Express server marks the page as live-capable when it
// has an API key, but nothing calls the API until someone switches a demo to live and confirms it:
// a page that spends money on load would be a trap, however local it is.

export const liveAvailable = typeof window !== 'undefined' && window.__JEV_LIVE__ === true;

export const modeLabel = liveAvailable ? 'Live available' : 'Recorded';

export const modeExplainer = liveAvailable
  ? 'This machine has an API key, so demos can be switched to live. Until you switch one, every answer comes from the recordings.'
  : 'Answers on this page were recorded once and committed to the repository. Nothing is sent anywhere.';

/** What a live run of a whole dataset would cost, for the confirmation dialog. */
export function estimateRun(itemCount, questionCount) {
  const perItem = 700 + questionCount * 120;
  return { requests: itemCount, inputTokens: itemCount * perItem };
}
