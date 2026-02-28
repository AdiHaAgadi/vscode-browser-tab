import { describe, it, expect, vi } from 'vitest';
import { getPanelHtml } from '../../src/utils/panelHtml';

// ── Mock vscode ───────────────────────────────────────────────────────────────
// getPanelHtml uses vscode.Uri.joinPath() to resolve media asset URIs,
// and webview.asWebviewUri() to convert them to webview-safe URIs.

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (_base: any, ...parts: string[]) => ({ path: parts.join('/') }),
  },
}));

// ── Fake webview ──────────────────────────────────────────────────────────────

function makeWebview(cspSource = 'vscode-webview-resource:') {
  return {
    cspSource,
    asWebviewUri: (uri: { path: string }) => `webview://media/${uri.path}`,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getPanelHtml', () => {
  const fakeExtensionUri = { path: '/ext' } as any;

  it('puts the initialSrc in the iframe src attribute', () => {
    const html = getPanelHtml(makeWebview() as any, fakeExtensionUri, 'http://localhost:56100/', 'http://localhost:4200');
    expect(html).toContain('src="http://localhost:56100/"');
  });

  it('puts the display URL in the url-input value and status bar', () => {
    const html = getPanelHtml(makeWebview() as any, fakeExtensionUri, 'http://localhost:56100/', 'http://localhost:4200');
    expect(html).toContain('value="http://localhost:4200"');
    expect(html).toContain('http://localhost:4200');
  });

  it('includes a non-empty nonce in the CSP and script tag', () => {
    const html = getPanelHtml(makeWebview() as any, fakeExtensionUri, 'about:blank', 'about:blank');
    const cspMatch   = html.match(/nonce-([A-Za-z0-9]+)/);
    const scriptMatch = html.match(/nonce="([A-Za-z0-9]+)"/);
    expect(cspMatch).not.toBeNull();
    expect(scriptMatch).not.toBeNull();
    expect(cspMatch![1]).toBe(scriptMatch![1]);       // same nonce in both places
    expect(cspMatch![1].length).toBe(32);             // correct length
  });

  it('generates a different nonce on each call', () => {
    const h1 = getPanelHtml(makeWebview() as any, fakeExtensionUri, 'about:blank', 'about:blank');
    const h2 = getPanelHtml(makeWebview() as any, fakeExtensionUri, 'about:blank', 'about:blank');
    const n1 = h1.match(/nonce-([A-Za-z0-9]+)/)![1];
    const n2 = h2.match(/nonce-([A-Za-z0-9]+)/)![1];
    expect(n1).not.toBe(n2);
  });

  it('includes the cspSource in the Content-Security-Policy meta tag', () => {
    const html = getPanelHtml(makeWebview('my-csp-source') as any, fakeExtensionUri, 'about:blank', 'about:blank');
    expect(html).toContain('my-csp-source');
  });

  it('links to browser.css and browser.js', () => {
    const html = getPanelHtml(makeWebview() as any, fakeExtensionUri, 'about:blank', 'about:blank');
    expect(html).toMatch(/browser\.css/);
    expect(html).toMatch(/browser\.js/);
  });

  it('produces valid-looking HTML', () => {
    const html = getPanelHtml(makeWebview() as any, fakeExtensionUri, 'about:blank', 'about:blank');
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
    expect(html).toContain('<meta charset="UTF-8"');
  });
});
