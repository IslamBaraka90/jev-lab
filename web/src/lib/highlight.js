// The small highlighter behind the code panel: comments, strings, numbers and keywords, and nothing
// else. A syntax library would cost more than the whole demo runtime.
//
// It runs as ONE pass over the escaped source. Four chained replaces cannot work here, because the
// second pass reads the first pass's output: `class="tok-string"` inside an emitted span is both a
// keyword and a quoted string, so it gets wrapped again and the markup falls apart on the page.

const TOKENS = /(\/\/[^\n]*)|('[^'\n]*'|`[^`]*`|"[^"\n]*")|(\b\d+(?:\.\d+)?\b)|\b(const|let|var|function|return|if|else|for|of|in|while|new|import|from|export|default|await|async|class|extends|try|catch|finally|throw|typeof|null|undefined|true|false)\b/g;

/** Escapes the source, then wraps each token once. The result is HTML for one `<code>` element. */
export function highlight(code) {
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(TOKENS, (match, comment, string, number) => {
    const kind = comment ? 'comment' : string ? 'string' : number ? 'number' : 'keyword';
    return `<span class="tok-${kind}">${match}</span>`;
  });
}
