import { isLocalhostUrl } from '../utils/urlUtils';
import { vscode }         from './api';
import * as el            from './elements';
import { state }          from './state';

// ── Scheme icon ──────────────────────────────────────────────────────────────

export function updateSchemeIcon(url: string) {
  el.schemeIcon.className = '';
  if (url.startsWith('https://')) {
    el.schemeIcon.classList.add('secure');   el.schemeIcon.title = 'Secure (HTTPS)';
  } else if (isLocalhostUrl(url)) {
    el.schemeIcon.classList.add('secure');   el.schemeIcon.title = 'Local connection';
  } else if (url.startsWith('http://')) {
    el.schemeIcon.classList.add('insecure'); el.schemeIcon.title = 'Not secure (HTTP)';
  } else {
    el.schemeIcon.title = 'Connection info';
  }
}

// ── Address bar + nav button state ───────────────────────────────────────────

export function syncUI(url: string) {
  el.urlInput.value          = url;
  el.urlDisplay.textContent  = url;
  updateSchemeIcon(url);
  el.btnBack.disabled    = state.historyIdx <= 0;
  el.btnForward.disabled = state.historyIdx >= state.history.length - 1;
  vscode.postMessage({ type: 'navigate', url });
}

// ── Loading bar ───────────────────────────────────────────────────────────────

export function startLoading() {
  el.frame.classList.add('loading');
  el.loadingBar.classList.remove('done');
  el.loadingBar.classList.add('active');
  el.btnRefresh.classList.add('spinning');
  el.statusText.textContent = 'Loading…';
  if (state.loadTimeout) { clearTimeout(state.loadTimeout); }
  state.loadTimeout = setTimeout(stopLoading, 10_000);
}

export function stopLoading() {
  if (state.loadTimeout) { clearTimeout(state.loadTimeout); state.loadTimeout = null; }
  el.frame.classList.remove('loading');
  el.loadingBar.classList.remove('active');
  el.loadingBar.classList.add('done');
  el.btnRefresh.classList.remove('spinning');
  el.statusText.textContent = state.inspectEnabled ? 'Inspect: click an element' : 'Ready';
  setTimeout(() => el.loadingBar.classList.remove('done'), 600);
}
