// @ts-check
/// <reference lib="dom" />
'use strict';

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // ── Elements ────────────────────────────────────────
  const frame        = /** @type {HTMLIFrameElement} */ (document.getElementById('browser-frame'));
  const urlInput     = /** @type {HTMLInputElement}  */ (document.getElementById('url-input'));
  const btnBack      = /** @type {HTMLButtonElement} */ (document.getElementById('btn-back'));
  const btnForward   = /** @type {HTMLButtonElement} */ (document.getElementById('btn-forward'));
  const btnRefresh   = /** @type {HTMLButtonElement} */ (document.getElementById('btn-refresh'));
  const btnGo        = /** @type {HTMLButtonElement} */ (document.getElementById('btn-go'));
  const btnExternal  = /** @type {HTMLButtonElement} */ (document.getElementById('btn-external'));
  const btnAutoRel   = /** @type {HTMLButtonElement} */ (document.getElementById('btn-autoreload'));
  const btnInspect   = /** @type {HTMLButtonElement} */ (document.getElementById('btn-inspect'));
  const deviceSel    = /** @type {HTMLSelectElement} */ (document.getElementById('device-select'));
  const deviceFrame  = /** @type {HTMLDivElement}    */ (document.getElementById('device-frame'));
  const schemeIcon   = /** @type {HTMLSpanElement}   */ (document.getElementById('url-scheme-icon'));
  const statusText   = /** @type {HTMLSpanElement}   */ (document.getElementById('status-text'));
  const urlDisplay   = /** @type {HTMLSpanElement}   */ (document.getElementById('current-url-display'));

  const errorOverlay  = /** @type {HTMLDivElement}    */ (document.getElementById('error-overlay'));
  const errorHost     = /** @type {HTMLElement}       */ (document.getElementById('error-host'));
  const errorUrlEl    = /** @type {HTMLDivElement}    */ (document.getElementById('error-url-display'));
  const errorRetry    = /** @type {HTMLButtonElement} */ (document.getElementById('error-btn-retry'));
  const errorOpenExt  = /** @type {HTMLButtonElement} */ (document.getElementById('error-btn-open-ext'));
  const blockedBanner = /** @type {HTMLDivElement}    */ (document.getElementById('blocked-banner'));
  const blockedHostEl = /** @type {HTMLElement}       */ (document.getElementById('blocked-host'));
  const blockedOpen   = /** @type {HTMLButtonElement} */ (document.getElementById('blocked-btn-open'));
  const blockedDismiss= /** @type {HTMLButtonElement} */ (document.getElementById('blocked-btn-dismiss'));
  const crossBadge    = /** @type {HTMLDivElement}    */ (document.getElementById('cross-origin-badge'));

  const loadingBar = document.createElement('div');
  loadingBar.id = 'loading-bar';
  deviceFrame.prepend(loadingBar);

  // ── State ────────────────────────────────────────────
  /** @type {string[]} */
  let history = [frame.src || 'about:blank'];
  let historyIdx = 0;
  let autoReloadEnabled = true;
  let inspectEnabled = false;
  let loadTimeout = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
  /** Origin of the DevTools proxy, e.g. 'http://localhost:56108'. Empty when not proxied. */
  let proxyOrigin = '';
  /** The real (user-visible) URL when the iframe is loading through the proxy. */
  let currentRealUrl = '';

  // ── Helpers ──────────────────────────────────────────

  /** @param {string} url */
  function normalizeUrl(url) {
    url = url.trim();
    if (!url) { return 'about:blank'; }
    if (!/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) { url = 'http://' + url; }
    return url;
  }

  /** @param {string} url */
  function isLocalhost(url) {
    try {
      const h = new URL(url).hostname;
      return h === 'localhost' || h === '127.0.0.1' || h === '::1';
    } catch { return false; }
  }

  /** @param {string} url */
  function updateSchemeIcon(url) {
    schemeIcon.className = '';
    if (url.startsWith('https://')) {
      schemeIcon.classList.add('secure'); schemeIcon.title = 'Secure (HTTPS)';
    } else if (isLocalhost(url)) {
      schemeIcon.classList.add('secure'); schemeIcon.title = 'Local connection';
    } else if (url.startsWith('http://')) {
      schemeIcon.classList.add('insecure'); schemeIcon.title = 'Not secure (HTTP)';
    } else {
      schemeIcon.title = 'Connection info';
    }
  }

  /** @param {string} url */
  function syncUI(url) {
    urlInput.value = url;
    urlDisplay.textContent = url;
    updateSchemeIcon(url);
    btnBack.disabled    = historyIdx <= 0;
    btnForward.disabled = historyIdx >= history.length - 1;
    vscode.postMessage({ type: 'navigate', url });
  }

  function startLoading() {
    frame.classList.add('loading');
    loadingBar.classList.remove('done');
    loadingBar.classList.add('active');
    btnRefresh.classList.add('spinning');
    statusText.textContent = 'Loading…';
    if (loadTimeout) { clearTimeout(loadTimeout); }
    loadTimeout = setTimeout(stopLoading, 10000);
  }

  function stopLoading() {
    if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
    frame.classList.remove('loading');
    loadingBar.classList.remove('active');
    loadingBar.classList.add('done');
    btnRefresh.classList.remove('spinning');
    statusText.textContent = inspectEnabled ? 'Inspect: click an element' : 'Ready';
    setTimeout(() => loadingBar.classList.remove('done'), 600);
  }

  // ── Error / blocked helpers ───────────────────────────

  /** @param {string} url */
  function showErrorPage(url) {
    hideBlockedBanner();
    errorOverlay.classList.add('visible');
    try { errorHost.textContent = new URL(url).host; } catch { errorHost.textContent = url; }
    errorUrlEl.textContent = url;
    frame.style.display = 'none';
    stopLoading();
    statusText.textContent = 'Connection refused';
  }

  function hideErrorPage() {
    errorOverlay.classList.remove('visible');
    frame.style.display = '';
  }

  /** @param {string} url */
  function showBlockedBanner(url) {
    try { blockedHostEl.textContent = new URL(url).host; } catch { blockedHostEl.textContent = url; }
    blockedBanner.classList.add('visible');
  }

  function hideBlockedBanner() { blockedBanner.classList.remove('visible'); }

  // ── Ping before navigating ────────────────────────────

  /** @param {string} url @returns {Promise<boolean>} */
  async function pingUrl(url) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
      clearTimeout(tid);
      return true;
    } catch { return false; }
  }

  // ── Navigation ────────────────────────────────────────

  /**
   * Navigate to a URL. For localhost URLs, the extension host is asked to
   * resolve the proxy URL (via 'navigateTo' message); the host replies with
   * a 'loadUrl' message containing the real URL to set on the iframe.
   * @param {string} url
   */
  async function navigateTo(url) {
    hideBlockedBanner();
    crossBadge.classList.remove('visible');
    hideErrorPage();
    if (!url || url === 'about:blank') { frame.src = 'about:blank'; return; }

    if (isLocalhost(url)) {
      const reachable = await pingUrl(url);
      if (!reachable) {
        showErrorPage(url);
        if (history[historyIdx] !== url) {
          history = history.slice(0, historyIdx + 1); history.push(url); historyIdx = history.length - 1;
        }
        syncUI(url); return;
      }
      // Ask extension host to route through proxy
      vscode.postMessage({ type: 'navigateTo', url });
    } else {
      if (history[historyIdx] !== url) {
        history = history.slice(0, historyIdx + 1); history.push(url); historyIdx = history.length - 1;
      }
      startLoading(); frame.src = url; syncUI(url);
    }
    // Update history + UI for localhost (actual src set on 'loadUrl' reply)
    if (isLocalhost(url)) {
      if (history[historyIdx] !== url) {
        history = history.slice(0, historyIdx + 1); history.push(url); historyIdx = history.length - 1;
      }
      syncUI(url); startLoading();
    }
  }

  function goBack() {
    if (historyIdx <= 0) { return; }
    historyIdx--;
    const url = history[historyIdx];
    hideErrorPage(); hideBlockedBanner(); startLoading(); frame.src = url; syncUI(url);
  }

  function goForward() {
    if (historyIdx >= history.length - 1) { return; }
    historyIdx++;
    const url = history[historyIdx];
    hideErrorPage(); hideBlockedBanner(); startLoading(); frame.src = url; syncUI(url);
  }

  function refresh() {
    hideErrorPage(); hideBlockedBanner();
    try { frame.contentWindow?.location.reload(); } catch {
      const cur = frame.src; frame.src = ''; requestAnimationFrame(() => { frame.src = cur; });
    }
    startLoading();
  }

  // ── Iframe load events ────────────────────────────────

  frame.addEventListener('load', () => {
    stopLoading();
    let detectedUrl = '';
    let isCrossOrigin = false;
    try {
      detectedUrl = frame.contentWindow?.location.href || '';
      crossBadge.classList.remove('visible');
    } catch {
      detectedUrl = history[historyIdx] || frame.src;
      isCrossOrigin = true;
      crossBadge.classList.add('visible');
    }

    if (detectedUrl && detectedUrl !== 'about:blank') {
      // If loaded URL is the proxy, show the real (user-visible) URL instead
      if (proxyOrigin && detectedUrl.startsWith(proxyOrigin) && currentRealUrl) {
        try {
          const proxyU = new URL(detectedUrl);
          const realU  = new URL(currentRealUrl);
          // Preserve path/search/hash changes made by client-side routing
          detectedUrl = realU.origin + proxyU.pathname + proxyU.search + proxyU.hash;
        } catch { detectedUrl = currentRealUrl; }
      }
      if (detectedUrl !== history[historyIdx]) { history[historyIdx] = detectedUrl; }
      syncUI(detectedUrl);
    }

    if (!isCrossOrigin && !isLocalhost(detectedUrl)) {
      try {
        const bodyText = frame.contentDocument?.body?.innerText?.trim() ?? 'x';
        if (!bodyText) { showBlockedBanner(detectedUrl); }
      } catch { /* cross-origin */ }
    } else if (isCrossOrigin && !isLocalhost(history[historyIdx] || '')) {
      setTimeout(() => {
        try { void frame.contentWindow?.location.href; crossBadge.classList.remove('visible'); }
        catch { showBlockedBanner(history[historyIdx] || ''); }
      }, 800);
    }

    let title = 'Browser';
    try { title = frame.contentDocument?.title || 'Browser'; } catch {}
    vscode.postMessage({ type: 'navigate', url: detectedUrl || history[historyIdx], title });

    // Re-send inspect mode — the proxy-injected script in the page listens for this
    if (inspectEnabled) {
      frame.contentWindow?.postMessage({ type: '__bt_enable_inspect' }, '*');
    }
  });

  // ── Button wiring ─────────────────────────────────────

  btnBack.addEventListener('click', goBack);
  btnForward.addEventListener('click', goForward);
  btnRefresh.addEventListener('click', refresh);
  btnGo.addEventListener('click', () => navigateTo(normalizeUrl(urlInput.value)));

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { navigateTo(normalizeUrl(urlInput.value)); }
    if (e.key === 'Escape') { urlInput.blur(); urlInput.value = history[historyIdx] || ''; }
  });
  urlInput.addEventListener('focus', () => urlInput.select());

  btnExternal.addEventListener('click', () => {
    vscode.postMessage({ type: 'openExternal', url: history[historyIdx] || urlInput.value });
  });

  btnAutoRel.addEventListener('click', () => {
    autoReloadEnabled = !autoReloadEnabled;
    btnAutoRel.classList.toggle('active', autoReloadEnabled);
    btnAutoRel.setAttribute('aria-pressed', String(autoReloadEnabled));
    const tip = btnAutoRel.querySelector('.tooltip');
    if (tip) { tip.textContent = `Auto-reload: ${autoReloadEnabled ? 'ON' : 'OFF'}`; }
  });

  btnInspect.addEventListener('click', () => {
    inspectEnabled = !inspectEnabled;
    btnInspect.classList.toggle('active', inspectEnabled);
    btnInspect.setAttribute('aria-pressed', String(inspectEnabled));
    document.body.classList.toggle('inspect-active', inspectEnabled);
    // The DevTools script injected server-side by the proxy handles enable/disable
    frame.contentWindow?.postMessage(
      { type: inspectEnabled ? '__bt_enable_inspect' : '__bt_disable_inspect' }, '*'
    );
    statusText.textContent = inspectEnabled ? 'Inspect: click an element' : 'Ready';
  });

  errorRetry.addEventListener('click', () => { hideErrorPage(); navigateTo(history[historyIdx]); });
  errorOpenExt.addEventListener('click', () => {
    vscode.postMessage({ type: 'openExternal', url: history[historyIdx] || urlInput.value });
  });
  blockedOpen.addEventListener('click', () => {
    vscode.postMessage({ type: 'openExternal', url: history[historyIdx] || urlInput.value });
    hideBlockedBanner();
  });
  blockedDismiss.addEventListener('click', hideBlockedBanner);

  // ── Device emulation ──────────────────────────────────

  const DEVICES = {
    desktop: { w: null, h: null },
    laptop:  { w: 1280, h: 800  },
    tablet:  { w: 768,  h: 1024 },
    mobilel: { w: 425,  h: 812  },
    mobiles: { w: 375,  h: 667  },
  };

  /** @param {string} key */
  function applyDevice(key) {
    const preset = DEVICES[/** @type {keyof typeof DEVICES} */ (key)];
    if (!preset) { return; }
    if (!preset.w) {
      deviceFrame.classList.remove('emulated');
      deviceFrame.style.width = deviceFrame.style.height = '';
      frame.style.width = frame.style.height = '';
    } else {
      deviceFrame.classList.add('emulated');
      deviceFrame.style.width  = preset.w + 'px';
      deviceFrame.style.height = preset.h + 'px';
      frame.style.width  = preset.w + 'px';
      frame.style.height = preset.h + 'px';
    }
  }

  deviceSel.addEventListener('change', () => applyDevice(deviceSel.value));

  // ── Messages from extension host / iframe ─────────────

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg?.type) { return; }

    // Relay DevTools messages from the iframe (proxy-injected script) to extension host
    if (typeof msg.type === 'string' && msg.type.startsWith('__bt_')) {
      vscode.postMessage(msg);
      return;
    }

    switch (msg.type) {
      case 'loadUrl':
        // Extension host resolved the proxy URL for a localhost navigate
        if (msg.url) {
          hideErrorPage(); hideBlockedBanner(); startLoading();
          // Store proxy context so the iframe load handler can show the real URL
          if (msg.proxyOrigin) { proxyOrigin = msg.proxyOrigin; }
          if (msg.realUrl)     { currentRealUrl = msg.realUrl; syncUI(msg.realUrl); }
          frame.src = msg.url;
        }
        break;
      case 'reload':
        if (autoReloadEnabled) {
          refresh();
          statusText.textContent = 'Auto-reloaded';
          setTimeout(() => { statusText.textContent = 'Ready'; }, 2000);
        }
        break;
      case 'navigate':
        if (msg.url) { navigateTo(normalizeUrl(msg.url)); }
        break;
    }
  });

  // ── Keyboard shortcuts ────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft')  { goBack();    e.preventDefault(); }
    if (e.altKey && e.key === 'ArrowRight') { goForward(); e.preventDefault(); }
    if (e.key === 'F5')                     { refresh();   e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') { urlInput.focus(); urlInput.select(); e.preventDefault(); }
  });

  // ── Init ─────────────────────────────────────────────
  syncUI(history[0]);
  startLoading();
})();
