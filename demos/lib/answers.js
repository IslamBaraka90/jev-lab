// Recorded answers are reviewed as diffs and shipped to every visitor, so they are stored without the
// parts that repeat. A score answer echoes its question's rubric on every single item; the fixture drops
// it and the site puts it back from the question definition. Nothing else is touched.

const sameRubric = (legend, rubric) => rubric.length === Object.keys(legend ?? {}).length && rubric.every((level, index) => legend[index] === level);

/** An answer set with the repeated rubrics removed, ready to write to a fixture file. */
export function compactAnswers(answers, questions) {
  const compact = {};
  for (const [name, answer] of Object.entries(answers)) {
    const question = questions[name];
    if (answer?.type === 'score' && question && sameRubric(answer.legend, question.criteria)) {
      const { legend, ...rest } = answer;
      compact[name] = rest;
    } else {
      compact[name] = answer;
    }
  }
  return compact;
}

/** The same answer set as the API returned it, with rubrics restored from the questions. */
export function expandAnswers(answers, questions) {
  const full = {};
  for (const [name, answer] of Object.entries(answers ?? {})) {
    const question = questions[name];
    if (answer?.type === 'score' && !answer.legend && question) {
      full[name] = { ...answer, legend: Object.fromEntries(question.criteria.map((level, index) => [index, level])) };
    } else {
      full[name] = answer;
    }
  }
  return full;
}
