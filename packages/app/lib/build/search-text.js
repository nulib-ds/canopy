// The words of an MDX page for search (`build/search.js`): the text it is found by, and
// the inline Markdown a search result's excerpt is drawn from (`ArticleCard`). Read with
// the MDX parser and GFM, as the page itself is compiled, so that prose is told apart from
// code, components, expressions and tables:
//   - kept: headings (in the text only), paragraphs, list items, quotes, a table's cells
//     but for its header row, and what a component holds between its tags;
//   - dropped: code blocks, imports and exports, `{expressions}`, a component's attributes,
//     HTML, images and footnote marks; a link keeps its words, not its address.
// In the excerpt's Markdown, inline code, emphasis and strong stay; the characters the
// card reads as Markdown (`*`, `_`, `` ` ``, `\`) are escaped wherever they are text.
//
// The parser is ESM, which Node 24 requires happily and Jest 29 cannot; without it, or on a
// page it cannot parse, `extractSearchText` falls back to `mdx.js`'s patterns.

'use strict';

let parser;

function loadParser() {
  if (parser !== undefined) return parser;
  try {
    const { fromMarkdown } = require('mdast-util-from-markdown');
    const { mdxjs } = require('micromark-extension-mdxjs');
    const { mdxFromMarkdown } = require('mdast-util-mdx');
    const { gfm } = require('micromark-extension-gfm');
    const { gfmFromMarkdown } = require('mdast-util-gfm');
    parser = (source) =>
      fromMarkdown(source, {
        extensions: [mdxjs(), gfm()],
        mdastExtensions: [mdxFromMarkdown(), gfmFromMarkdown()],
      });
  } catch (_) {
    parser = null;
  }
  return parser;
}

const SKIP = new Set([
  'code',
  'definition',
  'footnoteReference',
  'html',
  'image',
  'imageReference',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxjsEsm',
  'thematicBreak',
  'toml',
  'yaml',
]);

const INLINE = new Set([
  'break',
  'delete',
  'emphasis',
  'inlineCode',
  'link',
  'linkReference',
  'mdxJsxTextElement',
  'strong',
  'text',
]);

function escapeMarkdown(value) {
  return String(value || '').replace(/[\\*_`]/g, (char) => `\\${char}`);
}

// A node's inline content, as plain text or as the excerpt's Markdown.
function inline(node, markdown) {
  if (!node || SKIP.has(node.type)) return '';
  switch (node.type) {
    case 'text':
      return markdown ? escapeMarkdown(node.value) : String(node.value || '');
    case 'inlineCode': {
      const value = String(node.value || '');
      return markdown ? `\`${value.replace(/`/g, '')}\`` : value;
    }
    case 'emphasis':
    case 'strong': {
      const inner = children(node, markdown);
      if (!markdown || !inner.trim()) return inner;
      const mark = node.type === 'strong' ? '**' : '*';
      return `${mark}${inner}${mark}`;
    }
    case 'break':
      return ' ';
    default:
      return children(node, markdown);
  }
}

function children(node, markdown) {
  return (node.children || []).map((child) => inline(child, markdown)).join('');
}

const tidy = (value) => value.replace(/\s+/g, ' ').trim();

// The page's blocks of prose, in order, each as text and as Markdown.
function collectBlocks(tree) {
  const blocks = [];
  const push = (kind, text, markdown) => {
    const plain = tidy(text);
    if (plain) blocks.push({ kind, text: plain, markdown: tidy(markdown) });
  };
  (function walk(node) {
    if (!node || SKIP.has(node.type)) return;
    if (node.type === 'heading' || node.type === 'paragraph') {
      push(node.type, inline(node, false), inline(node, true));
      return;
    }
    if (node.type === 'table') {
      // Its first row is the header, the columns' names: words of the table, not the page.
      (node.children || []).slice(1).forEach(walk);
      return;
    }
    if (node.type === 'tableRow') {
      const cells = (node.children || [])
        .map((cell) => ({ text: tidy(inline(cell, false)), markdown: tidy(inline(cell, true)) }))
        .filter((cell) => cell.text);
      push(
        'row',
        cells.map((cell) => cell.text).join(' · '),
        cells.map((cell) => cell.markdown).join(' · '),
      );
      return;
    }
    const kids = node.children || [];
    // A component written on one line holds its words directly, not in a paragraph.
    if (node.type === 'mdxJsxFlowElement' && kids.length && kids.every((kid) => INLINE.has(kid.type))) {
      push('paragraph', children(node, false), children(node, true));
      return;
    }
    kids.forEach(walk);
  })(tree);
  return blocks;
}

// Resolves a page's MDX (front matter already removed) to { text, excerpt, markdown }: all
// its words, its prose without its headings, and that prose as the excerpt's Markdown; or
// null when the parser is unavailable or the page does not parse.
function searchTextFromMdx(content) {
  const parse = loadParser();
  if (!parse) return null;
  let tree;
  try {
    tree = parse(String(content || ''));
  } catch (_) {
    return null;
  }
  const blocks = collectBlocks(tree);
  const prose = blocks.filter((block) => block.kind !== 'heading');
  return {
    text: blocks.map((block) => block.text).join(' '),
    excerpt: prose.map((block) => block.text).join(' '),
    markdown: prose.map((block) => block.markdown).join(' '),
  };
}

module.exports = { searchTextFromMdx, escapeMarkdown };
