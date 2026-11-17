// Markdown task lists' checkboxes get their item's words as a name (WCAG 4.1.2;
// ACCESSIBILITY.md C15). The trees are shaped as remark-gfm and mdast-util-to-hast
// write them.

const rehypeTaskListLabels = require('../../../packages/app/lib/build/rehype-task-list-labels');

const text = (value) => ({ type: 'text', value });
const element = (tagName, properties, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const checkbox = (checked) => element('input', { type: 'checkbox', checked, disabled: true });
const taskItem = (children) => element('li', { className: ['task-list-item'] }, children);

function run(tree) {
  rehypeTaskListLabels()(tree);
  return tree;
}

test('names a tight item’s checkbox by its words', () => {
  const box = checkbox(true);
  run({
    type: 'root',
    children: [
      element('ul', { className: ['contains-task-list'] }, [
        taskItem([
          box,
          text(' Point '),
          element('code', {}, [text('canopy.yml')]),
          text(' at a collection'),
        ]),
      ]),
    ],
  });
  expect(box.properties.ariaLabel).toBe('Point canopy.yml at a collection');
});

test('names a loose item’s checkbox, inside its paragraph', () => {
  const box = checkbox(false);
  run({
    type: 'root',
    children: [taskItem([element('p', {}, [box, text(' Write an introduction')])])],
  });
  expect(box.properties.ariaLabel).toBe('Write an introduction');
});

test('leaves a nested list’s words to that list', () => {
  const outer = checkbox(false);
  const inner = checkbox(true);
  run({
    type: 'root',
    children: [
      taskItem([
        outer,
        text(' Publish the site'),
        element('ul', {}, [taskItem([inner, text(' Check the links')])]),
      ]),
    ],
  });
  expect(outer.properties.ariaLabel).toBe('Publish the site');
  expect(inner.properties.ariaLabel).toBe('Check the links');
});

test('keeps a name an author gave, and leaves other lists alone', () => {
  const named = element('input', { type: 'checkbox', ariaLabel: 'Mine' });
  const plain = element('li', {}, [text('Not a task')]);
  run({ type: 'root', children: [taskItem([named, text(' Words')]), plain] });
  expect(named.properties.ariaLabel).toBe('Mine');
  expect(plain.properties).toEqual({});
});
