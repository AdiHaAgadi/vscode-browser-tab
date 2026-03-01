import * as assert from 'assert';
import * as vscode from 'vscode';
import { BrowserPanel } from '../../../src/browserPanel';

const EXT_ID = 'AdiHaAgadi.vscode-browser-tab';

suite('BrowserPanel — lifecycle', () => {
  let context: vscode.ExtensionContext;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    if (!ext.isActive) { await ext.activate(); }
    context = ext.exports?.context ?? (ext as any)._extensionContext;
  });

  teardown(() => {
    BrowserPanel.currentPanel?.dispose();
  });

  // ── Singleton ──────────────────────────────────────────────────────────────

  test('currentPanel is undefined before any panel is created', () => {
    assert.strictEqual(BrowserPanel.currentPanel, undefined);
  });

  test('createOrShow() sets currentPanel', () => {
    BrowserPanel.createOrShow(context);
    assert.ok(BrowserPanel.currentPanel, 'currentPanel should be set after createOrShow()');
  });

  test('createOrShow() returns the same panel on a second call (singleton)', () => {
    BrowserPanel.createOrShow(context);
    const first = BrowserPanel.currentPanel;
    BrowserPanel.createOrShow(context);
    const second = BrowserPanel.currentPanel;
    assert.strictEqual(first, second, 'should reuse the existing panel instance');
  });

  // ── Dispose ────────────────────────────────────────────────────────────────

  test('dispose() clears currentPanel to undefined', () => {
    BrowserPanel.createOrShow(context);
    assert.ok(BrowserPanel.currentPanel);
    BrowserPanel.currentPanel!.dispose();
    assert.strictEqual(BrowserPanel.currentPanel, undefined);
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('createOrShow() with a URL does not throw', () => {
    assert.doesNotThrow(() => {
      BrowserPanel.createOrShow(context, 'http://localhost:3000');
    });
    assert.ok(BrowserPanel.currentPanel);
  });
});

suite('BrowserPanel — settings integration', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    if (!ext.isActive) { await ext.activate(); }
  });

  teardown(() => {
    BrowserPanel.currentPanel?.dispose();
  });

  test('defaultUrl setting is readable and is a string', () => {
    const cfg = vscode.workspace.getConfiguration('vscode-browser-tab');
    const url = cfg.get<string>('defaultUrl');
    assert.ok(typeof url === 'string', 'defaultUrl should be a string');
    assert.ok(url.length > 0, 'defaultUrl should not be empty');
  });

  test('autoReload setting defaults to true', () => {
    const cfg = vscode.workspace.getConfiguration('vscode-browser-tab');
    assert.strictEqual(cfg.get<boolean>('autoReload', true), true);
  });

  test('hmrAware setting defaults to true', () => {
    const cfg = vscode.workspace.getConfiguration('vscode-browser-tab');
    assert.strictEqual(cfg.get<boolean>('hmrAware', true), true);
  });

  test('consoleOutput setting defaults to "all"', () => {
    const cfg = vscode.workspace.getConfiguration('vscode-browser-tab');
    assert.strictEqual(cfg.get<string>('consoleOutput', 'all'), 'all');
  });

  test('networkInspector setting defaults to true', () => {
    const cfg = vscode.workspace.getConfiguration('vscode-browser-tab');
    assert.strictEqual(cfg.get<boolean>('networkInspector', true), true);
  });
});
