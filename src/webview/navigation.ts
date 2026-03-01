import { isLocalhostUrl } from '../utils/urlUtils';
import { vscode }          from './api';
import * as el             from './elements';
import { state }           from './state';
import { syncUI, startLoading } from './ui';
import { showErrorPage, hideErrorPage, hideBlockedBanner } from './overlays';

// ── Reachability ping ────────────────────────────────────────────────────────

async function pingUrl(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 3000);
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(tid);
    return true;
  } catch { return false; }
}

// ── History management ───────────────────────────────────────────────────────

export function pushHistory(url: string) {
  if (state.history[state.historyIdx] === url) { return; }
  state.history = state.history.slice(0, state.historyIdx + 1);
  state.history.push(url);
  state.historyIdx = state.history.length - 1;
}

// ── Navigation ───────────────────────────────────────────────────────────────

/**
 * Navigate to a URL:
 * - localhost → ping for reachability, then ask the extension host to resolve
 *   the proxy URL (host replies with a `loadUrl` message).
 * - All other URLs → set `frame.src` directly.
 */
export async function navigateTo(url: string) {
  hideBlockedBanner();
  el.crossBadge.classList.remove('visible');
  hideErrorPage();

  if (!url || url === 'about:blank') { el.frame.src = 'about:blank'; return; }

  if (isLocalhostUrl(url)) {
    const reachable = await pingUrl(url);
    if (!reachable) { pushHistory(url); showErrorPage(url); syncUI(url); return; }
    pushHistory(url);
    syncUI(url);
    startLoading();
    vscode.postMessage({ type: 'navigateTo', url });
  } else {
    pushHistory(url);
    startLoading();
    el.frame.src = url;
    syncUI(url);
  }
}

export function goBack() {
  if (state.historyIdx <= 0) { return; }
  state.historyIdx--;
  const url = state.history[state.historyIdx];
  hideErrorPage(); hideBlockedBanner(); startLoading(); el.frame.src = url; syncUI(url);
}

export function goForward() {
  if (state.historyIdx >= state.history.length - 1) { return; }
  state.historyIdx++;
  const url = state.history[state.historyIdx];
  hideErrorPage(); hideBlockedBanner(); startLoading(); el.frame.src = url; syncUI(url);
}

export function refresh() {
  hideErrorPage(); hideBlockedBanner();
  try { el.frame.contentWindow?.location.reload(); } catch {
    const cur = el.frame.src;
    el.frame.src = '';
    requestAnimationFrame(() => { el.frame.src = cur; });
  }
  startLoading();
}
