import React from "react";
import {useLocale} from "../locale/index.js";

function parseHighlightAttr(attr) {
  if (!attr) return new Set();
  const cleaned = String(attr || "").trim();
  if (!cleaned) return new Set();
  const segments = cleaned
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const lines = new Set();
  for (const segment of segments) {
    if (!segment) continue;
    if (/^\d+-\d+$/.test(segment)) {
      const [startRaw, endRaw] = segment.split("-");
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        for (let i = start; i <= end; i += 1) {
          lines.add(i);
        }
      }
    } else if (/^\d+$/.test(segment)) {
      const value = Number(segment);
      if (Number.isFinite(value)) lines.add(value);
    }
  }
  return lines;
}

function normaliseCode(children) {
  if (children == null) return "";
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children
      .map((child) => (typeof child === "string" ? child : ""))
      .join("");
  }
  if (typeof children === "object" && typeof children.toString === "function") {
    return children.toString();
  }
  return "";
}

export default function DocsCodeBlock(props = {}) {
  const {children, ...rest} = props;
  const childArray = React.Children.toArray(children);
  const codeElement = childArray.find((el) => React.isValidElement(el));
  if (!codeElement || !codeElement.props) {
    return React.createElement("pre", props);
  }

  const {
    className = "",
    children: codeChildren,
    ...codeProps
  } = codeElement.props;
  const rawCode = normaliseCode(codeChildren);
  const trimmedCode = rawCode.endsWith("\n") ? rawCode.slice(0, -1) : rawCode;
  const lines = trimmedCode.split("\n");
  const filename = codeProps["data-filename"] || "";
  const language = (String(className).match(/language-([\w-]+)/) || [])[1] || "";
  const highlightAttr = codeProps["data-highlight"] || "";
  const highlightSet = parseHighlightAttr(highlightAttr);
  const copyAttr = codeProps["data-copy"];
  const enableCopy =
    copyAttr !== undefined
      ? copyAttr === true || copyAttr === "true" || copyAttr === ""
      : false;

  const {getString} = useLocale();
  // Every word from the page's locale (3.1.2; ACCESSIBILITY.md C34), handed to the copy
  // runtime as it reads them (`data-docs-copy-*`).
  const copyLabel = getString("common.actions.copy", "Copy");
  const copyAriaLabel = getString("common.phrases.copy_code", "Copy code to clipboard");
  const copiedAriaLabel = getString("common.phrases.copied_code", "Copied to clipboard");
  const [copied, setCopied] = React.useState(false);
  const buttonRef = React.useRef(null);

  const handleCopy = React.useCallback(async () => {
    const text = trimmedCode;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 5000);
    } catch (_) {
      setCopied(false);
    }
  }, [trimmedCode]);

  React.useEffect(() => {
    if (buttonRef.current) {
      buttonRef.current.setAttribute("data-docs-copy-hydrated", "true");
    }
  }, []);

  React.useEffect(() => {
    if (!buttonRef.current) return;
    if (copied) buttonRef.current.setAttribute("data-docs-copy-active", "true");
    else buttonRef.current.removeAttribute("data-docs-copy-active");
  }, [copied]);

  const showFilename = Boolean(filename);
  const showHeader = showFilename || enableCopy;

  const {style: preStyleOverride, className: preClassName, ...preRest} = rest;

  const lineElements = lines.map((line, index) => {
    const lineNumber = index + 1;
    const highlight = highlightSet.has(lineNumber);
    const displayLine = line === "" ? " " : line;
    return React.createElement(
      "span",
      {
        key: lineNumber,
        className: "canopy-code-block__line",
        "data-highlighted": highlight ? "true" : undefined,
        "data-docs-code-line": line,
      },
      React.createElement("span", {className: "canopy-code-block__text"}, displayLine),
    );
  });

  return React.createElement(
    "div",
    {
      className: "canopy-code-block",
      "data-docs-code-block": "true",
    },
    showHeader
      ? React.createElement(
          "div",
          {className: "canopy-code-block__header"},
          React.createElement(
            "span",
            {className: "canopy-code-block__filename"},
            showFilename ? filename : null,
          ),
          enableCopy
            ? React.createElement(
                "button",
                {
                  ref: buttonRef,
                  type: "button",
                  onClick: handleCopy,
                  "aria-live": "polite",
                  "aria-label": copied ? copiedAriaLabel : copyAriaLabel,
                  "data-docs-copy-button": "true",
                  "data-docs-copy-label": copyLabel,
                  "data-docs-copy-label-copied": copyLabel,
                  "data-docs-copy-aria-label": copyAriaLabel,
                  "data-docs-copy-aria-label-copied": copiedAriaLabel,
                  className: "canopy-code-block__copy",
                },
                React.createElement("span", null, copyLabel),
                React.createElement(
                  "span",
                  {
                    "aria-hidden": "true",
                    "data-docs-copy-icon": "true",
                  },
                  "\u2713",
                ),
              )
            : null,
        )
      : null,
    enableCopy
      ? React.createElement("textarea", {
          "data-docs-copy-source": "true",
          tabIndex: -1,
          readOnly: true,
          "aria-hidden": "true",
          defaultValue: trimmedCode,
          style: {
            position: "absolute",
            left: "-9999px",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          },
        })
      : null,
    React.createElement(
      "pre",
      {
        ...preRest,
        className: ["canopy-code-block__pre", preClassName].filter(Boolean).join(" "),
        style: preStyleOverride,
        // A block that scrolls sideways can be reached and scrolled by keyboard, named
        // by its file or its language (WCAG 2.1.1; ACCESSIBILITY.md C12).
        tabIndex: 0,
        ...(filename || language
          ? {role: "region", "aria-label": filename || language}
          : {}),
      },
      React.createElement("code", {className: "canopy-code-block__code"}, lineElements),
    ),
  );
}
