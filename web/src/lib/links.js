// Where the site points people when it says "run it yourself". The public repository is the default,
// so a build on a host that carries no .env — Vercel, for one — still links somewhere real. Set
// VITE_REPO_URL at build time to point a fork or a mirror at itself instead.

export const REPO_URL = import.meta.env?.VITE_REPO_URL || 'https://github.com/IslamBaraka90/jev-typesafe-real-financial-use-cases';

export const REPO_REF = import.meta.env?.VITE_REPO_REF ?? 'main';

/** A file in the repository, optionally at a line range. */
export function repoFile(file, { startLine, endLine } = {}) {
  const lines = startLine ? `#L${startLine}${endLine && endLine !== startLine ? `-L${endLine}` : ''}` : '';
  return `${REPO_URL}/blob/${REPO_REF}/${file}${lines}`;
}
