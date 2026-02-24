import * as vscode from "vscode";
import { BrowserPanel } from "./browserPanel";
import { normalizeUrl } from "./browserPanel";

export function activate(context: vscode.ExtensionContext) {
  // ── Command: Open Browser Tab ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-browser-tab.open", () => {
      BrowserPanel.createOrShow(context);
    }),
  );

  // ── Command: Navigate to URL ───────────────────────────────────────────────
  // Shows an input box — prepends http:// automatically if not present.
  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-browser-tab.navigate", async () => {
      const input = await vscode.window.showInputBox({
        title: "Navigate to URL",
        prompt: "Enter a URL to open in the Browser Tab",
        placeHolder: "localhost:3000  or  https://example.com",
      });
      if (!input) {
        return;
      }
      BrowserPanel.createOrShow(context, normalizeUrl(input));
    }),
  );

  // ── Terminal link provider ─────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerTerminalLinkProvider({
      provideTerminalLinks(ctx, _token) {
        const URL_REGEX = /https?:\/\/[^\s"'`\]>),;]+/g;
        const links: vscode.TerminalLink[] = [];
        let m: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
        while ((m = URL_REGEX.exec(ctx.line)) !== null) {
          links.push(
            Object.assign(
              new (vscode.TerminalLink as any)(
                m.index,
                m[0].length,
                "Open in Browser Tab",
              ),
              {
                _url: m[0],
              },
            ),
          );
        }
        return links;
      },
      handleTerminalLink(link: vscode.TerminalLink & { _url?: string }) {
        if (link._url) {
          BrowserPanel.createOrShow(context, normalizeUrl(link._url));
        }
      },
    }),
  );
}

export function deactivate() {}
