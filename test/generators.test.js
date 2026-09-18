import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENERATORS } from '../scripts/generate/index.js';
import { createRandom } from '../scripts/generate/lib/random.js';
import { datasetProblems } from '../demos/lib/dataset-shape.js';

test('the seeded generator repeats itself exactly', () => {
  const first = createRandom(42);
  const second = createRandom(42);
  const draw = (random) => [random.next(), random.int(1, 100), random.pick(['a', 'b', 'c']), random.day('2026-01-01', '2026-12-31')];
  assert.deepEqual(draw(first), draw(second));
  assert.notDeepEqual(draw(createRandom(43)), draw(createRandom(42)));
});

test('weighted picks respect their weights', () => {
  const random = createRandom(7);
  const counts = { common: 0, rare: 0 };
  for (let i = 0; i < 2000; i++) counts[random.weighted([['common', 95], ['rare', 5]])]++;
  assert.ok(counts.common > counts.rare * 5, `expected common to dominate, got ${JSON.stringify(counts)}`);
  assert.ok(counts.rare > 0, 'the rare option should still come up');
});

test('every generator is deterministic and produces a valid dataset with labels', async () => {
  for (const [slug, load] of Object.entries(GENERATORS)) {
    const { generate, SEED } = await load();
    const first = generate(SEED);
    const second = generate(SEED);

    assert.deepEqual(datasetProblems(first.dataset), [], `${slug} dataset is invalid`);
    assert.equal(first.dataset.id, slug);
    assert.equal(JSON.stringify(first), JSON.stringify(second), `${slug} is not deterministic`);

    if (first.labels) {
      const ids = new Set(first.dataset.items.map((item) => item.id));
      for (const label of first.labels) {
        const id = label.lineId ?? label.id ?? label.itemId;
        assert.ok(ids.has(id), `${slug} labels point at ${id}, which is not in the dataset`);
      }
    }
  }
});
