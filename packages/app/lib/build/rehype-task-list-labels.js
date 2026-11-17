// Markdown task lists ("- [x] Point canopy.yml at a collection") render a checkbox with
// no label (WCAG 4.1.2; ACCESSIBILITY.md C15). This rehype plugin names each checkbox
// by its item's own words, so a screen reader says "Point canopy.yml at a collection,
// checkbox, checked". Words in a nested list belong to that list's items, not this one.

const LISTS = new Set(['ul', 'ol']);

function textOf(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (node.type === 'element' && LISTS.has(node.tagName)) return '';
  return Array.isArray(node.children) ? node.children.map(textOf).join('') : '';
}

function isTaskItem(node) {
  if (node.type !== 'element' || node.tagName !== 'li') return false;
  const className = node.properties && node.properties.className;
  const classes = Array.isArray(className) ? className : String(className || '').split(/\s+/);
  return classes.includes('task-list-item');
}

function findCheckbox(node) {
  if (!node || !Array.isArray(node.children)) return null;
  for (const child of node.children) {
    if (child.type !== 'element') continue;
    if (LISTS.has(child.tagName)) continue;
    if (child.tagName === 'input' && child.properties && child.properties.type === 'checkbox') {
      return child;
    }
    const nested = findCheckbox(child);
    if (nested) return nested;
  }
  return null;
}

function visit(node, fn) {
  fn(node);
  if (Array.isArray(node.children)) node.children.forEach((child) => visit(child, fn));
}

function rehypeTaskListLabels() {
  return (tree) => {
    visit(tree, (node) => {
      if (!isTaskItem(node)) return;
      const checkbox = findCheckbox(node);
      if (!checkbox || checkbox.properties.ariaLabel || checkbox.properties.ariaLabelledBy) return;
      const label = textOf(node).replace(/\s+/g, ' ').trim();
      if (label) checkbox.properties.ariaLabel = label;
    });
  };
}

module.exports = rehypeTaskListLabels;
module.exports.rehypeTaskListLabels = rehypeTaskListLabels;
