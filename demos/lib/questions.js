// Question builders shared by the demos, the recorder and the site.
//
// They return exactly the shape the TypeSafe SDK's own `choice`, `score` and `noul` helpers produce,
// so a demo definition can be imported in the browser without pulling the SDK (and a key handler)
// into the bundle. `test/questions.test.js` compares these against the SDK's output, so the two
// cannot drift apart.

/** A question that picks one of the named options. */
export const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });

/** A question that places an answer on an ordered rubric, from 0 upwards. */
export const score = (instructions, criteria) => ({ type: 'score', instructions, criteria });

/** A yes-or-no question; the answer is the probability of yes. `criteria` describes the two outcomes. */
export const noul = (instructions, criteria) => ({ type: 'noul', instructions, criteria });

/** The option labels of a choice question, in the order they were defined. */
export const optionsOf = (question) => (question.type === 'choice' ? Object.keys(question.criteria) : []);

/** The rubric of a score question, as an array from 0 upwards. */
export const rubricOf = (question) => (question.type === 'score' ? [...question.criteria] : []);

/** Every question type used by a set of questions, for the catalog card. */
export function questionTypes(questions) {
  return [...new Set(Object.values(questions).map((question) => question.type))].sort();
}
