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
  let detectedUrl  = '';
  let isCrossOrigin = false;

  try {
    detectedUrl = el.frame.contentWindow?.location.href || '';
    if (detectedUrl === 'about:blank') return; // Ignore intentional proxy-swap pulses
    el.crossBadge.classList.remove('visible');
  } catch {
    // Cross-origin access blocked (e.g. proxy serves a 502 error page).
    // Use the realUrl we last set as the canonical source — it's always current.
    detectedUrl  = state.currentRealUrl || state.history[state.historyIdx] || el.frame.src;
    isCrossOrigin = true;
    el.crossBadge.classList.add('visible');
  }

  stopLoading(); // Only stop after confirming it's not an about:blank pulse

  if (detectedUrl && detectedUrl !== 'about:blank') {
    // Strip internal nonce used to force iframe reload before translating
    if (detectedUrl.includes('_bt_r=')) {
      try {
        const u = new URL(detectedUrl);
        u.searchParams.delete('_bt_r');
        detectedUrl = u.toString();
      } catch { /* keep as-is */ }
    }
    // Translate proxy URL → real URL for the address bar
    if (state.proxyOrigin && detectedUrl.startsWith(state.proxyOrigin) && state.currentRealUrl) {
      try {
        const proxyU = new URL(detectedUrl);
        const realU  = new URL(state.currentRealUrl);
        detectedUrl  = realU.origin + proxyU.pathname + proxyU.search + proxyU.hash;
        // Keep currentRealUrl in sync so subsequent navigations don't use a stale port
        state.currentRealUrl = detectedUrl;
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
      // The _bt_r nonce in msg.url guarantees it differs from any previous src,
      // so a plain assignment always triggers a real browser navigation.
      el.frame.src = msg.url;
    }
  },
  showError: (msg) => {
    if (msg.url) {
      const url = msg.url as string;
      if (state.history[state.historyIdx] !== url) {
        state.history = state.history.slice(0, state.historyIdx + 1);
        state.history.push(url);
        state.historyIdx = state.history.length - 1;
      }
      syncUI(url);
      showErrorPage(url);
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
