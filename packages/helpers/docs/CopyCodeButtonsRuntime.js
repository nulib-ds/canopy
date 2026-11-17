const React = require("react");

const INLINE_STYLE = `
[data-docs-copy-icon] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0;
  height: 1rem;
  border-radius: 999px;
  font-size: var(--canopy-text-label);
  font-weight: var(--canopy-weight-bold);
  background: var(--color-accent-default);
  color: var(--color-accent-50);
  opacity: 0;
  transform: translateY(2px) scale(0.8);
  margin-left: 0;
  transition: opacity 200ms ease, transform 200ms ease, width 200ms ease,
    margin-left 200ms ease;
}
[data-docs-copy-button][data-docs-copy-active] [data-docs-copy-icon] {
  width: 1rem;
  opacity: 1;
  transform: translateY(0) scale(1);
  margin-left: 0.35rem;
}
`;

function CopyCodeButtonsRuntime() {
  const source = `(() => {
    const BUTTON_SELECTOR = '[data-docs-copy-button]';
    const BLOCK_SELECTOR = '[data-docs-code-block]';
    const SOURCE_SELECTOR = '[data-docs-copy-source]';
    const LINE_SELECTOR = '[data-docs-code-line]';
    const STYLE_ID = 'docs-copy-button-style';
    const STYLE_TEXT = ${JSON.stringify(INLINE_STYLE)};
    if (typeof document === 'undefined') return;

    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = STYLE_TEXT;
      const parent = document.head || document.body || document.documentElement;
      parent.appendChild(el);
    }
    ensureStyles();

    function getLabels(button) {
      const idle = button.getAttribute('data-docs-copy-label') || button.textContent || 'Copy';
      const copied = button.getAttribute('data-docs-copy-label-copied') || 'Copy';
      const idleAria =
        button.getAttribute('data-docs-copy-aria-label') ||
        button.getAttribute('aria-label') ||
        'Copy code to clipboard';
      const copiedAria =
        button.getAttribute('data-docs-copy-aria-label-copied') ||
        'Copied to clipboard';
      return {idle, copied, idleAria, copiedAria};
    }

    function updateButtonState(button, labels, isCopied) {
      button.setAttribute('aria-label', isCopied ? labels.copiedAria : labels.idleAria);
      if (isCopied) button.setAttribute('data-docs-copy-active', 'true');
      else button.removeAttribute('data-docs-copy-active');
    }

    function extractCode(block) {
      if (!block) return '';
      const sourceEl = block.querySelector(SOURCE_SELECTOR);
      if (sourceEl) {
        if ('value' in sourceEl) return sourceEl.value || '';
        const attr = sourceEl.getAttribute('data-docs-copy-source');
        if (attr) return attr;
        return sourceEl.textContent || '';
      }
      const lineEls = block.querySelectorAll(LINE_SELECTOR);
      if (lineEls && lineEls.length) {
        const lines = [];
        lineEls.forEach((lineEl) => {
          const value = lineEl.getAttribute('data-docs-code-line');
          lines.push(value != null ? value : '');
        });
        return lines.join('\\n');
      }
      const codeEl = block.querySelector('code');
      return codeEl ? codeEl.textContent || '' : '';
    }

    function legacyCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.select();
      let success = false;
      try {
        success = document.execCommand('copy');
      } catch (_) {
        success = false;
      }
      textarea.remove();
      return success;
    }

    function copyText(text) {
      if (!text) return Promise.resolve(false);
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(
          () => true,
          () => legacyCopy(text),
        );
      }
      return Promise.resolve(legacyCopy(text));
    }

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      const button = target.closest(BUTTON_SELECTOR);
      if (!button) return;
      if (button.hasAttribute('data-docs-copy-hydrated')) return;
      const block = button.closest(BLOCK_SELECTOR);
      if (!block) return;
      event.preventDefault();
      const labels = getLabels(button);
      const text = extractCode(block);
      copyText(text).then((ok) => {
        if (!ok) return;
        updateButtonState(button, labels, true);
        if (button.__copyTimeout) {
          clearTimeout(button.__copyTimeout);
        }
        button.__copyTimeout = setTimeout(() => {
          updateButtonState(button, labels, false);
        }, 5000);
      });
    });
  })();`;

  return React.createElement("script", {
    dangerouslySetInnerHTML: {__html: source},
  });
}

module.exports = CopyCodeButtonsRuntime;
module.exports.default = CopyCodeButtonsRuntime;
