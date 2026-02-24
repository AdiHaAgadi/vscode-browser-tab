// @ts-check
/// <reference lib="dom" />
'use strict';

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // ── Elements ────────────────────────────────────────
  const frame         = /** @type {HTMLIFrameElement} */ (document.getElementById('browser-frame'));
  const urlInput      = /** @type {HTMLInputElement}  */ (document.getElementById('url-input'));
  const btnBack       = /** @type {HTMLButtonElement} */ (document.getElementById('btn-back'));
  const btnForward    = /** @type {HTMLButtonElement} */ (document.getElementById('btn-forward'));
  const btnRefresh    = /** @type {HTMLButtonElement} */ (document.getElementById('btn-refresh'));
  const btnGo         = /** @type {HTMLButtonElement} */ (document.getElementById('btn-go'));
  const btnExternal   = /** @type {HTMLButtonElement} */ (document.getElementById('btn-external'));
  const btnAutoRel    = /** @type {HTMLButtonElement} */ (document.getElementById('btn-autoreload'));
  const deviceSel     = /** @type {HTMLSelectElement} */ (document.getElementById('device-select'));
  const deviceFrame   = /** @type {HTMLDivElement}    */ (document.getElementById('device-frame'));
  const schemeIcon    = /** @type {HTMLSpanElement}   */ (document.getElementById('url-scheme-icon'));
  const statusText    = /** @type {HTMLSpanElement}   */ (document.getElementById('status-text'));
  const urlDisplay    = /** @type {HTMLSpanElement}   */ (document.getElementById('current-url-display'));

  // Error overlay
  const errorOverlay  = /** @type {HTMLDivElement}    */ (document.getElementById('error-overlay'));
  const errorHost     = /** @type {HTMLElement}        */ (document.getElementById('error-host'));
  const errorUrlEl    = /** @type {HTMLDivElement}     */ (document.getElementById('error-url-display'));
  const errorRetry    = /** @type {HTMLButtonElement} */ (document.getElementById('error-btn-retry'));
  const errorOpenExt  = /** @type {HTMLButtonElement} */ (document.getElementById('error-btn-open-ext'));

  // Blocked embed banner
  const blockedBanner = /** @type {HTMLDivElement}    */ (document.getElementById('blocked-banner'));
  const blockedHostEl = /** @type {HTMLElement}        */ (document.getElementById('blocked-host'));
  const blockedOpen   = /** @type {HTMLButtonElement} */ (document.getElementById('blocked-btn-open'));
  const blockedDismiss= /** @type {HTMLButtonElement} */ (document.getElementById('blocked-btn-dismiss'));

  // Cross-origin badge
  const crossBadge    = /** @type {HTMLDivElement}    */ (document.getElementById('cross-origin-badge'));

  // Loading bar (injected)
  const loadingBar = document.createElement('div');
  loadingBar.id = 'loading-bar';
  deviceFrame.prepend(loadingBar);

  // ── State ────────────────────────────────────────────
  /** @type {string[]} */
  let history = [frame.src || 'about:blank'];
  let historyIdx = 0;
  let autoReloadEnabled = true;
  let loadTimeout = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

  // ── Helpers ──────────────────────────────────────────

  /** @param {string} url */
  function normalizeUrl(url) {
    url = url.trim();
    if (!url) { return 'about:blank'; }
    if (!/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) {
      url = 'http://' + url;
    }
    return url;
  }

  /** Returns true if the URL is a localhost/loopback address */
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
      schemeIcon.classList.add('secure');
      schemeIcon.title = 'Secure (HTTPS)';
    } else if (isLocalhost(url)) {
      schemeIcon.classList.add('secure');
      schemeIcon.title = 'Local connection';
    } else if (url.startsWith('http://')) {
      schemeIcon.classList.add('insecure');
      schemeIcon.title = 'Not secure (HTTP)';
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
    // Safety timeout — if load doesn't fire in 10s, stop spinner
    if (loadTimeout) { clearTimeout(loadTimeout); }
    loadTimeout = setTimeout(stopLoading, 10000);
  }

  function stopLoading() {
    if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
    frame.classList.remove('loading');
    loadingBar.classList.remove('active');
    loadingBar.classList.add('done');
    btnRefresh.classList.remove('spinning');
    statusText.textContent = 'Ready';
    setTimeout(() => loadingBar.classList.remove('done'), 600);
  }

  // ── Error page ───────────────────────────────────────

  /** @param {string} url */
  function showErrorPage(url) {
    hideBlockedBanner();
    errorOverlay.classList.add('visible');
    try {
      errorHost.textContent = new URL(url).host;
    } catch {
      errorHost.textContent = url;
    }
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
    try {
      blockedHostEl.textContent = new URL(url).host;
    } catch {
      blockedHostEl.textContent = url;
    }
    blockedBanner.classList.add('visible');
  }

  function hideBlockedBanner() {
    blockedBanner.classList.remove('visible');
  }

  // ── Ping before navigating ────────────────────────────
  // For localhost URLs: attempt a HEAD request to check the port is open
  // before loading the iframe (gives a nice error page instead of blank).
  /** @param {string} url @returns {Promise<boolean>} */
  async function pingUrl(url) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
      clearTimeout(tid);
      return true;
    } catch {
      return false;
    }
  }

  // ── Navigation ────────────────────────────────────────

  /** @param {string} url */
  async function navigateTo(url) {
    hideBlockedBanner();
    crossBadge.classList.remove('visible');
    hideErrorPage();

    if (!url || url === 'about:blank') {
      frame.src = 'about:blank';
      return;
    }

    // ── Only ping localhost URLs — external sites might CORS-block the ping
    if (isLocalhost(url)) {
      const reachable = await pingUrl(url);
      if (!reachable) {
        showErrorPage(url);
        // Still update history so Back works
        if (history[historyIdx] !== url) {
          history = history.slice(0, historyIdx + 1);
          history.push(url);
          historyIdx = history.length - 1;
        }
        syncUI(url);
        return;
      }
    }

    if (history[historyIdx] !== url) {
      history = history.slice(0, historyIdx + 1);
      history.push(url);
      historyIdx = history.length - 1;
    }
    startLoading();
    frame.src = url;
    syncUI(url);
  }

  function goBack() {
    if (historyIdx <= 0) { return; }
    historyIdx--;
    const url = history[historyIdx];
    hideErrorPage();
    hideBlockedBanner();
    startLoading();
    frame.src = url;
    syncUI(url);
  }

  function goForward() {
    if (historyIdx >= history.length - 1) { return; }
    historyIdx++;
    const url = history[historyIdx];
    hideErrorPage();
    hideBlockedBanner();
    startLoading();
    frame.src = url;
    syncUI(url);
  }

  function refresh() {
    hideErrorPage();
    hideBlockedBanner();
    try {
      frame.contentWindow?.location.reload();
    } catch {
      const cur = frame.src;
      frame.src = '';
      requestAnimationFrame(() => { frame.src = cur; });
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
      // If we can read the URL, we're same-origin — clear the badge
      crossBadge.classList.remove('visible');
    } catch {
      // Cross-origin: we can't read the URL. Keep last known.
      detectedUrl = history[historyIdx] || frame.src;
      isCrossOrigin = true;
      crossBadge.classList.add('visible');
    }

    if (detectedUrl && detectedUrl !== 'about:blank') {
      if (detectedUrl !== history[historyIdx]) {
        history[historyIdx] = detectedUrl;
      }
      syncUI(detectedUrl);
    }

    // Detect blank page after navigation — possible X-Frame-Options block
    // Only trigger for non-localhost external URLs
    if (!isCrossOrigin && !isLocalhost(detectedUrl)) {
      try {
        const bodyText = frame.contentDocument?.body?.innerText?.trim() ?? 'x';
        if (!bodyText) {
          showBlockedBanner(detectedUrl);
        }
      } catch { /* cross-origin — expected */ }
    } else if (isCrossOrigin && !isLocalhost(history[historyIdx] || '')) {
      // We navigated to an external URL and can't read it — possibly blocked
      // Show the banner after a short delay to let the page paint
      setTimeout(() => {
        try {
          // If we can now read it, it loaded fine
          void frame.contentWindow?.location.href;
          crossBadge.classList.remove('visible');
        } catch {
          showBlockedBanner(history[historyIdx] || '');
        }
      }, 800);
    }

    // Update panel title
    let title = 'Browser';
    try { title = frame.contentDocument?.title || 'Browser'; } catch {}
    vscode.postMessage({
      type: 'navigate',
      url: detectedUrl || history[historyIdx],
      title,
    });
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

  // Error overlay buttons
  errorRetry.addEventListener('click', () => {
    const url = history[historyIdx];
    hideErrorPage();
    navigateTo(url);
  });
  errorOpenExt.addEventListener('click', () => {
    vscode.postMessage({ type: 'openExternal', url: history[historyIdx] || urlInput.value });
  });

  // Blocked banner buttons
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

  // ── Messages from extension host ─────────────────────

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg?.type) { return; }
    switch (msg.type) {
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      urlInput.focus(); urlInput.select(); e.preventDefault();
    }
  });

  // ── Init ─────────────────────────────────────────────

  syncUI(history[0]);
  startLoading();
})();
