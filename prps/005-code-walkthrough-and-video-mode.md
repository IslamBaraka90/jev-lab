# 005 · Code walkthrough and video mode

**Depends on:** 003, 004 · **Blocks:** the video

## Why

The video's promise is "here is the use case, and here is the code that does it". That only works if the code on screen is the real file, is short enough to read out loud, and can be reached in one click from the demo that just ran.

## How it works panel

At the bottom of every demo page, four steps in fixed order, each with the real source behind it:

1. **The data** — where the dataset comes from and how it was made.
2. **The state** — the function that turns one item into the JSON the model sees.
3. **The questions** — the typed question definitions.
4. **The evaluation** — what the answers are turned into, and how the report is computed.

Each step shows: the file path, the line range, the snippet itself with syntax colours, a copy-path button, and a link to the file on the public repo at the pinned commit.

## Snippets come from the source, at build time

- Source files mark regions with comments: `// #region demo:state` … `// #endregion`.
- `scripts/build-code-index.js` scans `demos/`, `src/services/`, `scripts/generate/` and `web/src/demo/`, extracts every marked region, and writes `web/src/generated/code-index.json`: `{ "demos/ledger-integrity/demo.js#buildState": { path, startLine, endLine, code, language } }`.
- The build fails if a `demo.js` references a region that doesn't exist, so a rename can't leave a stale snippet on screen.
- Snippets are trimmed of leading indentation and capped at 40 lines; longer regions are a signal to simplify the code, not to scroll.

## Code quality rules for anything shown

These are enforced by review, and the PRPs for each demo repeat them:

- A state builder fits on one screen and reads top to bottom.
- Names match the domain, not the framework: `openingBalance`, not `val1`.
- No clever one-liners in the four shown regions; clever code belongs in shared libraries that the video doesn't open.
- Each region opens with a one-line comment saying what it produces.

## Presenter mode

Toggled with `p` or from the header. It is for recording, not for visitors:

- Hides the top bar, the item rail and the code panel; keeps the stage, answers and report.
- Bumps the base type scale one step, so a 1080p capture stays readable.
- Steps with `→`: item, item, then report, in the order the PRP's video beats list.
- A small corner slug shows the demo number and title, useful when cutting.
- The mode is in the URL (`?present=1`) so a shot list can link straight into it.

## Recording helpers

- `?item=<id>&phase=scored` opens a demo page on one item, already played out — the equivalent of the lab's `?at=N`, for the shot list.
- A "copy shot link" button in presenter mode puts the current URL on the clipboard.
- `scripts/shot-list.js <slug>` prints the demo's video beats with the URL for each, ready to paste into a production document.

## Files

| Path | Change |
|---|---|
| `scripts/build-code-index.js` | new, runs before `vite build` and in dev watch |
| `web/src/generated/code-index.json` | generated, committed |
| `web/src/demo/panels/HowItWorks.jsx` | new |
| `web/src/components/CodeBlock.jsx` | new: highlighted snippet, copy path, repo link |
| `web/src/demo/PresenterMode.jsx` | new |
| `scripts/shot-list.js` | new |
| `package.json` | `prebuild` runs the code index |

## Acceptance

- [ ] Every demo page shows four snippets, each matching the file on disk byte for byte.
- [ ] Renaming a region makes the build fail with the demo id and the missing key.
- [ ] The repo link opens the right file at the right lines on the pinned commit.
- [ ] Presenter mode hides chrome, scales type, and steps in the documented order.
- [ ] `?item=…&phase=scored` restores exactly that frame after a reload.
- [ ] `node scripts/shot-list.js ledger-integrity` prints beats with working URLs.

## Video beats

- Run a demo, then scroll to How it works and read the state builder out loud.
- Show the same file in the editor to prove the snippet isn't a picture.
- Toggle presenter mode mid-recording to show the clean frame.

## Notes and risks

- Syntax highlighting must be a small dependency or hand-rolled for JavaScript and JSON only; don't ship a 200 KB highlighter for four snippets.
- The pinned commit for repo links comes from the build environment, with a fallback to `main`.
