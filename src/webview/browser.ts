/// <reference lib="dom" />
import { normalizeUrl }   from '../utils/urlUtils';
import { isLocalhostUrl } from '../utils/urlUtils';
import { vscode }         from './api';
import * as el            from './elements';
import { state }          from './state';
import { syncUI, startLoading, stopLoading } from './ui';
import { showBlockedBanner, hideBlockedBanner, showErrorPage, hideErrorPage } from './overlays';
import { navigateTo, goBack, goForward, refresh } from './navigation';
import { applyDevice }    from './device';

// ── Iframe load ──────────────────────────────────────────────────────────────

el.frame.addEventListener('load', () => {
  stopLoading();
  let detectedUrl  = '';
  let isCrossOrigin = false;

  try {
    detectedUrl = el.frame.contentWindow?.location.href || '';
    el.crossBadge.classList.remove('visible');
  } catch {
    detectedUrl  = state.history[state.historyIdx] || el.frame.src;
    isCrossOrigin = true;
    el.crossBadge.classList.add('visible');
  }

  if (detectedUrl && detectedUrl !== 'about:blank') {
    // Translate proxy URL → real URL for the address bar
    if (state.proxyOrigin && detectedUrl.startsWith(state.proxyOrigin) && state.currentRealUrl) {
      try {
        const proxyU = new URL(detectedUrl);
        const realU  = new URL(state.currentRealUrl);
        detectedUrl  = realU.origin + proxyU.pathname + proxyU.search + proxyU.hash;
      } catch { detectedUrl = state.currentRealUrl; }
    }
    if (detectedUrl !== state.history[state.historyIdx]) { state.history[state.historyIdx] = detectedUrl; }
    syncUI(detectedUrl);
  }

  // Detect blocked (X-Frame-Options / CSP) pages
  if (!isCrossOrigin && !isLocalhostUrl(detectedUrl)) {
    try {
      if (!(el.frame.contentDocument?.body?.innerText?.trim())) { showBlockedBanner(detectedUrl); }
    } catch {}
  } else if (isCrossOrigin && !isLocalhostUrl(state.history[state.historyIdx] || '')) {
    setTimeout(() => {
      try { void el.frame.contentWindow?.location.href; el.crossBadge.classList.remove('visible'); }
      catch { showBlockedBanner(state.history[state.historyIdx] || ''); }
    }, 800);
  }

  let title = 'Browser';
  try { title = el.frame.contentDocument?.title || 'Browser'; } catch {}
  vscode.postMessage({ type: 'navigate', url: detectedUrl || state.history[state.historyIdx], title });

  // Re-enable inspect mode after navigation (the injected script restarts on each page load)
  if (state.inspectEnabled) {
    el.frame.contentWindow?.postMessage({ type: '__bt_enable_inspect' }, '*');
  }
});

// ── Messages from extension host / iframe ────────────────────────────────────

const messageHandlers: Record<string, (msg: Record<string, any>) => void> = {
  loadUrl: (msg) => {
    if (msg.url) {
      hideBlockedBanner();
      hideErrorPage();
      startLoading();
      if (msg.proxyOrigin) { state.proxyOrigin    = msg.proxyOrigin; }
      if (msg.realUrl)     { state.currentRealUrl = msg.realUrl; syncUI(msg.realUrl); }
      el.frame.src = msg.url;
    }
  },
  reload: () => {
    if (state.autoReloadEnabled) {
      refresh();
      el.statusText.textContent = 'Auto-reloaded';
      setTimeout(() => { el.statusText.textContent = 'Ready'; }, 2000);
    }
  },
  navigate: (msg) => {
    if (msg.url) { navigateTo(normalizeUrl(msg.url)); }
  }
};

window.addEventListener('message', (event) => {
  const msg = event.data as Record<string, any>;
  if (!msg?.type) { return; }

  // Relay __bt_* messages from the proxy-injected page script up to the extension host
  if (typeof msg.type === 'string' && msg.type.startsWith('__bt_')) {
    vscode.postMessage(msg);
    return;
  }

  const handler = messageHandlers[msg.type];
  
  if (handler) {
    handler(msg);
  }
});

// ── Button wiring ────────────────────────────────────────────────────────────

el.btnBack.addEventListener('click', goBack);
el.btnForward.addEventListener('click', goForward);
el.btnRefresh.addEventListener('click', refresh);
el.btnGo.addEventListener('click', () => navigateTo(normalizeUrl(el.urlInput.value)));

el.urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  { navigateTo(normalizeUrl(el.urlInput.value)); }
  if (e.key === 'Escape') { el.urlInput.blur(); el.urlInput.value = state.history[state.historyIdx] || ''; }
});
el.urlInput.addEventListener('focus', () => el.urlInput.select());

el.btnExternal.addEventListener('click', () => {
  vscode.postMessage({ type: 'openExternal', url: state.history[state.historyIdx] || el.urlInput.value });
});

el.btnAutoRel.addEventListener('click', () => {
  state.autoReloadEnabled = !state.autoReloadEnabled;
  el.btnAutoRel.classList.toggle('active', state.autoReloadEnabled);
  el.btnAutoRel.setAttribute('aria-pressed', String(state.autoReloadEnabled));
  const tip = el.btnAutoRel.querySelector('.tooltip');
  if (tip) { tip.textContent = `Auto-reload: ${state.autoReloadEnabled ? 'ON' : 'OFF'}`; }
});

el.btnInspect.addEventListener('click', () => {
  state.inspectEnabled = !state.inspectEnabled;
  el.btnInspect.classList.toggle('active', state.inspectEnabled);
  el.btnInspect.setAttribute('aria-pressed', String(state.inspectEnabled));
  document.body.classList.toggle('inspect-active', state.inspectEnabled);
  el.frame.contentWindow?.postMessage(
    { type: state.inspectEnabled ? '__bt_enable_inspect' : '__bt_disable_inspect' }, '*',
  );
  el.statusText.textContent = state.inspectEnabled ? 'Inspect: click an element' : 'Ready';
});

el.errorRetry.addEventListener('click', () => { navigateTo(state.history[state.historyIdx]); });
el.errorOpenExt.addEventListener('click', () => {
  vscode.postMessage({ type: 'openExternal', url: state.history[state.historyIdx] || el.urlInput.value });
});
el.blockedOpen.addEventListener('click', () => {
  vscode.postMessage({ type: 'openExternal', url: state.history[state.historyIdx] || el.urlInput.value });
  hideBlockedBanner();
});
el.blockedDismiss.addEventListener('click', hideBlockedBanner);

el.deviceSel.addEventListener('change', () => applyDevice(el.deviceSel.value));

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'ArrowLeft')              { goBack();    e.preventDefault(); }
  if (e.altKey && e.key === 'ArrowRight')             { goForward(); e.preventDefault(); }
  if (e.key === 'F5')                                 { refresh();   e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') { el.urlInput.focus(); el.urlInput.select(); e.preventDefault(); }
});

// ── Init ──────────────────────────────────────────────────────────────────────
syncUI(state.history[0]);
startLoading();
