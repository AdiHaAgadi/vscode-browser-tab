"use strict";
(() => {
  // src/utils/urlUtils.ts
  var LOCALHOST_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  function isLocalhostUrl(url) {
    try {
      return LOCALHOST_HOSTS.has(new URL(url).hostname);
    } catch {
      return false;
    }
  }
  function normalizeUrl(url) {
    url = url.trim();
    if (!url) {
      return "about:blank";
    }
    if (!/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) {
      url = "http://" + url;
    }
    return url;
  }

  // src/webview/api.ts
  var vscode = acquireVsCodeApi();

  // src/webview/elements.ts
  function el(id) {
    return document.getElementById(id);
  }
  var frame = el("browser-frame");
  var urlInput = el("url-input");
  var btnBack = el("btn-back");
  var btnForward = el("btn-forward");
  var btnRefresh = el("btn-refresh");
  var btnGo = el("btn-go");
  var btnExternal = el("btn-external");
  var btnAutoRel = el("btn-autoreload");
  var btnInspect = el("btn-inspect");
  var deviceSel = el("device-select");
  var deviceFrame = el("device-frame");
  var schemeIcon = el("url-scheme-icon");
  var statusText = el("status-text");
  var urlDisplay = el("current-url-display");
  var crossBadge = el("cross-origin-badge");
  var errorOverlay = el("error-overlay");
  var errorHost = el("error-host");
  var errorUrlEl = el("error-url-display");
  var errorRetry = el("error-btn-retry");
  var errorOpenExt = el("error-btn-open-ext");
  var blockedBanner = el("blocked-banner");
  var blockedHostEl = el("blocked-host");
  var blockedOpen = el("blocked-btn-open");
  var blockedDismiss = el("blocked-btn-dismiss");
  var loadingBar = Object.assign(document.createElement("div"), { id: "loading-bar" });
  deviceFrame.prepend(loadingBar);

  // src/webview/state.ts
  var state = {
    /** Browser history stack (real/display URLs, not proxy URLs). */
    history: [frame.src || "about:blank"],
    historyIdx: 0,
    autoReloadEnabled: true,
    inspectEnabled: false,
    loadTimeout: null,
    /** Origin of the DevTools proxy e.g. 'http://localhost:56108'. Empty when unproxied. */
    proxyOrigin: "",
    /** The real (user-visible) URL when the iframe is loading through the proxy. */
    currentRealUrl: ""
  };

  // src/webview/ui.ts
  function updateSchemeIcon(url) {
    schemeIcon.className = "";
    if (url.startsWith("https://")) {
      schemeIcon.classList.add("secure");
      schemeIcon.title = "Secure (HTTPS)";
    } else if (isLocalhostUrl(url)) {
      schemeIcon.classList.add("secure");
      schemeIcon.title = "Local connection";
    } else if (url.startsWith("http://")) {
      schemeIcon.classList.add("insecure");
      schemeIcon.title = "Not secure (HTTP)";
    } else {
      schemeIcon.title = "Connection info";
    }
  }
  function syncUI(url) {
    urlInput.value = url;
    urlDisplay.textContent = url;
    updateSchemeIcon(url);
    btnBack.disabled = state.historyIdx <= 0;
    btnForward.disabled = state.historyIdx >= state.history.length - 1;
    vscode.postMessage({ type: "navigate", url });
  }
  function startLoading() {
    frame.classList.add("loading");
    loadingBar.classList.remove("done");
    loadingBar.classList.add("active");
    btnRefresh.classList.add("spinning");
    statusText.textContent = "Loading\u2026";
    if (state.loadTimeout) {
      clearTimeout(state.loadTimeout);
    }
    state.loadTimeout = setTimeout(stopLoading, 1e4);
  }
  function stopLoading() {
    if (state.loadTimeout) {
      clearTimeout(state.loadTimeout);
      state.loadTimeout = null;
    }
    frame.classList.remove("loading");
    loadingBar.classList.remove("active");
    loadingBar.classList.add("done");
    btnRefresh.classList.remove("spinning");
    statusText.textContent = state.inspectEnabled ? "Inspect: click an element" : "Ready";
    setTimeout(() => loadingBar.classList.remove("done"), 600);
  }

  // src/webview/overlays.ts
  function showErrorPage(url) {
    hideBlockedBanner();
    errorOverlay.classList.add("visible");
    try {
      errorHost.textContent = new URL(url).host;
    } catch {
      errorHost.textContent = url;
    }
    errorUrlEl.textContent = url;
    frame.style.display = "none";
    stopLoading();
    statusText.textContent = "Connection refused";
  }
  function hideErrorPage() {
    errorOverlay.classList.remove("visible");
    frame.style.display = "";
  }
  function showBlockedBanner(url) {
    try {
      blockedHostEl.textContent = new URL(url).host;
    } catch {
      blockedHostEl.textContent = url;
    }
    blockedBanner.classList.add("visible");
  }
  function hideBlockedBanner() {
    blockedBanner.classList.remove("visible");
  }

  // src/webview/navigation.ts
  async function pingUrl(url) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3e3);
      await fetch(url, { method: "HEAD", mode: "no-cors", signal: ctrl.signal });
      clearTimeout(tid);
      return true;
    } catch {
      return false;
    }
  }
  function pushHistory(url) {
    if (state.history[state.historyIdx] === url) {
      return;
    }
    state.history = state.history.slice(0, state.historyIdx + 1);
    state.history.push(url);
    state.historyIdx = state.history.length - 1;
  }
  async function navigateTo(url) {
    hideBlockedBanner();
    crossBadge.classList.remove("visible");
    hideErrorPage();
    if (!url || url === "about:blank") {
      frame.src = "about:blank";
      return;
    }
    if (isLocalhostUrl(url)) {
      const reachable = await pingUrl(url);
      if (!reachable) {
        pushHistory(url);
        showErrorPage(url);
        syncUI(url);
        return;
      }
      pushHistory(url);
      syncUI(url);
      startLoading();
      vscode.postMessage({ type: "navigateTo", url });
    } else {
      pushHistory(url);
      startLoading();
      frame.src = url;
      syncUI(url);
    }
  }
  function goBack() {
    if (state.historyIdx <= 0) {
      return;
    }
    state.historyIdx--;
    const url = state.history[state.historyIdx];
    hideErrorPage();
    hideBlockedBanner();
    startLoading();
    frame.src = url;
    syncUI(url);
  }
  function goForward() {
    if (state.historyIdx >= state.history.length - 1) {
      return;
    }
    state.historyIdx++;
    const url = state.history[state.historyIdx];
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
      frame.src = "";
      requestAnimationFrame(() => {
        frame.src = cur;
      });
    }
    startLoading();
  }

  // src/webview/device.ts
  var DEVICES = {
    desktop: { w: null, h: null },
    laptop: { w: 1280, h: 800 },
    tablet: { w: 768, h: 1024 },
    mobilel: { w: 425, h: 812 },
    mobiles: { w: 375, h: 667 }
  };
  function applyDevice(key) {
    const preset = DEVICES[key];
    if (!preset) {
      return;
    }
    if (!preset.w) {
      deviceFrame.classList.remove("emulated");
      deviceFrame.style.width = deviceFrame.style.height = "";
      frame.style.width = frame.style.height = "";
    } else {
      deviceFrame.classList.add("emulated");
      deviceFrame.style.width = frame.style.width = `${preset.w}px`;
      deviceFrame.style.height = frame.style.height = `${preset.h}px`;
    }
  }

  // src/webview/browser.ts
  frame.addEventListener("load", () => {
    stopLoading();
    let detectedUrl = "";
    let isCrossOrigin = false;
    try {
      detectedUrl = frame.contentWindow?.location.href || "";
      crossBadge.classList.remove("visible");
    } catch {
      detectedUrl = state.history[state.historyIdx] || frame.src;
      isCrossOrigin = true;
      crossBadge.classList.add("visible");
    }
    if (detectedUrl && detectedUrl !== "about:blank") {
      if (state.proxyOrigin && detectedUrl.startsWith(state.proxyOrigin) && state.currentRealUrl) {
        try {
          const proxyU = new URL(detectedUrl);
          const realU = new URL(state.currentRealUrl);
          detectedUrl = realU.origin + proxyU.pathname + proxyU.search + proxyU.hash;
        } catch {
          detectedUrl = state.currentRealUrl;
        }
      }
      if (detectedUrl !== state.history[state.historyIdx]) {
        state.history[state.historyIdx] = detectedUrl;
      }
      syncUI(detectedUrl);
    }
    if (!isCrossOrigin && !isLocalhostUrl(detectedUrl)) {
      try {
        if (!frame.contentDocument?.body?.innerText?.trim()) {
          showBlockedBanner(detectedUrl);
        }
      } catch {
      }
    } else if (isCrossOrigin && !isLocalhostUrl(state.history[state.historyIdx] || "")) {
      setTimeout(() => {
        try {
          void frame.contentWindow?.location.href;
          crossBadge.classList.remove("visible");
        } catch {
          showBlockedBanner(state.history[state.historyIdx] || "");
        }
      }, 800);
    }
    let title = "Browser";
    try {
      title = frame.contentDocument?.title || "Browser";
    } catch {
    }
    vscode.postMessage({ type: "navigate", url: detectedUrl || state.history[state.historyIdx], title });
    if (state.inspectEnabled) {
      frame.contentWindow?.postMessage({ type: "__bt_enable_inspect" }, "*");
    }
  });
  var messageHandlers = {
    loadUrl: (msg) => {
      if (msg.url) {
        hideBlockedBanner();
        hideErrorPage();
        startLoading();
        if (msg.proxyOrigin) {
          state.proxyOrigin = msg.proxyOrigin;
        }
        if (msg.realUrl) {
          state.currentRealUrl = msg.realUrl;
          syncUI(msg.realUrl);
        }
        frame.src = msg.url;
      }
    },
    reload: () => {
      if (state.autoReloadEnabled) {
        refresh();
        statusText.textContent = "Auto-reloaded";
        setTimeout(() => {
          statusText.textContent = "Ready";
        }, 2e3);
      }
    },
    navigate: (msg) => {
      if (msg.url) {
        navigateTo(normalizeUrl(msg.url));
      }
    }
  };
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg?.type) {
      return;
    }
    if (typeof msg.type === "string" && msg.type.startsWith("__bt_")) {
      vscode.postMessage(msg);
      return;
    }
    const handler = messageHandlers[msg.type];
    if (handler) {
      handler(msg);
    }
  });
  btnBack.addEventListener("click", goBack);
  btnForward.addEventListener("click", goForward);
  btnRefresh.addEventListener("click", refresh);
  btnGo.addEventListener("click", () => navigateTo(normalizeUrl(urlInput.value)));
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      navigateTo(normalizeUrl(urlInput.value));
    }
    if (e.key === "Escape") {
      urlInput.blur();
      urlInput.value = state.history[state.historyIdx] || "";
    }
  });
  urlInput.addEventListener("focus", () => urlInput.select());
  btnExternal.addEventListener("click", () => {
    vscode.postMessage({ type: "openExternal", url: state.history[state.historyIdx] || urlInput.value });
  });
  btnAutoRel.addEventListener("click", () => {
    state.autoReloadEnabled = !state.autoReloadEnabled;
    btnAutoRel.classList.toggle("active", state.autoReloadEnabled);
    btnAutoRel.setAttribute("aria-pressed", String(state.autoReloadEnabled));
    const tip = btnAutoRel.querySelector(".tooltip");
    if (tip) {
      tip.textContent = `Auto-reload: ${state.autoReloadEnabled ? "ON" : "OFF"}`;
    }
  });
  btnInspect.addEventListener("click", () => {
    state.inspectEnabled = !state.inspectEnabled;
    btnInspect.classList.toggle("active", state.inspectEnabled);
    btnInspect.setAttribute("aria-pressed", String(state.inspectEnabled));
    document.body.classList.toggle("inspect-active", state.inspectEnabled);
    frame.contentWindow?.postMessage(
      { type: state.inspectEnabled ? "__bt_enable_inspect" : "__bt_disable_inspect" },
      "*"
    );
    statusText.textContent = state.inspectEnabled ? "Inspect: click an element" : "Ready";
  });
  errorRetry.addEventListener("click", () => {
    navigateTo(state.history[state.historyIdx]);
  });
  errorOpenExt.addEventListener("click", () => {
    vscode.postMessage({ type: "openExternal", url: state.history[state.historyIdx] || urlInput.value });
  });
  blockedOpen.addEventListener("click", () => {
    vscode.postMessage({ type: "openExternal", url: state.history[state.historyIdx] || urlInput.value });
    hideBlockedBanner();
  });
  blockedDismiss.addEventListener("click", hideBlockedBanner);
  deviceSel.addEventListener("change", () => applyDevice(deviceSel.value));
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key === "ArrowLeft") {
      goBack();
      e.preventDefault();
    }
    if (e.altKey && e.key === "ArrowRight") {
      goForward();
      e.preventDefault();
    }
    if (e.key === "F5") {
      refresh();
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "l") {
      urlInput.focus();
      urlInput.select();
      e.preventDefault();
    }
  });
  syncUI(state.history[0]);
  startLoading();
})();
//# sourceMappingURL=browser.js.map
