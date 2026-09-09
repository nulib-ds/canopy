const { createDiscoveryTools } = require('./tools');
const { createBrowserLoader } = require('./browser-loader');

const registrationKey = Symbol.for('canopy.iiif.webmcp');

function executeWithCancellation(tool, input, options, registrationSignal) {
  const signals = [options?.signal, registrationSignal].filter(Boolean);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signals.forEach((signal) => signal.removeEventListener('abort', cancel));
      callback(value);
    };
    const cancel = () => {
      const error = new Error('IIIF tool execution was cancelled.');
      error.name = 'AbortError';
      finish(reject, error);
    };
    if (signals.some((signal) => signal.aborted)) return cancel();
    signals.forEach((signal) => signal.addEventListener('abort', cancel, { once: true }));
    Promise.resolve()
      .then(() => !settled && tool.execute(input, options))
      .then(
        (result) => finish(resolve, result),
        (error) => finish(reject, error),
      );
  });
}

function initializeWebMcp({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  script = doc?.currentScript,
  fetch: fetchJson = win?.fetch?.bind(win),
} = {}) {
  let modelContext;
  try {
    modelContext = doc?.modelContext;
  } catch {
    return null;
  }
  if (!modelContext?.registerTool || !win?.addEventListener || !fetchJson) return null;
  if (doc[registrationKey]) return doc[registrationKey];
  const catalogPath = script?.getAttribute('data-canopy-discovery');
  if (!catalogPath) return null;

  let controller;
  let disposed = false;
  const stop = () => {
    controller?.abort();
    controller = null;
  };
  const state = {
    ready: null,
    dispose() {
      disposed = true;
      stop();
      win.removeEventListener('pagehide', stop);
      win.removeEventListener('pageshow', restore);
      if (doc[registrationKey] === state) delete doc[registrationKey];
    },
  };

  async function start() {
    if (disposed || controller) return false;
    const registration = new (win.AbortController || AbortController)();
    controller = registration;
    try {
      const loaders = createBrowserLoader({
        catalogUrl: new URL(catalogPath, doc.baseURI).href,
        origin: new URL(win.location.href).origin,
        fetch: fetchJson,
        signal: registration.signal,
      });
      const tools = createDiscoveryTools(loaders);
      await Promise.all(
        tools.map((tool) =>
          Promise.resolve().then(() =>
            modelContext.registerTool(
              {
                ...tool,
                execute: (input, options) =>
                  executeWithCancellation(tool, input, options, registration.signal),
              },
              { signal: registration.signal },
            ),
          ),
        ),
      );
      return !registration.signal.aborted;
    } catch (error) {
      const cancelled = registration.signal.aborted;
      registration.abort();
      if (controller === registration) controller = null;
      if (!cancelled) win.console?.warn('[Canopy] IIIF tools could not be registered.', error);
      return false;
    }
  }

  function restore(event) {
    if (event.persisted) state.ready = start();
  }

  doc[registrationKey] = state;
  win.addEventListener('pagehide', stop);
  win.addEventListener('pageshow', restore);
  state.ready = start();
  return state;
}

module.exports = { initializeWebMcp };

if (typeof document !== 'undefined') initializeWebMcp();
