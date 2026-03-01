import * as vscode from 'vscode';
import { DevProxy } from './devProxy';
import { getPanelHtml } from './utils/panelHtml';
import { isLocalhostUrl, HMR_EXTENSIONS } from './utils/urlUtils';
import { handleConsole }                              from './utils/handlers/consoleHandler';
import { handleNetworkRequest, handleNetworkResponse } from './utils/handlers/networkHandler';
import { handleInspectElement }                        from './utils/handlers/inspectHandler';

export class BrowserPanel {
  public static currentPanel: BrowserPanel | undefined;
  private static readonly _viewType = 'vscodeBrowserTab';

  // Shared channels and proxy — set once during activation via init()
  private static _consoleChannel: vscode.LogOutputChannel | undefined;
  private static _networkChannel: vscode.OutputChannel | undefined;
  private static _proxy: DevProxy | undefined;

  public static init(
    consoleChannel: vscode.LogOutputChannel,
    networkChannel: vscode.OutputChannel,
    proxy: DevProxy | undefined,
  ) {
    BrowserPanel._consoleChannel = consoleChannel;
    BrowserPanel._networkChannel = networkChannel;
    BrowserPanel._proxy = proxy;
  }

  // ── Instance fields ─────────────────────────────────────────────────────────

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _currentUrl: string;
  private _disposables: vscode.Disposable[] = [];

  // ── Static factory ──────────────────────────────────────────────────────────

  public static createOrShow(context: vscode.ExtensionContext, url?: string) {
    const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;

    if (BrowserPanel.currentPanel) {
      BrowserPanel.currentPanel._panel.reveal(column);
      if (url) { BrowserPanel.currentPanel._navigateTo(url); }
      return;
    }

    const config = vscode.workspace.getConfiguration('vscode-browser-tab');
    const defaultUrl = url ?? config.get<string>('defaultUrl', 'http://localhost:3000');

    // Always map common dev ports plus the current proxy port
    const commonPorts = [3000, 4000, 4200, 5000, 5173, 8000, 8080, 9000];
    const portMapping = commonPorts.map(p => ({ webviewPort: p, extensionHostPort: p }));
    if (BrowserPanel._proxy) {
      const pp = BrowserPanel._proxy.port;
      portMapping.push({ webviewPort: pp, extensionHostPort: pp });
    }

    const panel = vscode.window.createWebviewPanel(
      BrowserPanel._viewType,
      'Browser',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
        portMapping,
      },
    );
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    BrowserPanel.currentPanel = new BrowserPanel(panel, context, defaultUrl);
  }

  // ── Constructor ─────────────────────────────────────────────────────────────

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, defaultUrl: string) {
    this._panel   = panel;
    this._context = context;
    this._currentUrl = defaultUrl;

    this._render();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(msg => this._onMessage(msg), null, this._disposables);

    vscode.workspace.onDidSaveTextDocument(doc => {
      const cfg = vscode.workspace.getConfiguration('vscode-browser-tab');
      if (!cfg.get<boolean>('autoReload', true)) { return; }
      const ext = doc.fileName.slice(doc.fileName.lastIndexOf('.')).toLowerCase();
      if (cfg.get<boolean>('hmrAware', true) && HMR_EXTENSIONS.has(ext)) { return; }
      this._panel.webview.postMessage({ type: 'reload' });
    }, null, this._disposables);

    this._navigateTo(defaultUrl);
  }
  // ── Message routing ─────────────────────────────────────────────────────────

  private async _onMessage(msg: Record<string, any>) {
    type Handler = (msg: Record<string, any>) => void | Promise<void>;

    const handlers: Record<string, Handler> = {
      navigate:       (m) => { if (m.url) { this._currentUrl = m.url; } },
      urlBarUpdate:   (m) => { if (m.url) { this._currentUrl = m.url; } },
      openExternal:   (m) => { if (m.url) { vscode.env.openExternal(vscode.Uri.parse(m.url)); } },

      // User navigated in the webview — resolve proxy URL and send it back
      navigateTo:     (m) => { if (m.url) { this._navigateTo(m.url); } },

      // ── DevTools events (relayed from injected script via browser.js) ────────
      __bt_console:          (m) => { if (BrowserPanel._consoleChannel) { handleConsole(m, BrowserPanel._consoleChannel); } },
      __bt_network_request:  (m) => { if (BrowserPanel._networkChannel) { handleNetworkRequest(m, BrowserPanel._networkChannel); } },
      __bt_network_response: (m) => { if (BrowserPanel._networkChannel) { handleNetworkResponse(m, BrowserPanel._networkChannel); } },
      __bt_inspect_element:  (m) => handleInspectElement(m),
    };

    await handlers[msg.type]?.(msg);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  /** Routes localhost URLs through the proxy; passes all others directly to the iframe. */
  private _navigateTo(url: string) {
    this._currentUrl = url;
    let loadUrl = url;

    if (BrowserPanel._proxy && isLocalhostUrl(url)) {
      BrowserPanel._proxy.setTarget(url);
      try {
        const u = new URL(url);
        loadUrl = `http://localhost:${BrowserPanel._proxy.port}${u.pathname}${u.search}${u.hash}`;
      } catch { /* keep original url */ }
    }

    this._panel.webview.postMessage({
      type: 'loadUrl',
      url: loadUrl,
      realUrl: url,
      proxyOrigin: BrowserPanel._proxy ? `http://localhost:${BrowserPanel._proxy.port}` : '',
    });
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private _render() {
    const proxy = BrowserPanel._proxy;
    let initialSrc = this._currentUrl;

    if (proxy && isLocalhostUrl(this._currentUrl)) {
      proxy.setTarget(this._currentUrl);
      try {
        const u = new URL(this._currentUrl);
        initialSrc = `http://localhost:${proxy.port}${u.pathname}${u.search}${u.hash}`;
      } catch {}
    }

    this._panel.webview.html = getPanelHtml(
      this._panel.webview,
      this._context.extensionUri,
      initialSrc,
      this._currentUrl,
    );
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  public dispose() {
    BrowserPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) { this._disposables.pop()?.dispose(); }
  }
}
