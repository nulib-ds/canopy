const React = require("react");
const ReactDOMServer = require("react-dom/server");
const {pathToFileURL} = require("url");
const crypto = require("crypto");
const {
  fs,
  fsp,
  path,
  CONTENT_DIR,
  OUT_DIR,
  CACHE_DIR,
  ensureDirSync,
  withBase,
  readSiteMetadata,
  readPrimaryNavigation,
  getLocaleRouteConfig,
  getDefaultLocaleCode,
} = require("../common");
const globalRoot = typeof globalThis !== "undefined" ? globalThis : global;
if (globalRoot && typeof globalRoot.__canopyRequire !== "function") {
  globalRoot.__canopyRequire = typeof require === "function" ? require : null;
}
const {readCanopyLocalesWithMessages, readLocaleMessages} = require("../locales");

function getSiteLanguageToggle() {
  try {
    const data = readCanopyLocalesWithMessages();
    if (
      data &&
      Array.isArray(data.locales) &&
      data.locales.length
    ) {
      return {
        locales: data.locales,
        messages: data.messages || {},
      };
    }
  } catch (_) {}
  return null;
}
let remarkGfm = null;
try {
  const mod = require("remark-gfm");
  const plugin = mod && (typeof mod === "function" ? mod : mod.default);
  remarkGfm = typeof plugin === "function" ? plugin : null;
} catch (_) {
  remarkGfm = null;
}

const EXTRA_REMARK_PLUGINS = (() => {
  try {
    const absPath = path.resolve(
      process.cwd(),
      "packages/helpers/docs/remark-code-meta.js"
    );
    if (fs.existsSync(absPath)) {
      const plugin = require(absPath);
      if (typeof plugin === "function") return [plugin];
    }
  } catch (_) {}
  return [];
})();

function buildCompileOptions(overrides = {}) {
  const base = {
    jsx: false,
    development: false,
    providerImportSource: "@mdx-js/react",
    jsxImportSource: "react",
    format: "mdx",
  };
  const remarkPlugins = [];
  if (remarkGfm) {
    remarkPlugins.push(remarkGfm);
  }
  if (overrides && Array.isArray(overrides.remarkPlugins)) {
    remarkPlugins.push(...overrides.remarkPlugins);
  }
  if (EXTRA_REMARK_PLUGINS.length) {
    remarkPlugins.push(...EXTRA_REMARK_PLUGINS);
  }
  if (remarkPlugins.length) {
    base.remarkPlugins = remarkPlugins;
  }
  if (overrides && typeof overrides === "object") {
    const {remarkPlugins: _omit, ...rest} = overrides;
    Object.assign(base, rest);
  }
  return base;
}
const yaml = require("js-yaml");
const {getPageContext} = require("../page-context");

const UI_PACKAGE_SPEC = "@canopy-iiif/app/ui";
const UI_SERVER_SPEC = "@canopy-iiif/app/ui/server";
const UI_SPEC_REGEX = new RegExp(`(['"])${UI_PACKAGE_SPEC.replace(/\//g, '\\/')}(['"])`, "g");

function rewriteUiImportsForServer(source) {
  if (typeof source !== "string" || !source.includes(UI_PACKAGE_SPEC)) return source;
  return source.replace(UI_SPEC_REGEX, ($0, open, close) => `${open}${UI_SERVER_SPEC}${close}`);
}

function parseFrontmatter(src) {
  let input = String(src || "");
  // Strip UTF-8 BOM if present
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);
  // Allow a few leading blank lines before frontmatter
  const m = input.match(/^(?:\s*\r?\n)*---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!m) return {data: null, content: input};
  let data = null;
  try {
    data = yaml.load(m[1]) || null;
  } catch (_) {
    data = null;
  }
  const content = input.slice(m[0].length);
  return {data, content};
}

// ESM-only in v3; load dynamically from CJS
let MDXProviderCached = null;
async function getMdxProvider() {
  if (MDXProviderCached) return MDXProviderCached;
  try {
    const mod = await import("@mdx-js/react");
    MDXProviderCached = mod.MDXProvider || mod.default;
  } catch (_) {
    MDXProviderCached = null;
  }
  return MDXProviderCached;
}

// Lazily load UI components from the workspace package and cache them.
// Re-import when the built UI server bundle changes on disk.
let UI_COMPONENTS = null;
let UI_COMPONENTS_PATH = "";
let UI_COMPONENTS_MTIME = 0;
let MERGED_UI_COMPONENTS = null;
let MERGED_UI_KEY = "";
const DEBUG =
  process.env.CANOPY_DEBUG === "1" || process.env.CANOPY_DEBUG === "true";
const APP_COMPONENTS_DIR = path.join(process.cwd(), "app", "components");
const CUSTOM_COMPONENT_ENTRY_CANDIDATES = [
  "mdx.tsx",
  "mdx.ts",
  "mdx.mts",
  "mdx.cts",
  "mdx.jsx",
  "mdx.js",
  "mdx.mjs",
  "mdx.cjs",
  "mdx-components.tsx",
  "mdx-components.ts",
  "mdx-components.mts",
  "mdx-components.cts",
  "mdx-components.jsx",
  "mdx-components.js",
  "mdx-components.mjs",
  "mdx-components.cjs",
];
const CUSTOM_COMPONENT_EXTENSIONS = new Set(
  [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"].map(
    (ext) => ext.toLowerCase()
  )
);
let CUSTOM_MDX_COMPONENTS = null;
let CUSTOM_MDX_SIGNATURE = "";
let CUSTOM_CLIENT_COMPONENT_ENTRIES = [];
let CUSTOM_CLIENT_COMPONENT_PLACEHOLDERS = new Map();
let SERVER_COMPONENT_CACHE = new Map();

function isPlainObject(val) {
  if (!val || typeof val !== "object") return false;
  const proto = Object.getPrototypeOf(val);
  return !proto || proto === Object.prototype;
}

function serializeClientValue(value, depth = 0) {
  if (value == null) return null;
  if (depth > 4) return null;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => serializeClientValue(entry, depth + 1))
      .filter((entry) => typeof entry !== "undefined" && entry !== null);
    return items;
  }
  if (React.isValidElement && React.isValidElement(value)) {
    return null;
  }
  if (isPlainObject(value)) {
    const out = {};
    Object.keys(value).forEach((key) => {
      const result = serializeClientValue(value[key], depth + 1);
      if (typeof result !== "undefined" && result !== null) {
        out[key] = result;
      }
    });
    return out;
  }
  return null;
}

function serializeClientProps(props) {
  if (!props || typeof props !== "object") return {};
  const out = {};
  Object.keys(props).forEach((key) => {
    if (key === "children") {
      const child = props[key];
      if (
        typeof child === "string" ||
        typeof child === "number" ||
        typeof child === "boolean"
      ) {
        out[key] = child;
      }
      return;
    }
    const serialized = serializeClientValue(props[key]);
    if (typeof serialized !== "undefined" && serialized !== null) {
      out[key] = serialized;
    }
  });
  return out;
}

function createClientComponentPlaceholder(name) {
  const safeName = String(name || "");
  return function ClientComponentPlaceholder(props = {}) {
    let payload = {};
    try {
      payload = serializeClientProps(props);
    } catch (_) {
      payload = {};
    }
    let json = "{}";
    try {
      json = JSON.stringify(payload || {});
    } catch (_) {
      json = "{}";
    }
    return React.createElement(
      "div",
      {
        "data-canopy-client-component": safeName,
      },
      React.createElement("script", {type: "application/json"}, json)
    );
  };
}

function getClientComponentPlaceholder(name) {
  const cached = CUSTOM_CLIENT_COMPONENT_PLACEHOLDERS.get(name);
  if (cached) return cached;
  const placeholder = createClientComponentPlaceholder(name);
  CUSTOM_CLIENT_COMPONENT_PLACEHOLDERS.set(name, placeholder);
  return placeholder;
}

async function loadServerComponentFromPath(name, spec) {
  if (!spec || typeof spec !== "string") return null;
  const esbuild = resolveEsbuild();
  if (!esbuild)
    throw new Error(
      "Custom MDX components require esbuild. Install dependencies before building."
    );
  let resolved = spec;
  if (!path.isAbsolute(resolved)) {
    resolved = path.resolve(APP_COMPONENTS_DIR, spec);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(
      '[canopy][mdx] Component "' + String(name) + '" not found at ' + String(spec) + '. Ensure the file exists under app/components.'
    );
  }
  let mtime = 0;
  try {
    const st = fs.statSync(resolved);
    mtime = Math.floor(st.mtimeMs || 0);
  } catch (_) {}
  const cacheKey = resolved;
  const cached = SERVER_COMPONENT_CACHE.get(cacheKey);
  if (cached && cached.mtime === mtime && cached.component) {
    return cached.component;
  }
  ensureDirSync(CACHE_DIR);
  const hash = crypto.createHash("sha1").update(resolved).digest("hex");
  const outFile = path.join(CACHE_DIR, "server-comp-" + hash + ".mjs");
  await esbuild.build({
    entryPoints: [resolved],
    outfile: outFile,
    bundle: true,
    platform: "node",
    target: "node18",
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "react",
    sourcemap: false,
    logLevel: "silent",
    external: [
      "react",
      "react-dom",
      "react-dom/server",
      "react-dom/client",
      "@canopy-iiif/app",
      "@canopy-iiif/app/*",
    ],
    allowOverwrite: true,
  });
  const bust = mtime || Date.now();
  const mod = await import(pathToFileURL(outFile).href + "?v=" + bust);
  let component = null;
  if (mod && typeof mod === "object") {
    component = mod.default || mod[name] || null;
    if (!isComponentLike(component)) {
      component = Object.keys(mod)
        .map((key) => mod[key])
        .find((value) => isComponentLike(value));
    }
  }
  if (!isComponentLike(component)) {
    throw new Error(
      '[canopy][mdx] Component "' +
        String(name) +
        '" from ' +
        String(spec) +
        ' did not export a valid React component. Ensure the module exports a default component or named export matching the key.'
    );
  }
  SERVER_COMPONENT_CACHE.set(cacheKey, {mtime, component});
  return component;
}

async function resolveServerComponentMap(source) {
  const entries = Object.entries(source || {});
  if (!entries.length) return {};
  const resolved = {};
  for (const [key, value] of entries) {
    if (value == null) continue;
    if (typeof value === "string") {
      const component = await loadServerComponentFromPath(key, value);
      if (component) resolved[key] = component;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}
async function loadCoreUiComponents() {
  // Do not rely on a cached mapping; re-import each time to avoid transient races.
  try {
    // Prefer the workspace dist path during dev to avoid export-map resolution issues
    let resolved = null;
    try {
      const wsDist = path.join(
        process.cwd(),
        "packages",
        "app",
        "ui",
        "dist",
        "server.mjs"
      );
      if (fs.existsSync(wsDist)) resolved = wsDist;
    } catch (_) {}
    // Prefer explicit dist path to avoid export-map issues
    if (!resolved) {
      try {
        resolved = require.resolve("@canopy-iiif/app/ui/dist/server.mjs");
      } catch (_) {
        try {
          resolved = require.resolve("@canopy-iiif/app/ui/server");
        } catch (_) {
          resolved = null;
        }
      }
    }
    // Determine current mtime for change detection
    let currentPath = resolved || "";
    let currentMtime = 0;
    if (currentPath) {
      try {
        const st = fs.statSync(currentPath);
        currentMtime = Math.floor(st.mtimeMs || 0);
      } catch (_) {
        currentMtime = 0;
      }
    }
    // If we have a cached module and the path/mtime have not changed, return cached
    if (
      UI_COMPONENTS &&
      UI_COMPONENTS_PATH === currentPath &&
      UI_COMPONENTS_MTIME === currentMtime
    ) {
      if (DEBUG) {
        try {
          console.log("[canopy][mdx] UI components cache hit:", {
            path: UI_COMPONENTS_PATH,
            mtime: UI_COMPONENTS_MTIME,
          });
        } catch (_) {}
      }
      return UI_COMPONENTS;
    }
    let mod = null;
    let importErr = null;
    if (resolved) {
      const {pathToFileURL} = require("url");
      const fileUrl = pathToFileURL(resolved).href;
      const attempts = 5;
      for (let i = 0; i < attempts && !mod; i++) {
        const bustVal = currentMtime
          ? String(currentMtime) + '-' + String(i)
          : String(Date.now()) + '-' + String(i);
        try {
          mod = await import(fileUrl + '?v=' + bustVal);
        } catch (e) {
          importErr = e;
          if (DEBUG) {
            try {
              console.warn(
                "[canopy][mdx] ESM import failed for",
                resolved,
                "(attempt",
                i + 1,
                "of",
                attempts + ")\n",
                e && (e.stack || e.message || String(e))
              );
            } catch (_) {}
          }
          // Small delay to avoid watch-write race
          await new Promise((r) => setTimeout(r, 60));
        }
      }
      if (DEBUG) {
        try {
          console.log("[canopy][mdx] UI components resolved", {
            path: resolved,
            mtime: currentMtime,
            loaded: !!mod,
          });
        } catch (_) {}
      }
    }
    if (!mod) {
      // Try package subpath as a secondary resolution path to avoid export-map issues
      try {
        mod = await import("@canopy-iiif/app/ui/server");
      } catch (e2) {
        const msgA = importErr && (importErr.stack || importErr.message);
        const msgB = e2 && (e2.stack || e2.message);
        throw new Error(
          "Failed to load @canopy-iiif/app/ui/server. Ensure the UI package is built.\nPath import error: " +
            (msgA || "") +
            "\nExport-map import error: " +
            (msgB || "")
        );
      }
    }
    let comp = mod && typeof mod === "object" ? mod : {};
    // Hard-require core exports; do not inject fallbacks
    const required = [
      "SearchPanel",
      "SearchFormModal",
      "SearchResults",
      "SearchSummary",
      "SearchTabs",
      "Viewer",
      "Slider",
      "RelatedItems",
      "Interstitials",
    ];
    const missing = required.filter((k) => !comp || !comp[k]);
    if (missing.length) {
      throw new Error(
        "[canopy][mdx] Missing UI exports: " + missing.join(", ")
      );
    }
    if (DEBUG) {
      try {
        console.log("[canopy][mdx] UI component sources", {
          path: currentPath,
          mtime: currentMtime,
          hasServerExport: !!mod,
          hasWorkspace: typeof comp !== "undefined",
          SearchFormModal: !!comp.SearchFormModal,
          Viewer: !!comp.Viewer,
          Slider: !!comp.Slider,
        });
      } catch (_) {}
    }
    UI_COMPONENTS = comp;
    UI_COMPONENTS_PATH = currentPath;
    UI_COMPONENTS_MTIME = currentMtime;
  } catch (e) {
    const msg = (e && (e.stack || e.message || String(e))) || "unknown error";
    throw new Error(
      "[canopy][mdx] Failed to load UI components (no fallbacks): " + msg
    );
  }
  return UI_COMPONENTS;
}

function resolveCustomComponentsEntry() {
  const baseDir = APP_COMPONENTS_DIR;
  if (!baseDir) return null;
  try {
    if (!fs.existsSync(baseDir)) return null;
  } catch (_) {
    return null;
  }
  for (const candidate of CUSTOM_COMPONENT_ENTRY_CANDIDATES) {
    const full = path.join(baseDir, candidate);
    try {
      const st = fs.statSync(full);
      if (st && st.isFile()) return full;
    } catch (_) {}
  }
  return null;
}

function computeCustomComponentsSignature(entryPath) {
  const baseDir = fs.existsSync(APP_COMPONENTS_DIR)
    ? APP_COMPONENTS_DIR
    : path.dirname(entryPath);
  let newest = 0;
  const stack = [];
  if (baseDir && fs.existsSync(baseDir)) stack.push(baseDir);
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      const ext = path.extname(full).toLowerCase();
      if (!CUSTOM_COMPONENT_EXTENSIONS.has(ext)) continue;
      try {
        const st = fs.statSync(full);
        const mtime = st && st.mtimeMs ? Math.floor(st.mtimeMs) : 0;
        if (mtime > newest) newest = mtime;
      } catch (_) {}
    }
  }
  const entryKey = (() => {
    try {
      return path.resolve(entryPath);
    } catch (_) {
      return entryPath;
    }
  })();
  return String(entryKey) + ':' + String(newest);
}

async function compileCustomComponentModule(entryPath, signature) {
  const esbuild = resolveEsbuild();
  if (!esbuild)
    throw new Error(
      "Custom MDX components require esbuild. Install dependencies before building."
    );
  ensureDirSync(CACHE_DIR);
  const rel = (() => {
    try {
      return path
        .relative(process.cwd(), entryPath)
        .split(path.sep)
        .join("/");
    } catch (_) {
      return entryPath;
    }
  })();
  const tmpFile = path.join(CACHE_DIR, "custom-mdx-components.mjs");
  try {
    await esbuild.build({
      entryPoints: [entryPath],
      outfile: tmpFile,
      bundle: true,
      platform: "node",
      target: "node18",
      format: "esm",
      sourcemap: false,
      logLevel: "silent",
      jsx: "automatic",
      jsxImportSource: "react",
      external: [
        "react",
        "react-dom",
        "react-dom/server",
        "react-dom/client",
        "@canopy-iiif/app",
        "@canopy-iiif/app/*",
        "@canopy-iiif/app/ui",
        "@canopy-iiif/app/ui/*",
      ],
      allowOverwrite: true,
    });
    try {
      const built = fs.readFileSync(tmpFile, "utf8");
      const rewritten = rewriteUiImportsForServer(built);
      if (rewritten !== built) {
        fs.writeFileSync(tmpFile, rewritten, "utf8");
      }
    } catch (_) {}
  } catch (err) {
    const msg = err && (err.message || err.stack) ? err.message || err.stack : err;
    throw new Error(
      'Failed to compile custom MDX components (' +
        rel +
        ').\n' +
        (msg || 'Unknown error')
    );
  }
  const cacheBust = signature || String(Date.now());
  return import(pathToFileURL(tmpFile).href + '?custom=' + cacheBust);
}

function isComponentLike(value) {
  if (value == null) return false;
  if (typeof value === "function") return true;
  if (typeof value === "object") {
    if (value.$$typeof) return true;
    if (value.render && typeof value.render === "function") return true;
  }
  return false;
}

function cloneComponentMap(source) {
  const out = {};
  Object.keys(source || {}).forEach((key) => {
    const value = source[key];
    if (typeof value === "undefined" || value === null) return;
    out[key] = value;
  });
  return out;
}

async function normalizeCustomComponentExports(mod) {
  if (!mod || typeof mod !== "object") return {components: {}, clientEntries: []};
  const candidateKeys = ["components", "mdxComponents", "MDXComponents"];
  let components = {};
  for (const key of candidateKeys) {
    if (mod[key] && typeof mod[key] === "object") {
      const cloned = cloneComponentMap(mod[key]);
      if (Object.keys(cloned).length) {
        components = cloned;
        break;
      }
    }
  }
  if (!Object.keys(components).length && mod.default && typeof mod.default === "object") {
    const cloned = cloneComponentMap(mod.default);
    if (Object.keys(cloned).length) components = cloned;
  }
  if (!Object.keys(components).length) {
    const fallback = {};
    Object.keys(mod).forEach((key) => {
      if (key === "default" || key === "__esModule") return;
      const value = mod[key];
      if (!isComponentLike(value)) return;
      fallback[key] = value;
    });
    components = fallback;
  }
  if (Object.keys(components).length) {
    components = await resolveServerComponentMap(components);
  }
  const clientEntries = [];
  const rawClient = mod && typeof mod === "object" ? mod.clientComponents : null;
  if (rawClient && typeof rawClient === "object") {
    Object.keys(rawClient).forEach((key) => {
      const spec = rawClient[key];
      if (typeof spec !== "string" || !spec.trim()) return;
      let resolved = spec.trim();
      if (!path.isAbsolute(resolved)) {
        resolved = path.resolve(APP_COMPONENTS_DIR, resolved);
      }
      if (!fs.existsSync(resolved)) {
        throw new Error(
          `[canopy][mdx] Client component "${key}" not found at ${spec}. Ensure the file exists under app/components.`
        );
      }
      clientEntries.push({
        name: String(key),
        source: spec,
        path: resolved,
      });
    });
  }
  if (clientEntries.length) {
    clientEntries.forEach((entry) => {
      components[entry.name] = getClientComponentPlaceholder(entry.name);
    });
  }
  return {components, clientEntries};
}

async function loadCustomMdxComponents() {
  const entry = resolveCustomComponentsEntry();
  if (!entry) {
    CUSTOM_MDX_COMPONENTS = null;
    CUSTOM_MDX_SIGNATURE = "";
    CUSTOM_CLIENT_COMPONENT_ENTRIES = [];
    return null;
  }
  const signature = computeCustomComponentsSignature(entry);
  if (
    CUSTOM_MDX_COMPONENTS &&
    CUSTOM_MDX_SIGNATURE &&
    CUSTOM_MDX_SIGNATURE === signature
  ) {
    return {
      components: CUSTOM_MDX_COMPONENTS,
      signature,
      clientEntries: CUSTOM_CLIENT_COMPONENT_ENTRIES.slice(),
    };
  }
  const mod = await compileCustomComponentModule(entry, signature);
  const {components, clientEntries} = await normalizeCustomComponentExports(mod);
  CUSTOM_MDX_COMPONENTS = components;
  CUSTOM_MDX_SIGNATURE = signature;
  CUSTOM_CLIENT_COMPONENT_ENTRIES = Array.isArray(clientEntries)
    ? clientEntries.slice()
    : [];
  return {components, signature, clientEntries: CUSTOM_CLIENT_COMPONENT_ENTRIES};
}

async function loadUiComponents() {
  const baseComponents = await loadCoreUiComponents();
  const custom = await loadCustomMdxComponents();
  const customKey = custom && custom.signature ? custom.signature : "";
  const compositeKey = `${UI_COMPONENTS_PATH || ""}:${
    UI_COMPONENTS_MTIME || 0
  }:${customKey}`;
  if (MERGED_UI_COMPONENTS && MERGED_UI_KEY === compositeKey) {
    return MERGED_UI_COMPONENTS;
  }
  const merged =
    custom &&
    custom.components &&
    Object.keys(custom.components).length > 0
      ? {...baseComponents, ...custom.components}
      : baseComponents;
  MERGED_UI_COMPONENTS = merged;
  MERGED_UI_KEY = compositeKey;
  return MERGED_UI_COMPONENTS;
}

function slugifyHeading(text) {
  try {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  } catch (_) {
    return "";
  }
}

function extractHeadings(mdxSource) {
  const {content} = parseFrontmatter(String(mdxSource || ""));
  const cleaned = content.replace(/```[\s\S]*?```/g, "");
  const headingRegex = /^ {0,3}(#{1,6})\s+(.+?)\s*$/gm;
  const seen = new Map();
  const headings = [];
  let match;
  while ((match = headingRegex.exec(cleaned))) {
    const hashes = match[1] || "";
    const depth = hashes.length;
    let raw = match[2] || "";
    let explicitId = null;
    const idMatch = raw.match(/\s*\{#([A-Za-z0-9_-]+)\}\s*$/);
    if (idMatch) {
      explicitId = idMatch[1];
      raw = raw.slice(0, raw.length - idMatch[0].length);
    }
    const title = raw
      .replace(/\<[^>]*\>/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .trim();
    if (!title) continue;
    const baseId =
      explicitId || slugifyHeading(title) || `section-${headings.length + 1}`;
    const count = seen.get(baseId) || 0;
    seen.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
    headings.push({
      id,
      title,
      depth,
    });
  }
  return headings;
}

function extractPlainText(mdxSource) {
  let {content} = parseFrontmatter(String(mdxSource || ""));
  if (!content) return "";
  content = content.replace(/```[\s\S]*?```/g, " ");
  content = content.replace(/`{1,3}([^`]+)`{1,3}/g, "$1");
  content = content.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  content = content.replace(/\[[^\]]*\]\([^)]*\)/g, "$1");
  content = content.replace(/<[^>]+>/g, " ");
  content = content.replace(/\{#([^}]+)\}/g, " ");
  content = content.replace(/\{\/[A-Za-z0-9_.-]+\}/g, " ");
  content = content.replace(/\{[^{}]*\}/g, " ");
  content = content.replace(/[#>*~_\-]+/g, " ");
  content = content.replace(/\n+/g, " ");
  content = content.replace(/\s+/g, " ").trim();
  return content;
}

function extractMarkdownSummary(mdxSource) {
  let {content} = parseFrontmatter(String(mdxSource || ""));
  if (!content) return "";
  content = content.replace(/^import[^\n]+$/gm, " ");
  content = content.replace(/^export[^\n]+$/gm, " ");
  content = content.replace(/```[\s\S]*?```/g, " ");
  content = content.replace(/<[A-Za-z][^>]*?>[\s\S]*?<\/[A-Za-z][^>]*?>/g, " ");
  content = content.replace(/<[A-Za-z][^>]*?\/>/g, " ");
  content = content.replace(/\{\/[A-Za-z0-9_.-]+\}/g, " ");
  content = content.replace(/\{[^{}]*\}/g, " ");
  content = content.replace(/^#{1,6}\s+.*$/gm, " ");
  content = content.replace(/\s+/g, " ").trim();
  return content;
}

function extractTitle(mdxSource) {
  const {data, content} = parseFrontmatter(String(mdxSource || ""));
  if (data && typeof data.title === "string" && data.title.trim()) {
    return data.title.trim();
  }
  const m = content.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
  return m ? m[1].trim() : "Untitled";
}

function isReservedFile(p) {
  const base = path.basename(p);
  return base.startsWith("_");
}

// Cache for directory-scoped layouts
const DIR_LAYOUTS = new Map();
async function getNearestDirLayout(filePath) {
  const dirStart = path.dirname(filePath);
  let dir = dirStart;
  while (dir && dir.startsWith(CONTENT_DIR)) {
    const key = path.resolve(dir);
    if (DIR_LAYOUTS.has(key)) {
      const cached = DIR_LAYOUTS.get(key);
      if (cached) return cached;
    }
    const candidate = path.join(dir, "_layout.mdx");
    if (fs.existsSync(candidate)) {
      try {
        const Comp = await compileMdxToComponent(candidate);
        DIR_LAYOUTS.set(key, Comp);
        return Comp;
      } catch (_) {
        DIR_LAYOUTS.set(key, null);
      }
    } else {
      DIR_LAYOUTS.set(key, null);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

let APP_WRAPPER = null; // { App, Head } or null
async function loadAppWrapper() {
  if (APP_WRAPPER !== null) return APP_WRAPPER;
  const appPath = path.join(CONTENT_DIR, "_app.mdx");
  if (!fs.existsSync(appPath)) {
    // Keep missing _app as a build-time error as specified
    throw new Error("Missing required file: content/_app.mdx");
  }
  const {compile} = await import("@mdx-js/mdx");
  const raw = await fsp.readFile(appPath, "utf8");
  const {content: source} = parseFrontmatter(raw);
  const safeSource = rewriteUiImportsForServer(source);
  let code = String(await compile(safeSource, buildCompileOptions()));
  // MDX v3 default export (MDXContent) does not forward external children.
  // When present, expose the underlying layout function as __MDXLayout for wrapping.
  if (
    /\bconst\s+MDXLayout\b/.test(code) &&
    !/export\s+const\s+__MDXLayout\b/.test(code)
  ) {
    code += "\nexport const __MDXLayout = MDXLayout;\n";
  }
  ensureDirSync(CACHE_DIR);
  const tmpFile = path.join(CACHE_DIR, "_app.mjs");
  await fsp.writeFile(tmpFile, code, "utf8");
  const mod = await import(pathToFileURL(tmpFile).href + `?v=${Date.now()}`);
  let App = mod.App || mod.__MDXLayout || mod.default || null;
  const Head = mod.Head || null;
  // Prefer a component that renders its children, but do not hard-fail if probe fails.
  let ok = false;
  try {
    // Try to render the probe inside an MDXProvider with UI server components
    const components = await loadUiComponents();
    const MDXProvider = await getMdxProvider();
    const probeChild = React.createElement("span", {"data-canopy-probe": "1"});
    const probeTree = React.createElement(
      App || (() => null),
      null,
      probeChild
    );
    const probe = MDXProvider
      ? React.createElement(MDXProvider, {components}, probeTree)
      : probeTree;
    const out = ReactDOMServer.renderToStaticMarkup(probe);
    ok = !!(out && out.indexOf("data-canopy-probe") !== -1);
  } catch (_) {
    ok = false;
  }
  if (!ok) {
    throw new Error(
      "content/_app.mdx must render {children}. Update the layout so downstream pages receive their content."
    );
  }
  APP_WRAPPER = {App, Head};
  return APP_WRAPPER;
}

async function compileMdxFile(filePath, outPath, Layout, extraProps = {}) {
  const {compile} = await import("@mdx-js/mdx");
  const raw = await fsp.readFile(filePath, "utf8");
  const {content: source} = parseFrontmatter(raw);
  const safeSource = rewriteUiImportsForServer(source);
  const compiled = await compile(safeSource, buildCompileOptions());
  const code = String(compiled);
  ensureDirSync(CACHE_DIR);
  const relCacheName =
    path
      .relative(CONTENT_DIR, filePath)
      .replace(/[\\/]/g, "_")
      .replace(/\.mdx$/i, "") + ".mjs";
  const tmpFile = path.join(CACHE_DIR, relCacheName);
  await fsp.writeFile(tmpFile, code, "utf8");
  // Bust ESM module cache using source mtime
  let bust = "";
  try {
    const st = fs.statSync(filePath);
    bust = `?v=${Math.floor(st.mtimeMs)}`;
  } catch (_) {}
  const mod = await import(pathToFileURL(tmpFile).href + bust);
  const MDXContent = mod.default || mod.MDXContent || mod;
  const components = await loadUiComponents();
  const markdownTableComponent =
    components &&
    (components.MarkdownTable ||
      components.DocsMarkdownTable ||
      components.MarkdownTables ||
      components.MDXMarkdownTable);
  const codeBlockComponent =
    components &&
    (components.DocsCodeBlock ||
      components.CodeBlock ||
      components.MarkdownCodeBlock ||
      components.MDXCodeBlock);
  const rawHeadings = Array.isArray(
    extraProps && extraProps.page && extraProps.page.headings
  )
    ? extraProps.page.headings
        .map((heading) => (heading ? {...heading} : heading))
        .filter(Boolean)
    : [];
  const headingQueue = rawHeadings.slice();
  const headingIdCounts = new Map();
  headingQueue.forEach((heading) => {
    if (heading && heading.id) {
      const key = String(heading.id);
      headingIdCounts.set(key, (headingIdCounts.get(key) || 0) + 1);
    }
  });

  function reserveHeadingId(base) {
    const fallback = base || "section";
    let candidate = fallback;
    let attempt = 1;
    while (headingIdCounts.has(candidate)) {
      attempt += 1;
      candidate = `${fallback}-${attempt}`;
    }
    headingIdCounts.set(candidate, 1);
    return candidate;
  }

  function extractTextFromChildren(children) {
    if (children == null) return "";
    if (typeof children === "string" || typeof children === "number")
      return String(children);
    if (Array.isArray(children))
      return children.map((child) => extractTextFromChildren(child)).join("");
    if (React.isValidElement(children))
      return extractTextFromChildren(children.props && children.props.children);
    return "";
  }

  function takeHeading(level, children) {
    if (!headingQueue.length) return null;
    const idx = headingQueue.findIndex((item) => {
      if (!item || typeof item !== "object") return false;
      const depth = typeof item.depth === "number" ? item.depth : item.level;
      return depth === level;
    });
    if (idx === -1) return null;
    const [heading] = headingQueue.splice(idx, 1);
    if (!heading.id) {
      const text = heading.title || extractTextFromChildren(children);
      const baseId = slugifyHeading(text);
      heading.id = reserveHeadingId(baseId);
    }
    if (!heading.title) {
      heading.title = extractTextFromChildren(children);
    }
    return heading;
  }

  function createHeadingComponent(level) {
    const tag = `h${level}`;
    const Base = components && components[tag] ? components[tag] : tag;
    return function HeadingComponent(props) {
      const heading = takeHeading(level, props && props.children);
      const id = props && props.id ? props.id : heading && heading.id;
      const finalProps = id ? {...props, id} : props;
      return React.createElement(Base, finalProps, props && props.children);
    };
  }

  const levelsPresent = Array.from(
    new Set(
      headingQueue
        .map((heading) => (heading ? heading.depth || heading.level : null))
        .filter(
          (level) => typeof level === "number" && level >= 1 && level <= 6
        )
    )
  );
  const headingComponents = levelsPresent.length
    ? levelsPresent.reduce((acc, level) => {
        acc[`h${level}`] = createHeadingComponent(level);
        return acc;
      }, {})
    : {};
  const MDXProvider = await getMdxProvider();
  // Base path support for anchors
  const Anchor = function A(props) {
    let {href = "", ...rest} = props || {};
    href = withBase(href);
    return React.createElement("a", {href, ...rest}, props.children);
  };
  const app = await loadAppWrapper();
  const dirLayout = await getNearestDirLayout(filePath);
  const contentNode = React.createElement(MDXContent, extraProps);
  const layoutProps = dirLayout ? {...extraProps} : null;
  const withLayout = dirLayout
    ? React.createElement(dirLayout, layoutProps, contentNode)
    : contentNode;
  const withApp = React.createElement(app.App, null, withLayout);
  const PageContext = getPageContext();
  const siteMeta = readSiteMetadata();
  const pageLocale =
    extraProps && extraProps.page && typeof extraProps.page.locale === "string"
      ? extraProps.page.locale
      : undefined;
  const primaryNav = readPrimaryNavigation(pageLocale);
  const siteLanguageToggle = getSiteLanguageToggle();
  const siteContext = siteMeta ? {...siteMeta} : {};
  if (siteLanguageToggle) {
    siteContext.languageToggle = siteLanguageToggle;
  }
  try {
    const localeMessages = readLocaleMessages(pageLocale);
    if (localeMessages) siteContext.localeMessages = localeMessages;
  } catch (_) {}
  try {
    const localeRoutes = getLocaleRouteConfig(pageLocale);
    if (localeRoutes) siteContext.routes = localeRoutes;
  } catch (_) {}
  try {
    const defaultRoutes = getLocaleRouteConfig(getDefaultLocaleCode());
    if (defaultRoutes) siteContext.routesDefault = defaultRoutes;
  } catch (_) {}
  const contextValue = {
    navigation:
      extraProps && extraProps.navigation ? extraProps.navigation : null,
    page: extraProps && extraProps.page ? extraProps.page : null,
    site: siteContext && Object.keys(siteContext).length ? siteContext : null,
    primaryNavigation: Array.isArray(primaryNav) ? primaryNav : [],
  };
  const withContext = PageContext
    ? React.createElement(PageContext.Provider, {value: contextValue}, withApp)
    : withApp;
  const compMap = {...components, ...headingComponents, a: Anchor};
  if (markdownTableComponent && !compMap.table) {
    compMap.table = markdownTableComponent;
  }
  if (codeBlockComponent && !compMap.pre) {
    compMap.pre = codeBlockComponent;
  }
  const page = MDXProvider
    ? React.createElement(MDXProvider, {components: compMap}, withContext)
    : withContext;
  const body = ReactDOMServer.renderToStaticMarkup(page);
  let head = "";
  if (app && app.Head) {
    const headElement = React.createElement(app.Head, {
      page: contextValue.page,
      navigation: contextValue.navigation,
    });
    const wrappedHead = PageContext
      ? React.createElement(
          PageContext.Provider,
          {value: contextValue},
          headElement
        )
      : headElement;
    head = ReactDOMServer.renderToStaticMarkup(wrappedHead);
  }
  return {body, head};
}

async function compileMdxToComponent(filePath) {
  const {compile} = await import("@mdx-js/mdx");
  const raw = await fsp.readFile(filePath, "utf8");
  const {content: source} = parseFrontmatter(raw);
  const compiled = await compile(source, buildCompileOptions());
  const code = String(compiled);
  ensureDirSync(CACHE_DIR);
  const relCacheName =
    path
      .relative(CONTENT_DIR, filePath)
      .replace(/[\\/]/g, "_")
      .replace(/\.mdx$/i, "") + ".mjs";
  const tmpFile = path.join(CACHE_DIR, relCacheName);
  await fsp.writeFile(tmpFile, code, "utf8");
  let bust = "";
  try {
    const st = fs.statSync(filePath);
    bust = `?v=${Math.floor(st.mtimeMs)}`;
  } catch (_) {}
  const mod = await import(pathToFileURL(tmpFile).href + bust);
  return mod.default || mod.MDXContent || mod;
}

async function loadCustomLayout(defaultLayout) {
  // Deprecated: directory-scoped layouts handled per-page via getNearestDirLayout
  return defaultLayout;
}

function resolveEsbuild() {
  try {
    return require("../../ui/node_modules/esbuild");
  } catch (_) {
    try {
      return require("esbuild");
    } catch (_) {
      return null;
    }
  }
}

function createReactShimPlugin() {
  const reactShim = `
    const React = (typeof window !== 'undefined' && window.React) || {};
    export default React;
    export const Children = React.Children;
    export const Component = React.Component;
    export const Fragment = React.Fragment;
    export const createElement = React.createElement;
    export const cloneElement = React.cloneElement;
    export const createContext = React.createContext;
    export const forwardRef = React.forwardRef;
    export const memo = React.memo;
    export const startTransition = React.startTransition;
    export const isValidElement = React.isValidElement;
    export const useEffect = React.useEffect;
    export const useLayoutEffect = React.useLayoutEffect;
    export const useMemo = React.useMemo;
    export const useState = React.useState;
    export const useRef = React.useRef;
    export const useCallback = React.useCallback;
    export const useContext = React.useContext;
    export const useReducer = React.useReducer;
    export const useId = React.useId;
    export const useImperativeHandle = React.useImperativeHandle;
    export const useTransition = React.useTransition;
    export const useDeferredValue = React.useDeferredValue;
    export const useDebugValue = React.useDebugValue;
    export const useSyncExternalStore = React.useSyncExternalStore;
    export const useInsertionEffect = React.useInsertionEffect;
  `;
  const rdomShim = `
    const ReactDOM = (typeof window !== 'undefined' && window.ReactDOM) || {};
    export default ReactDOM;
    export const render = ReactDOM.render;
    export const hydrate = ReactDOM.hydrate;
    export const findDOMNode = ReactDOM.findDOMNode;
    export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
    export const createPortal = ReactDOM.createPortal;
    export const flushSync = ReactDOM.flushSync;
    export const unstable_batchedUpdates = ReactDOM.unstable_batchedUpdates;
    export const unstable_renderSubtreeIntoContainer = ReactDOM.unstable_renderSubtreeIntoContainer;
  `;
  const rdomClientShim = `
    const RDC = (typeof window !== 'undefined' && window.ReactDOMClient) || {};
    export const createRoot = RDC.createRoot;
    export const hydrateRoot = RDC.hydrateRoot;
  `;
  return {
    name: "canopy-react-shims",
    setup(build) {
      const ns = "canopy-shim";
      build.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: ns }));
      build.onResolve({ filter: /^react-dom$/ }, () => ({ path: "react-dom", namespace: ns }));
      build.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: "react-dom-client", namespace: ns }));
      build.onLoad({ filter: /^react$/, namespace: ns }, () => ({ contents: reactShim, loader: "js" }));
      build.onLoad({ filter: /^react-dom$/, namespace: ns }, () => ({ contents: rdomShim, loader: "js" }));
      build.onLoad({ filter: /^react-dom-client$/, namespace: ns }, () => ({ contents: rdomClientShim, loader: "js" }));
    },
  };
}

function createSliderCssInlinePlugin() {
  return {
    name: "canopy-inline-slider-css",
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, (args) => {
        const fs = require("fs");
        let css = "";
        try {
          css = fs.readFileSync(args.path, "utf8");
        } catch (_) {
          css = "";
        }
        const js = [
          `var css = ${JSON.stringify(css)};`,
          `(function(){ try { var s = document.createElement('style'); s.setAttribute('data-canopy-slider-css',''); s.textContent = css; document.head.appendChild(s); } catch (e) {} })();`,
          `export default css;`,
        ].join("\n");
        return { contents: js, loader: "js" };
      });
    },
  };
}

let cloverRuntimePromise = null;

function renameAnonymousChunks(scriptsDir) {
  try {
    const entries = fs
      .readdirSync(scriptsDir)
      .filter((name) => name.startsWith('canopy-chunk-') && name.endsWith('.js'));
    if (!entries.length) return;
    const replacements = [];
    for (const oldName of entries) {
      const newName = `canopy-shared-${oldName.slice('canopy-chunk-'.length)}`;
      if (newName === oldName) continue;
      const fromPath = path.join(scriptsDir, oldName);
      const toPath = path.join(scriptsDir, newName);
      try {
        fs.renameSync(fromPath, toPath);
        replacements.push({ from: oldName, to: newName });
      } catch (_) {}
    }
    if (!replacements.length) return;
    const targetFiles = fs
      .readdirSync(scriptsDir)
      .filter((name) => name.endsWith('.js'));
    for (const filename of targetFiles) {
      const filePath = path.join(scriptsDir, filename);
      let contents = '';
      try {
        contents = fs.readFileSync(filePath, 'utf8');
      } catch (_) {
        continue;
      }
      let changed = false;
      replacements.forEach(({ from, to }) => {
        if (contents.includes(from)) {
          contents = contents.split(from).join(to);
          changed = true;
        }
      });
      if (changed) {
        try {
          fs.writeFileSync(filePath, contents, 'utf8');
        } catch (_) {}
      }
    }
  } catch (_) {}
}

// Clover dependencies use native BigInt literals, requiring ES2020 or newer.
async function buildCloverHydrationRuntimes() {
  const esbuild = resolveEsbuild();
  if (!esbuild)
    throw new Error(
      "Clover hydration runtimes require esbuild. Install dependencies before building."
    );
  ensureDirSync(OUT_DIR);
  const scriptsDir = path.join(OUT_DIR, "scripts");
  ensureDirSync(scriptsDir);
  const entryPoints = {
    viewer: path.join(__dirname, "../components/viewer-runtime-entry.js"),
    slider: path.join(__dirname, "../components/slider-runtime-entry.js"),
    "image-story": path.join(
      __dirname,
      "../components/image-story-runtime-entry.js",
    ),
  };
  await esbuild.build({
    entryPoints,
    outdir: scriptsDir,
    entryNames: "canopy-[name]",
    chunkNames: "canopy-[name]-[hash]",
    bundle: true,
    platform: "browser",
    format: "esm",
    splitting: true,
    sourcemap: false,
    target: ["es2020"],
    logLevel: "silent",
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [createReactShimPlugin(), createSliderCssInlinePlugin()],
  });
  renameAnonymousChunks(scriptsDir);
  try {
    const { logLine } = require("./log");
    const runtimeLabels = {
      viewer: "Viewer, Scroll, and Image runtime",
      slider: "Slider runtime",
      "image-story": "ImageStory runtime",
    };
    Object.keys(entryPoints).forEach((key) => {
      const file = `canopy-${key}.js`;
      try {
        const abs = path.join(scriptsDir, file);
        const st = fs.statSync(abs);
        const size = st && st.size ? st.size : 0;
        const kb = size ? ` (${(size / 1024).toFixed(1)} KB)` : "";
        const rel = path.relative(process.cwd(), abs).split(path.sep).join("/");
        const label = runtimeLabels[key] ? ` – ${runtimeLabels[key]}` : "";
        logLine(`✓ Wrote ${rel}${kb}${label}`, "cyan");
      } catch (_) {}
    });
  } catch (_) {}
}

async function ensureClientRuntime() {
  if (!cloverRuntimePromise) {
    cloverRuntimePromise = buildCloverHydrationRuntimes();
  }
  return cloverRuntimePromise;
}

function getCustomClientComponentEntries() {
  return Array.isArray(CUSTOM_CLIENT_COMPONENT_ENTRIES)
    ? CUSTOM_CLIENT_COMPONENT_ENTRIES.slice()
    : [];
}

let customClientRuntimePromise = null;
let customClientRuntimeSignature = "";

function computeClientRuntimeSignature(entries) {
  if (!entries || !entries.length) return "";
  const parts = entries
    .map((entry) => {
      const abs = entry && entry.path ? entry.path : "";
      let mtime = 0;
      if (abs) {
        try {
          const st = fs.statSync(abs);
          mtime = Math.floor(st.mtimeMs || 0);
        } catch (_) {}
      }
      return `${entry.name || ""}:${abs}:${mtime}`;
    })
    .sort();
  return parts.join("|");
}

async function buildCustomClientRuntime(entries) {
  const esbuild = resolveEsbuild();
  if (!esbuild) {
    throw new Error(
      "Custom client component hydration requires esbuild. Install dependencies before building."
    );
  }
  ensureDirSync(OUT_DIR);
  const scriptsDir = path.join(OUT_DIR, "scripts");
  ensureDirSync(scriptsDir);
  const outFile = path.join(scriptsDir, "canopy-custom-components.js");
  const imports = entries
    .map((entry, index) => {
      const ident = `Component${index}`;
      return `import ${ident} from ${JSON.stringify(entry.path)}; registry.set(${JSON.stringify(
        entry.name
      )}, ${ident});`;
    })
    .join("\n");
  const runtimeSource = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    const registry = new Map();
    ${imports}
    function ready(fn){ if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', fn, { once: true }); } else { fn(); } }
    function parseProps(node){ try { const script = node.querySelector('script[type="application/json"]'); if (!script) return {}; const text = script.textContent || '{}'; const data = JSON.parse(text); if (script.parentNode) { script.parentNode.removeChild(script); } return (data && typeof data === 'object') ? data : {}; } catch (_) { return {}; } }
    const roots = new WeakMap();
    function mount(node, Component){ if(!node || !Component) return; const props = parseProps(node); let root = roots.get(node); if(!root){ root = createRoot(node); roots.set(node, root); } root.render(React.createElement(Component, props)); }
    function hydrateAll(){
      const nodes = document.querySelectorAll('[data-canopy-client-component]');
      nodes.forEach((node) => {
        if (!node || node.__canopyClientMounted) return;
        const name = node.getAttribute('data-canopy-client-component');
        const Component = registry.get(name);
        if (!Component) return;
        mount(node, Component);
        node.__canopyClientMounted = true;
      });
    }
    ready(hydrateAll);
  `;
  await esbuild.build({
    stdin: {
      contents: runtimeSource,
      resolveDir: process.cwd(),
      sourcefile: "canopy-custom-client-runtime.js",
      loader: "js",
    },
    outfile: outFile,
    bundle: true,
    platform: "browser",
    target: ["es2020"],
    format: "esm",
    sourcemap: false,
    minify: true,
    logLevel: "silent",
    plugins: [createReactShimPlugin()],
  });
  try {
    const {logLine} = require("./log");
    let size = 0;
    try {
      const st = fs.statSync(outFile);
      size = st && st.size ? st.size : 0;
    } catch (_) {}
    const kb = size ? ` (${(size / 1024).toFixed(1)} KB)` : "";
    const rel = path.relative(process.cwd(), outFile).split(path.sep).join("/");
    logLine(`✓ Wrote ${rel}${kb}`, "cyan");
  } catch (_) {}
}

async function ensureCustomClientRuntime() {
  const entries = getCustomClientComponentEntries();
  if (!entries.length) return null;
  const signature = computeClientRuntimeSignature(entries);
  if (customClientRuntimePromise && customClientRuntimeSignature === signature) {
    return customClientRuntimePromise;
  }
  customClientRuntimeSignature = signature;
  customClientRuntimePromise = buildCustomClientRuntime(entries);
  return customClientRuntimePromise;
}

// Facets runtime: fetches /api/search/facets.json, picks a value per label (random from top 3),
// and renders a Slider for each.
async function ensureFacetsRuntime() {
  let esbuild = null;
  try {
    esbuild = require("../../ui/node_modules/esbuild");
  } catch (_) {
    try {
      esbuild = require("esbuild");
    } catch (_) {}
  }
  if (!esbuild) {
    throw new Error(
      "RelatedItems runtime bundling requires esbuild. Install dependencies before building."
    );
  }
  ensureDirSync(OUT_DIR);
  const scriptsDir = path.join(OUT_DIR, "scripts");
  ensureDirSync(scriptsDir);
  const outFile = path.join(scriptsDir, "canopy-related-items.js");
  const entry = `
    function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true}); else fn(); }
    function parseProps(el){ try{ const s=el.querySelector('script[type="application/json"]'); if(s) return JSON.parse(s.textContent||'{}'); }catch(_){ } return {}; }
    function buildSliderProps(iiifContent, options){
      const props = { iiifContent };
      if (options && typeof options === 'object') props.options = options;
      return props;
    }
    function rootBase(){
      try {
        var bp = (window && window.CANOPY_BASE_PATH) ? String(window.CANOPY_BASE_PATH) : '';
        if (bp && bp.charAt(bp.length - 1) === '/') return bp.slice(0, -1);
        return bp;
      } catch(_){ return ''; }
    }
    function pickRandomTop(values, topN){ const arr=(values||[]).slice().sort((a,b)=> (b.doc_count||0)-(a.doc_count||0) || String(a.value).localeCompare(String(b.value))); const n=Math.min(topN||3, arr.length); if(!n) return null; const i=Math.floor(Math.random()*n); return arr[i]; }
    function makeSliderPlaceholder(props){ try{ const el=document.createElement('div'); el.setAttribute('data-canopy-slider','1'); const s=document.createElement('script'); s.type='application/json'; s.textContent=JSON.stringify(props||{}); el.appendChild(s); return el; }catch(_){ return null; } }
    function slugify(s){ try{ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }catch(_){ return ''; } }
    function firstI18nString(x){ if(!x) return ''; if(typeof x==='string') return x; try{ const keys=Object.keys(x||{}); if(!keys.length) return ''; const arr=x[keys[0]]; if(Array.isArray(arr)&&arr.length) return String(arr[0]); }catch(_){ } return ''; }
    async function fetchManifestValues(iiif){ try{ const res = await fetch(iiif, { headers: { 'Accept': 'application/json' } }).catch(()=>null); if(!res||!res.ok) return null; const m = await res.json().catch(()=>null); if(!m) return null; const meta = Array.isArray(m.metadata)? m.metadata : []; const out = []; for (const entry of meta){ if(!entry) continue; const label = firstI18nString(entry.label); if(!label) continue; const vals = []; try { if (typeof entry.value === 'string') vals.push(entry.value); else { const obj = entry.value || {}; for (const k of Object.keys(obj)) { const arr = Array.isArray(obj[k]) ? obj[k] : []; for (const v of arr) if (v) vals.push(String(v)); } } } catch(_){} if (vals.length) out.push({ label, values: vals.map((v)=>({ value: v, valueSlug: slugify(v) })) }); }
      return out; } catch(_){ return null; } }
    async function getApiVersion(){
      try {
        const u = rootBase() + '/api/index.json';
        const res = await fetch(u).catch(()=>null);
        const j = res && res.ok ? await res.json().catch(()=>null) : null;
        return (j && typeof j.version === 'string') ? j.version : '';
      } catch(_) { return ''; }
    }
    ready(function(){
      const nodes = document.querySelectorAll('[data-canopy-related-items]');
      nodes.forEach(async (el) => {
        try {
          const props = parseProps(el) || {};
          const labelsFilter = Array.isArray(props.labels) ? props.labels.map(String) : null;
          const topN = Number(props.top || 3) || 3;
          const ver = await getApiVersion();
          const verQ = ver ? ('?v=' + encodeURIComponent(ver)) : '';
          const sliderOptions = (props && typeof props.sliderOptions === 'object') ? props.sliderOptions : null;
          const res = await fetch(rootBase() + '/api/search/facets.json' + verQ).catch(()=>null);
          if(!res || !res.ok) return;
          const json = await res.json().catch(()=>null);
          if(!Array.isArray(json)) return;
          // Build lookup for allowed labels and value slugs
          const allowedLabels = new Map(); // label -> { slug, values: Set(valueSlug) }
          json.forEach((f)=>{ if(!f||!f.label||!Array.isArray(f.values)) return; if(labelsFilter && !labelsFilter.includes(String(f.label))) return; const vs = new Set((f.values||[]).map((v)=> String((v && v.slug) || slugify(v && v.value)))); allowedLabels.set(String(f.label), { slug: f.slug || slugify(f.label), values: vs }); });

          const manifestIiif = props.iiifContent && String(props.iiifContent);
          if (manifestIiif) {
            const mv = await fetchManifestValues(manifestIiif);
            if (!mv || !mv.length) return;
            // For each label present on the manifest, choose ONE value at random (from values also present in the index)
            mv.forEach((entry) => {
              const allow = allowedLabels.get(String(entry.label));
              if (!allow) return; // skip labels not indexed
              const candidates = (entry.values || []).filter((vv) => allow.values.has(vv.valueSlug));
              if (!candidates.length) return;
              const pick = candidates[Math.floor(Math.random() * candidates.length)];
              const wrap = document.createElement('div');
              wrap.setAttribute('data-facet-label', entry.label);
              wrap.setAttribute('class', 'canopy-slider');
              const ph = makeSliderPlaceholder(buildSliderProps(rootBase() + '/api/facet/' + (allow.slug) + '/' + pick.valueSlug + '.json' + verQ, sliderOptions));
              if (ph) wrap.appendChild(ph);
              el.appendChild(wrap);
            });
            return;
          }

          // Homepage/default mode: pick a random top value per allowed label
          const selected = [];
          json.forEach((f) => { if(!f || !f.label || !Array.isArray(f.values)) return; if(labelsFilter && !labelsFilter.includes(String(f.label))) return; const pick = pickRandomTop(f.values, topN); if(pick) selected.push({ label: f.label, labelSlug: f.slug || slugify(f.label), value: pick.value, valueSlug: (pick.slug) || slugify(pick.value) }); });
          selected.forEach((s) => {
            const wrap = document.createElement('div');
            wrap.setAttribute('data-facet-label', s.label);
            wrap.setAttribute('class', 'canopy-slider');
            const ph = makeSliderPlaceholder(buildSliderProps(rootBase() + '/api/facet/' + s.labelSlug + '/' + s.valueSlug + '.json' + verQ, sliderOptions));
            if (ph) wrap.appendChild(ph);
            el.appendChild(wrap);
          });
        } catch(_) { }
      });
    });
  `;
  const shim = {name: "facets-vanilla", setup() {}};
  try {
    await esbuild.build({
      stdin: {
        contents: entry,
        resolveDir: process.cwd(),
        sourcefile: "canopy-facets-entry.js",
        loader: "js",
      },
      outfile: outFile,
      platform: "browser",
      format: "iife",
      bundle: true,
      sourcemap: false,
      target: ["es2020"],
      logLevel: "silent",
      minify: true,
      plugins: [shim],
    });
  } catch (e) {
    const message = e && e.message ? e.message : e;
    throw new Error(`RelatedItems runtime build failed: ${message}`);
  }
  try {
    const {logLine} = require("./log");
    let size = 0;
    try {
      const st = fs.statSync(outFile);
      size = (st && st.size) || 0;
    } catch (_) {}
    const kb = size ? ` (${(size / 1024).toFixed(1)} KB)` : "";
    const rel = path.relative(process.cwd(), outFile).split(path.sep).join("/");
    logLine(`✓ Wrote ${rel}${kb}`, "cyan");
  } catch (_) {}
}

async function ensureSliderRuntime() {
  return ensureClientRuntime();
}

// Build a small React globals vendor for client-side React pages.
async function ensureReactGlobals() {
  let esbuild = null;
  try {
    esbuild = require("../../ui/node_modules/esbuild");
  } catch (_) {
    try {
      esbuild = require("esbuild");
    } catch (_) {}
  }
  if (!esbuild)
    throw new Error(
      "React globals bundling requires esbuild. Install dependencies before building."
    );
  const {path} = require("../common");
  ensureDirSync(OUT_DIR);
  const scriptsDir = path.join(OUT_DIR, "scripts");
  ensureDirSync(scriptsDir);
  const vendorFile = path.join(scriptsDir, "react-globals.js");
  const globalsEntry = `
    import * as React from 'react';
    import * as ReactDOM from 'react-dom';
    import * as ReactDOMClient from 'react-dom/client';
    (function(){ try{ window.React = React; window.ReactDOM = ReactDOM; window.ReactDOMClient = ReactDOMClient; }catch(e){} })();
  `;
  await esbuild.build({
    stdin: {
      contents: globalsEntry,
      resolveDir: process.cwd(),
      loader: "js",
      sourcefile: "react-globals-entry.js",
    },
    outfile: vendorFile,
    platform: "browser",
    format: "iife",
    bundle: true,
    sourcemap: false,
    target: ["es2020"],
    logLevel: "silent",
    minify: true,
    define: {"process.env.NODE_ENV": '"production"'},
  });
}

async function ensureHeroRuntime() {
  let esbuild = null;
  try {
    esbuild = require("../ui/node_modules/esbuild");
  } catch (_) {
    try {
      esbuild = require("esbuild");
    } catch (_) {}
  }
  if (!esbuild)
    throw new Error(
      "Hero slider runtime bundling requires esbuild. Install dependencies before building."
    );
  ensureDirSync(OUT_DIR);
  const scriptsDir = path.join(OUT_DIR, "scripts");
  ensureDirSync(scriptsDir);
  const outFile = path.join(scriptsDir, "canopy-hero-slider.js");
  const entryFile = path.join(
    __dirname,
    "..",
    "components",
    "hero-slider-runtime.js"
  );
  await esbuild.build({
    entryPoints: [entryFile],
    outfile: outFile,
    platform: "browser",
    format: "iife",
    bundle: true,
    sourcemap: false,
    target: ["es2020"],
    logLevel: "silent",
    minify: true,
  });
  try {
    const {logLine} = require("./log");
    let size = 0;
    try {
      const st = fs.statSync(outFile);
      size = (st && st.size) || 0;
    } catch (_) {}
    const kb = size ? ` (${(size / 1024).toFixed(1)} KB)` : "";
    const rel = path.relative(process.cwd(), outFile).split(path.sep).join("/");
    logLine(`✓ Wrote ${rel}${kb}`, "cyan");
  } catch (_) {}
}

async function ensureTimelineRuntime() {
  let esbuild = null;
  try {
    esbuild = require("../ui/node_modules/esbuild");
  } catch (_) {
    try {
      esbuild = require("esbuild");
    } catch (_) {}
  }
  if (!esbuild)
    throw new Error(
      "Timeline runtime bundling requires esbuild. Install dependencies before building."
    );
  ensureDirSync(OUT_DIR);
  const scriptsDir = path.join(OUT_DIR, "scripts");
  ensureDirSync(scriptsDir);
  const outFile = path.join(scriptsDir, "canopy-timeline.js");
  const entryFile = path.join(
    __dirname,
    "..",
    "components",
    "timeline-runtime.js"
  );
  const reactShim = `
    const React = (typeof window !== 'undefined' && window.React) || {};
    export default React;
    export const Children = React.Children;
    export const Component = React.Component;
    export const Fragment = React.Fragment;
    export const createElement = React.createElement;
    export const cloneElement = React.cloneElement;
    export const createContext = React.createContext;
    export const forwardRef = React.forwardRef;
    export const memo = React.memo;
    export const startTransition = React.startTransition;
    export const isValidElement = React.isValidElement;
    export const useEffect = React.useEffect;
    export const useLayoutEffect = React.useLayoutEffect;
    export const useMemo = React.useMemo;
    export const useState = React.useState;
    export const useRef = React.useRef;
    export const useCallback = React.useCallback;
    export const useContext = React.useContext;
    export const useReducer = React.useReducer;
    export const useId = React.useId;
    export const useImperativeHandle = React.useImperativeHandle;
    export const useTransition = React.useTransition;
    export const useDeferredValue = React.useDeferredValue;
    export const useDebugValue = React.useDebugValue;
    export const useSyncExternalStore = React.useSyncExternalStore;
    export const useInsertionEffect = React.useInsertionEffect;
  `;
  const rdomShim = `
    const ReactDOM = (typeof window !== 'undefined' && window.ReactDOM) || {};
    export default ReactDOM;
    export const render = ReactDOM.render;
    export const hydrate = ReactDOM.hydrate;
    export const findDOMNode = ReactDOM.findDOMNode;
    export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
    export const createPortal = ReactDOM.createPortal;
    export const flushSync = ReactDOM.flushSync;
    export const unstable_batchedUpdates = ReactDOM.unstable_batchedUpdates;
    export const unstable_renderSubtreeIntoContainer = ReactDOM.unstable_renderSubtreeIntoContainer;
  `;
  const rdomClientShim = `
    const RDC = (typeof window !== 'undefined' && window.ReactDOMClient) || {};
    export const createRoot = RDC.createRoot;
    export const hydrateRoot = RDC.hydrateRoot;
  `;
  const plugin = {
    name: "canopy-react-shims-timeline",
    setup(build) {
      const ns = "canopy-timeline-shim";
      build.onResolve({filter: /^react$/}, () => ({path: "react", namespace: ns}));
      build.onResolve({filter: /^react-dom$/}, () => ({path: "react-dom", namespace: ns}));
      build.onResolve({filter: /^react-dom\/client$/}, () => ({
        path: "react-dom-client",
        namespace: ns,
      }));
      build.onLoad({filter: /^react$/, namespace: ns}, () => ({
        contents: reactShim,
        loader: "js",
      }));
      build.onLoad({filter: /^react-dom$/, namespace: ns}, () => ({
        contents: rdomShim,
        loader: "js",
      }));
      build.onLoad({filter: /^react-dom-client$/, namespace: ns}, () => ({
        contents: rdomClientShim,
        loader: "js",
      }));
    },
  };
  await esbuild.build({
    entryPoints: [entryFile],
    outfile: outFile,
    platform: "browser",
    format: "iife",
    bundle: true,
    sourcemap: false,
    target: ["es2020"],
    logLevel: "silent",
    minify: true,
    plugins: [plugin],
    loader: {
      ".png": "dataurl",
      ".svg": "dataurl",
      ".gif": "dataurl",
    },
  });
  try {
    const {logLine} = require("./log");
    let size = 0;
    try {
      const st = fs.statSync(outFile);
      size = (st && st.size) || 0;
    } catch (_) {}
    const kb = size ? ` (${(size / 1024).toFixed(1)} KB)` : "";
    const rel = path.relative(process.cwd(), outFile).split(path.sep).join("/");
    logLine(`✓ Wrote ${rel}${kb}`, "cyan");
  } catch (_) {}
}

async function ensureMapRuntime() {
  let esbuild = null;
  try {
    esbuild = require("../ui/node_modules/esbuild");
  } catch (_) {
    try {
      esbuild = require("esbuild");
    } catch (_) {}
  }
  if (!esbuild)
    throw new Error(
      "Map runtime bundling requires esbuild. Install dependencies before building."
    );
  ensureDirSync(OUT_DIR);
  const scriptsDir = path.join(OUT_DIR, "scripts");
  ensureDirSync(scriptsDir);
  const outFile = path.join(scriptsDir, "canopy-map.js");
  const entryFile = path.join(
    __dirname,
    "..",
    "components",
    "map-runtime.js"
  );
  const reactShim = `
    const React = (typeof window !== 'undefined' && window.React) || {};
    export default React;
    export const Children = React.Children;
    export const Component = React.Component;
    export const Fragment = React.Fragment;
    export const createElement = React.createElement;
    export const cloneElement = React.cloneElement;
    export const createContext = React.createContext;
    export const forwardRef = React.forwardRef;
    export const memo = React.memo;
    export const startTransition = React.startTransition;
    export const isValidElement = React.isValidElement;
    export const useEffect = React.useEffect;
    export const useLayoutEffect = React.useLayoutEffect;
    export const useMemo = React.useMemo;
    export const useState = React.useState;
    export const useRef = React.useRef;
    export const useCallback = React.useCallback;
    export const useContext = React.useContext;
    export const useReducer = React.useReducer;
    export const useId = React.useId;
    export const useImperativeHandle = React.useImperativeHandle;
    export const useTransition = React.useTransition;
    export const useDeferredValue = React.useDeferredValue;
    export const useDebugValue = React.useDebugValue;
    export const useSyncExternalStore = React.useSyncExternalStore;
    export const useInsertionEffect = React.useInsertionEffect;
  `;
  const rdomShim = `
    const ReactDOM = (typeof window !== 'undefined' && window.ReactDOM) || {};
    export default ReactDOM;
    export const render = ReactDOM.render;
    export const hydrate = ReactDOM.hydrate;
    export const findDOMNode = ReactDOM.findDOMNode;
    export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;
    export const createPortal = ReactDOM.createPortal;
    export const flushSync = ReactDOM.flushSync;
    export const unstable_batchedUpdates = ReactDOM.unstable_batchedUpdates;
    export const unstable_renderSubtreeIntoContainer = ReactDOM.unstable_renderSubtreeIntoContainer;
  `;
  const rdomClientShim = `
    const RDC = (typeof window !== 'undefined' && window.ReactDOMClient) || {};
    export const createRoot = RDC.createRoot;
    export const hydrateRoot = RDC.hydrateRoot;
  `;
  const plugin = {
    name: "canopy-react-shims-map",
    setup(build) {
      const ns = "canopy-map-shim";
      build.onResolve({filter: /^react$/}, () => ({path: "react", namespace: ns}));
      build.onResolve({filter: /^react-dom$/}, () => ({path: "react-dom", namespace: ns}));
      build.onResolve({filter: /^react-dom\/client$/}, () => ({
        path: "react-dom-client",
        namespace: ns,
      }));
      build.onLoad({filter: /^react$/, namespace: ns}, () => ({
        contents: reactShim,
        loader: "js",
      }));
      build.onLoad({filter: /^react-dom$/, namespace: ns}, () => ({
        contents: rdomShim,
        loader: "js",
      }));
      build.onLoad({filter: /^react-dom-client$/, namespace: ns}, () => ({
        contents: rdomClientShim,
        loader: "js",
      }));
    },
  };
  await esbuild.build({
    entryPoints: [entryFile],
    outfile: outFile,
    platform: "browser",
    format: "iife",
    bundle: true,
    sourcemap: false,
    target: ["es2020"],
    logLevel: "silent",
    minify: true,
    plugins: [plugin],
    loader: {
      ".png": "dataurl",
      ".svg": "dataurl",
      ".gif": "dataurl",
    },
  });
  try {
    const {logLine} = require("./log");
    let size = 0;
    try {
      const st = fs.statSync(outFile);
      size = (st && st.size) || 0;
    } catch (_) {}
    const kb = size ? ` (${(size / 1024).toFixed(1)} KB)` : "";
    const rel = path.relative(process.cwd(), outFile).split(path.sep).join("/");
    logLine(`✓ Wrote ${rel}${kb}`, "cyan");
  } catch (_) {}
}

module.exports = {
  extractTitle,
  extractHeadings,
  extractPlainText,
  extractMarkdownSummary,
  isReservedFile,
  parseFrontmatter,
  compileMdxFile,
  compileMdxToComponent,
  loadCustomLayout,
  loadAppWrapper,
  loadUiComponents,
  ensureClientRuntime,
  ensureSliderRuntime,
  ensureTimelineRuntime,
  ensureMapRuntime,
  ensureHeroRuntime,
  ensureFacetsRuntime,
  ensureReactGlobals,
  ensureCustomClientRuntime,
  resetMdxCaches: function () {
    try {
      DIR_LAYOUTS.clear();
    } catch (_) {}
    APP_WRAPPER = null;
    UI_COMPONENTS = null;
    UI_COMPONENTS_PATH = "";
    UI_COMPONENTS_MTIME = 0;
    MERGED_UI_COMPONENTS = null;
    MERGED_UI_KEY = "";
    CUSTOM_MDX_COMPONENTS = null;
    CUSTOM_MDX_SIGNATURE = "";
    CUSTOM_CLIENT_COMPONENT_ENTRIES = [];
    try {
      CUSTOM_CLIENT_COMPONENT_PLACEHOLDERS.clear();
    } catch (_) {
      CUSTOM_CLIENT_COMPONENT_PLACEHOLDERS = new Map();
    }
    try {
      SERVER_COMPONENT_CACHE.clear();
    } catch (_) {
      SERVER_COMPONENT_CACHE = new Map();
    }
    customClientRuntimePromise = null;
    customClientRuntimeSignature = "";
    cloverRuntimePromise = null;
  },
};
