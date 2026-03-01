import * as vscode from 'vscode';

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) { nonce += chars.charAt(Math.floor(Math.random() * chars.length)); }
  return nonce;
}

/**
 * Builds the full HTML document for the Browser Tab webview panel.
 * @param webview  The VS Code Webview instance (used for URI generation and CSP).
 * @param extensionUri  The extension's root URI (for resolving media assets).
 * @param initialSrc  The URL to load in the iframe on first render (may be a proxy URL).
 * @param displayUrl  The real URL to pre-fill the address bar with.
 */
export function getPanelHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  initialSrc: string,
  displayUrl: string,
): string {
  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'browser.css'));
  const jsUri  = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'browser.js'));
  const nonce  = getNonce();

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';
             frame-src *;
             img-src * data:;
             connect-src *;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Browser Tab</title>
  <link rel="stylesheet" href="${cssUri}" />
</head>
<body>
  <div id="toolbar">
    <div id="nav-controls">
      <button id="btn-back" title="Go Back (Alt+←)" aria-label="Go Back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <button id="btn-forward" title="Go Forward (Alt+→)" aria-label="Go Forward">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <button id="btn-refresh" title="Refresh (F5)" aria-label="Refresh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
      </button>
    </div>
    <div id="url-bar-wrapper">
      <span id="url-scheme-icon" title="Connection Info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      </span>
      <input id="url-input" type="text" value="${displayUrl}" spellcheck="false" autocomplete="off" placeholder="Enter URL or localhost:PORT…" />
      <button id="btn-go" title="Navigate" aria-label="Navigate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </button>
    </div>
    <div id="right-controls">
      <div id="device-selector-wrapper">
        <svg id="device-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
        <select id="device-select" title="Device Emulation" aria-label="Device emulation preset">
          <option value="desktop">Desktop</option>
          <option value="laptop">Laptop (1280×800)</option>
          <option value="tablet">Tablet (768×1024)</option>
          <option value="mobilel">Mobile L (425×812)</option>
          <option value="mobiles">Mobile S (375×667)</option>
        </select>
      </div>
      <button id="btn-inspect" aria-label="Toggle element inspector" aria-pressed="false" title="Click-to-Inspect (localhost only)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
      </button>
      <button id="btn-autoreload" class="active" aria-label="Toggle auto-reload" aria-pressed="true" title="Auto-reload on save (HMR-aware)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
        <span class="tooltip">Auto-reload: ON</span>
      </button>
      <button id="btn-external" title="Open in External Browser" aria-label="Open in external browser">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </button>
    </div>
  </div>
  <div id="browser-viewport">
    <div id="device-frame">
      <div id="error-overlay">
        <div class="error-dots"><span></span><span></span><span></span></div>
        <div class="error-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
        <div class="error-title">This site can't be reached</div>
        <div class="error-subtitle">The server at <strong id="error-host"></strong> refused the connection.<br>Make sure your dev server is running.</div>
        <div class="error-url" id="error-url-display"></div>
        <div class="error-actions">
          <button class="error-btn primary" id="error-btn-retry"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>Retry</button>
          <button class="error-btn secondary" id="error-btn-open-ext">Open in Browser</button>
        </div>
      </div>
      <div id="blocked-banner">
        <div class="blocked-icon">🔒</div>
        <div class="blocked-title">This page can't be embedded</div>
        <div class="blocked-body"><strong id="blocked-host"></strong> blocks embedding in iframes (X-Frame-Options / CSP).<br>This is common for OAuth and external sites.</div>
        <div class="blocked-actions">
          <button class="error-btn primary" id="blocked-btn-open">Open in External Browser</button>
          <button class="error-btn secondary" id="blocked-btn-dismiss">Dismiss</button>
        </div>
      </div>
      <div id="cross-origin-badge">🔗 Cross-origin — URL tracking limited</div>
      <iframe id="browser-frame" src="${initialSrc}" allow="fullscreen; camera; microphone"></iframe>
    </div>
  </div>
  <div id="status-bar">
    <span id="status-text">Ready</span>
    <span id="current-url-display">${displayUrl}</span>
  </div>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
}
