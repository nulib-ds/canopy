import React, {useMemo} from "react";

const DUMMY_ORIGIN = 'https://canopy.local';

function appendQueryParam(href = '', key, value) {
  try {
    const absolute = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href);
    const baseHref = absolute
      ? href
      : `${DUMMY_ORIGIN}${href.startsWith('/') ? '' : '/'}${href}`;
    const url = new URL(baseHref);
    url.searchParams.set(key, value);
    if (absolute) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (_) {
    if (!href) return href;
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

function escapeRegExp(str = "") {
  return String(str).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// A result's excerpt: its inline Markdown read into runs of text, each with its style,
// then a window of them around the first word of the query. Cut by runs, not characters,
// so a cut never falls inside a span and turns the words after it into code.
const SNIPPET_LENGTH = 360;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const ESCAPABLE = "\\*_`[";

function queryTerms(query = "") {
  const whole = String(query || "").trim();
  if (!whole) return [];
  return [whole, ...whole.split(/\s+/)].filter(
    (term, index, all) => term && all.indexOf(term) === index
  );
}

function highlightTextNode(text, query, keyPrefix = "") {
  const terms = queryTerms(query).sort((a, b) => b.length - a.length);
  if (!terms.length) return text;
  const regex = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const lowered = new Set(terms.map((term) => term.toLowerCase()));
  return String(text)
    .split(regex)
    .map((part, idx) => {
      if (!part) return null;
      if (lowered.has(part.toLowerCase())) {
        return <mark key={`${keyPrefix}-${idx}`}>{part}</mark>;
      }
      return <React.Fragment key={`${keyPrefix}-${idx}`}>{part}</React.Fragment>;
    });
}

// The index of the `_` or `__` that closes one opened at 0: followed by no letter or
// digit, as an underscore inside a word (`snake_case`) is a character, not emphasis.
function closingUnderscore(text, marker) {
  let from = marker.length;
  while (from < text.length) {
    const at = text.indexOf(marker, from);
    if (at === -1) return -1;
    const after = text.charAt(at + marker.length);
    if (!(after && WORD_CHAR.test(after))) return at;
    from = at + 1;
  }
  return -1;
}

function tokenizeInlineMarkdown(input = "") {
  const tokens = [];
  let text = input;
  let prev = "";
  const pushText = (value) => {
    if (!value) return;
    tokens.push({type: "text", value});
    prev = value.charAt(value.length - 1);
  };
  while (text.length) {
    if (text.startsWith("\\") && text.length > 1 && ESCAPABLE.includes(text[1])) {
      pushText(text[1]);
      text = text.slice(2);
      continue;
    }
    if (text.startsWith("\n")) {
      tokens.push({type: "break"});
      prev = " ";
      text = text.slice(1);
      continue;
    }
    if (text.startsWith("**")) {
      const closing = text.indexOf("**", 2);
      if (closing !== -1) {
        tokens.push({type: "strong", children: tokenizeInlineMarkdown(text.slice(2, closing))});
        prev = "*";
        text = text.slice(closing + 2);
        continue;
      }
    }
    if (text.startsWith("_") && WORD_CHAR.test(prev)) {
      pushText("_");
      text = text.slice(1);
      continue;
    }
    if (text.startsWith("__")) {
      const closing = closingUnderscore(text, "__");
      if (closing !== -1) {
        tokens.push({type: "strong", children: tokenizeInlineMarkdown(text.slice(2, closing))});
        prev = "_";
        text = text.slice(closing + 2);
        continue;
      }
    }
    if (text.startsWith("*") && !text.startsWith("**")) {
      const closing = text.indexOf("*", 1);
      if (closing !== -1) {
        tokens.push({type: "em", children: tokenizeInlineMarkdown(text.slice(1, closing))});
        prev = "*";
        text = text.slice(closing + 1);
        continue;
      }
    }
    if (text.startsWith("_") && !text.startsWith("__")) {
      const closing = closingUnderscore(text, "_");
      if (closing !== -1) {
        tokens.push({type: "em", children: tokenizeInlineMarkdown(text.slice(1, closing))});
        prev = "_";
        text = text.slice(closing + 1);
        continue;
      }
    }
    if (text.startsWith("`")) {
      const closing = text.indexOf("`", 1);
      if (closing !== -1) {
        tokens.push({type: "code", value: text.slice(1, closing)});
        prev = "`";
        text = text.slice(closing + 1);
        continue;
      }
    }
    if (text.startsWith("[")) {
      const endLabel = text.indexOf("]");
      const startHref = endLabel !== -1 ? text.indexOf("(", endLabel) : -1;
      const endHref = startHref !== -1 ? text.indexOf(")", startHref) : -1;
      if (endLabel !== -1 && startHref === endLabel + 1 && endHref !== -1) {
        tokens.push({
          type: "link",
          href: text.slice(startHref + 1, endHref),
          children: tokenizeInlineMarkdown(text.slice(1, endLabel)),
        });
        prev = ")";
        text = text.slice(endHref + 1);
        continue;
      }
    }
    // Text, up to the next character that might open something.
    const nextIndex = ["**", "__", "*", "_", "`", "[", "\n", "\\"]
      .map((needle) => text.indexOf(needle, 1))
      .filter((idx) => idx > 0)
      .reduce((min, idx) => (min === -1 || idx < min ? idx : min), -1);
    if (nextIndex === -1) {
      pushText(text);
      break;
    }
    pushText(text.slice(0, nextIndex));
    text = text.slice(nextIndex);
  }
  return tokens;
}

// Tokens as runs of { text, style }; a link keeps its words alone, as the card is itself a
// link and a link in its excerpt would be a link inside a link (ACCESSIBILITY.md C33).
function toRuns(tokens, style = "", runs = []) {
  tokens.forEach((token) => {
    if (token.type === "text") runs.push({text: token.value || "", style});
    else if (token.type === "code") runs.push({text: token.value || "", style: "code"});
    else if (token.type === "strong" || token.type === "em") {
      const next = token.type === "strong" || style === "strong" ? "strong" : "em";
      toRuns(token.children || [], next, runs);
    } else if (token.type === "link") toRuns(token.children || [], style, runs);
    else if (token.type === "break") runs.push({text: " ", style});
  });
  return runs;
}

function tidyRuns(runs) {
  const out = [];
  runs.forEach((run) => {
    let text = String(run.text || "").replace(/\s+/g, " ");
    const last = out[out.length - 1];
    if ((!last || last.text.endsWith(" ")) && text.startsWith(" ")) text = text.slice(1);
    if (text) out.push({...run, text});
  });
  if (out.length) {
    const last = out[out.length - 1];
    last.text = last.text.replace(/\s+$/, "");
    if (!last.text) out.pop();
  }
  return out;
}

function chooseWindow(plain, query, maxLength) {
  const safeMax = Math.max(60, Number(maxLength) || SNIPPET_LENGTH);
  if (plain.length <= safeMax) return [0, plain.length];
  const lower = plain.toLowerCase();
  let idx = -1;
  let termLength = 0;
  for (const term of queryTerms(query)) {
    const at = lower.indexOf(term.toLowerCase());
    if (at !== -1) {
      idx = at;
      termLength = term.length;
      break;
    }
  }
  let start = idx === -1 ? 0 : Math.max(0, idx - Math.floor((safeMax - termLength) / 2));
  let end = Math.min(plain.length, start + safeMax);
  start = Math.max(0, end - safeMax);
  // At the edges of words.
  if (start > 0) {
    const space = plain.indexOf(" ", start);
    if (space !== -1 && (idx === -1 || space < idx)) start = space + 1;
  }
  if (end < plain.length) {
    const space = plain.lastIndexOf(" ", end);
    if (space > start && (idx === -1 || space >= idx + termLength)) end = space;
  }
  return [start, end];
}

function buildSnippetRuns({text = "", query = "", maxLength = SNIPPET_LENGTH}) {
  const runs = tidyRuns(toRuns(tokenizeInlineMarkdown(String(text || ""))));
  const plain = runs.map((run) => run.text).join("");
  if (!plain) return [];
  const [start, end] = chooseWindow(plain, query, maxLength);
  const clipped = [];
  let offset = 0;
  runs.forEach((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;
    if (runEnd <= start || runStart >= end) return;
    const piece = run.text.slice(Math.max(0, start - runStart), Math.min(run.text.length, end - runStart));
    if (piece) clipped.push({...run, text: piece});
  });
  if (start > 0) clipped.unshift({text: "…", style: ""});
  if (end < plain.length) clipped.push({text: "…", style: ""});
  return clipped;
}

function renderRuns(runs, query) {
  return runs.map((run, idx) => {
    const key = `run-${idx}`;
    const content = highlightTextNode(run.text, query, key);
    if (run.style === "code") return <code key={key}>{content}</code>;
    if (run.style === "strong") return <strong key={key}>{content}</strong>;
    if (run.style === "em") return <em key={key}>{content}</em>;
    return <React.Fragment key={key}>{content}</React.Fragment>;
  });
}

function formatDisplayUrl(href = "") {
  try {
    const url = new URL(
      href,
      href.startsWith("http") ? undefined : "http://example.com"
    );
    if (!href.startsWith("http")) return href;
    const displayPath = url.pathname.replace(/\/$/, "");
    return `${url.host}${displayPath}${url.search}`.replace(/\/$/, "");
  } catch (_) {
    return href;
  }
}

export default function ArticleCard({
  href = "#",
  title = "Untitled",
  annotation = "",
  summary = "",
  summaryMarkdown = "",
  metadata = [],
  query = "",
  recordType = "",
  thumbnail = "",
  headingLevel = 3,
}) {
  // One level below the heading the result sits under (the search page's `h1`, so 2
  // there); 3 where nothing says, as in 1.x.
  const level = Math.min(6, Math.max(2, Math.round(Number(headingLevel)) || 3));
  const Heading = `h${level}`;
  const snippetSource = summaryMarkdown || annotation || summary;
  const snippetRuns = useMemo(
    () => buildSnippetRuns({text: snippetSource, query}),
    [snippetSource, query]
  );
  const metaList = Array.isArray(metadata)
    ? metadata.map((m) => String(m || "")).filter(Boolean)
    : [];
  const displayUrl = useMemo(() => formatDisplayUrl(href), [href]);
  const resolvedHref = useMemo(() => {
    if (recordType === 'annotation' && query && href) {
      return appendQueryParam(href, 'q', query);
    }
    return href;
  }, [href, recordType, query]);

  return (
    <a
      href={resolvedHref}
      className={`canopy-article-card${thumbnail ? " canopy-article-card--media" : ""}`}
    >
      <article>
        {thumbnail ? (
          // The title names the result; its image is a decoration.
          <img
            className="canopy-article-card__thumb"
            src={thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <Heading className="canopy-article-card__title">{title}</Heading>
        {displayUrl ? (
          <span className="canopy-article-card__url">{displayUrl}</span>
        ) : null}
        {snippetRuns.length ? (
          <p className="canopy-article-card__snippet">
            {renderRuns(snippetRuns, query)}
          </p>
        ) : null}
        {metaList.length ? (
          <ul className="canopy-article-card__meta">
            {metaList.slice(0, 3).map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        ) : null}
      </article>
    </a>
  );
}
