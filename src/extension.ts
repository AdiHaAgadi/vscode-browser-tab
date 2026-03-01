import * as vscode from "vscode";
import { BrowserPanel } from "./browserPanel";
import { DevProxy } from "./devProxy";
import { normalizeUrl } from "./utils/urlUtils";


export async function activate(context: vscode.ExtensionContext) {

  // ── DevTools Output Channels ───────────────────────────────────────────────
  const consoleChannel = vscode.window.createOutputChannel('Browser Tab — Console', { log: true });
  const networkChannel = vscode.window.createOutputChannel('Browser Tab — Network');
  context.subscriptions.push(consoleChannel, networkChannel);

  // ── Local DevTools proxy (injects script into localhost HTML responses) ─────
  let proxy: DevProxy | undefined;
  try {
    proxy = await DevProxy.create();
    context.subscriptions.push({ dispose: () => proxy?.dispose() });
  } catch (e) {
    // Proxy failed to start — DevTools features will be unavailable
    console.warn('[Browser Tab] DevTools proxy failed to start:', e);
  }

  BrowserPanel.init(consoleChannel, networkChannel, proxy);

  // ── Command: Open Browser Tab ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-browser-tab.open", () => {
      BrowserPanel.createOrShow(context);
    }),
  );

  // ── Command: Navigate to URL ───────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-browser-tab.navigate", async () => {
      const input = await vscode.window.showInputBox({
        title: "Navigate to URL",
        prompt: "Enter a URL to open in the Browser Tab",
        placeHolder: "localhost:3000  or  https://example.com",
      });
      if (!input) { return; }
      BrowserPanel.createOrShow(context, normalizeUrl(input));
    }),
  );

  // ── Terminal link provider ─────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerTerminalLinkProvider({
      provideTerminalLinks(ctx, _token) {
        const cfg = vscode.workspace.getConfiguration('vscode-browser-tab');
        if (!cfg.get<boolean>('terminalLinks', true)) { return []; }
        const URL_REGEX = /https?:\/\/[^\s"'`\]>),;]+/g;
        const links: vscode.TerminalLink[] = [];
        let m: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
        while ((m = URL_REGEX.exec(ctx.line)) !== null) {
          links.push(
            Object.assign(
              new (vscode.TerminalLink as any)(m.index, m[0].length, "Open in Browser Tab"),
              { _url: m[0] },
            ),
          );
        }
        return links;
      },
      handleTerminalLink(link: vscode.TerminalLink & { _url?: string }) {
        if (link._url) { BrowserPanel.createOrShow(context, normalizeUrl(link._url)); }
      },
    }),
  );
  return { context };
}

export function deactivate() {}
