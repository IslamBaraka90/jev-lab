// Where the site points people when it says "run it yourself". Set VITE_REPO_URL at build time to the
// public repository; without it the links stay in place but point at a placeholder that is obvious in
// review rather than silently wrong.

export const REPO_URL = import.meta.env?.VITE_REPO_URL ?? 'https://github.com/set-VITE_REPO_URL';

export const REPO_REF = import.meta.env?.VITE_REPO_REF ?? 'main';

/** A file in the repository, optionally at a line range. */
export function repoFile(file, { startLine, endLine } = {}) {
  const lines = startLine ? `#L${startLine}${endLine && endLine !== startLine ? `-L${endLine}` : ''}` : '';
  return `${REPO_URL}/blob/${REPO_REF}/${file}${lines}`;
}
