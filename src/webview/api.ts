/// <reference lib="dom" />

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

/** Singleton VS Code API — must only be called once per webview lifetime. */
export const vscode = acquireVsCodeApi();
