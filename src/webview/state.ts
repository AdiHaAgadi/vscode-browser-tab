import { frame } from './elements';

/**
 * All mutable runtime state for the webview browser.
 * Using a single object makes it easy to import and mutate across modules
 * without the ESM "you can't assign to an imported binding" restriction.
 */
export const state = {
  /** Browser history stack (real/display URLs, not proxy URLs). */
  history:          [frame.src || 'about:blank'] as string[],
  historyIdx:       0,
  autoReloadEnabled: true,
  inspectEnabled:   false,
  loadTimeout:      null as ReturnType<typeof setTimeout> | null,

  /** Origin of the DevTools proxy e.g. 'http://localhost:56108'. Empty when unproxied. */
  proxyOrigin:      '',
  /** The real (user-visible) URL when the iframe is loading through the proxy. */
  currentRealUrl:   '',
};
