import * as vscode from 'vscode';

// File extensions normally handled by HMR tools (Vite, webpack, etc.)
// We skip full-page auto-reload for these — let HMR handle live updates.
const HMR_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx',
  '.vue', '.svelte',
  '.css', '.scss', '.sass', '.less', '.styl',
]);

export class BrowserPanel {
  public static currentPanel: BrowserPanel | undefined;
  private static readonly viewType = 'vscodeBrowserTab';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _currentUrl: string;

  // ── Static factory ─────────────────────────────────────────────────────────

  public static createOrShow(context: vscode.ExtensionContext, url?: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (BrowserPanel.currentPanel) {
      BrowserPanel.currentPanel._panel.reveal(column);
      if (url) {
        BrowserPanel.currentPanel._navigateTo(url);
      }
      return;
    }

    const config = vscode.workspace.getConfiguration('vscode-browser-tab');
    const defaultUrl = url ?? config.get<string>('defaultUrl', 'http://localhost:3000');

    const panel = vscode.window.createWebviewPanel(
      BrowserPanel.viewType,
      'Browser',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
        portMapping: [
          { webviewPort: 3000, extensionHostPort: 3000 },
          { webviewPort: 4000, extensionHostPort: 4000 },
          { webviewPort: 4200, extensionHostPort: 4200 },
          { webviewPort: 5000, extensionHostPort: 5000 },
          { webviewPort: 5173, extensionHostPort: 5173 },
          { webviewPort: 8000, extensionHostPort: 8000 },
          { webviewPort: 8080, extensionHostPort: 8080 },
          { webviewPort: 9000, extensionHostPort: 9000 },
        ],
      }
    );

    // Set the tab icon (separate from the package.json icon which is for the marketplace)
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');

    BrowserPanel.currentPanel = new BrowserPanel(panel, context, defaultUrl);
  }

  // ── Constructor ────────────────────────────────────────────────────────────

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    defaultUrl: string
  ) {
    this._panel = panel;
    this._context = context;
    this._currentUrl = defaultUrl;

    this._render();

    // Clean up on dispose
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (msg: { type: string; url?: string; title?: string }) => {
        switch (msg.type) {
          case 'navigate':
            if (msg.url) {
              this._currentUrl = msg.url;
              this._panel.title = 'Browser';
            }
            break;

          case 'openExternal':
            if (msg.url) {
              vscode.env.openExternal(vscode.Uri.parse(msg.url));
            }
            break;

          case 'urlBarUpdate':
            if (msg.url) { this._currentUrl = msg.url; }
            break;
        }
      },
      null,
      this._disposables
    );

    // ── HMR-aware auto-reload on file save ────────────────────────────────
    vscode.workspace.onDidSaveTextDocument(
      (doc) => {
        const cfg = vscode.workspace.getConfiguration('vscode-browser-tab');
        if (!cfg.get<boolean>('autoReload', true)) { return; }

        const ext = this._fileExt(doc.fileName);
        if (cfg.get<boolean>('hmrAware', true) && HMR_EXTENSIONS.has(ext)) {
          return; // Let HMR handle JS/TS/CSS/Vue/Svelte changes live
        }

        this._panel.webview.postMessage({ type: 'reload' });
      },
      null,
      this._disposables
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _fileExt(filePath: string): string {
    const idx = filePath.lastIndexOf('.');
    return idx >= 0 ? filePath.slice(idx).toLowerCase() : '';
  }

  public _navigateTo(url: string) {
    this._currentUrl = url;
    this._panel.webview.postMessage({ type: 'navigate', url });
  }

  private _render() {
    this._panel.webview.html = this._getHtmlContent(this._panel.webview);
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'media', 'browser.css')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'media', 'browser.js')
    );
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button id="btn-forward" title="Go Forward (Alt+→)" aria-label="Go Forward">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
      <button id="btn-refresh" title="Refresh (F5)" aria-label="Refresh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
    </div>

    <div id="url-bar-wrapper">
      <span id="url-scheme-icon" title="Connection Info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </span>
      <input id="url-input" type="text" value="${this._currentUrl}" spellcheck="false" autocomplete="off" placeholder="Enter URL or localhost:PORT…" />
      <button id="btn-go" title="Navigate" aria-label="Navigate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
    </div>

    <div id="right-controls">
      <div id="device-selector-wrapper">
        <svg id="device-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        <select id="device-select" title="Device Emulation" aria-label="Device emulation preset">
          <option value="desktop">Desktop</option>
          <option value="laptop">Laptop (1280×800)</option>
          <option value="tablet">Tablet (768×1024)</option>
          <option value="mobilel">Mobile L (425×812)</option>
          <option value="mobiles">Mobile S (375×667)</option>
        </select>
      </div>

      <button id="btn-autoreload" class="active" aria-label="Toggle auto-reload" aria-pressed="true" title="Auto-reload on save (HMR-aware)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"></path>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
          <path d="M3 22v-6h6"></path>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
        </svg>
        <span class="tooltip">Auto-reload: ON</span>
      </button>

      <button id="btn-external" title="Open in External Browser" aria-label="Open in external browser">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </button>
    </div>
  </div>

  <div id="browser-viewport">
    <div id="device-frame">
      <!-- Error page: shown when localhost port is unreachable -->
      <div id="error-overlay">
        <div class="error-dots"><span></span><span></span><span></span></div>
        <div class="error-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div class="error-title">This site can't be reached</div>
        <div class="error-subtitle">The server at <strong id="error-host"></strong> refused the connection.<br>Make sure your dev server is running.</div>
        <div class="error-url" id="error-url-display"></div>
        <div class="error-actions">
          <button class="error-btn primary" id="error-btn-retry">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            Retry
          </button>
          <button class="error-btn secondary" id="error-btn-open-ext">
            Open in Browser
          </button>
        </div>
      </div>

      <!-- Blocked embed banner: shown when an external site blocks iframe loading -->
      <div id="blocked-banner">
        <div class="blocked-icon">🔒</div>
        <div class="blocked-title">This page can't be embedded</div>
        <div class="blocked-body">
          <strong id="blocked-host"></strong> blocks embedding in iframes (X-Frame-Options / CSP).<br>
          This is common for OAuth and external sites.
        </div>
        <div class="blocked-actions">
          <button class="error-btn primary" id="blocked-btn-open">Open in External Browser</button>
          <button class="error-btn secondary" id="blocked-btn-dismiss">Dismiss</button>
        </div>
      </div>

      <!-- Cross-origin badge: shown when we can't track the current URL -->
      <div id="cross-origin-badge">🔗 Cross-origin — URL tracking limited</div>

      <iframe
        id="browser-frame"
        src="${this._currentUrl}"
        allow="fullscreen; camera; microphone"
      ></iframe>
    </div>
  </div>

  <div id="status-bar">
    <span id="status-text">Ready</span>
    <span id="current-url-display">${this._currentUrl}</span>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  // ── Dispose ────────────────────────────────────────────────────────────────

  public dispose() {
    BrowserPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) { x.dispose(); }
    }
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/** Mirrors the normalizeUrl logic in browser.js — prepends http:// when the
 *  user omits the protocol (e.g. "localhost:4200" → "http://localhost:4200"). */
export function normalizeUrl(url: string): string {
  url = url.trim();
  if (!url) { return 'about:blank'; }
  if (!/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) {
    url = 'http://' + url;
  }
  return url;
}
