import * as vscode from 'vscode';

function ts(): string {
  return `[${new Date().toLocaleTimeString()}]`;
}

export function handleNetworkRequest(msg: Record<string, any>, channel: vscode.OutputChannel) {
  if (!vscode.workspace.getConfiguration('vscode-browser-tab').get<boolean>('networkInspector', true)) { return; }
  channel.appendLine(`${ts()} ▶ ${msg.method ?? 'GET'} ${msg.url}`);
}

export function handleNetworkResponse(msg: Record<string, any>, channel: vscode.OutputChannel) {
  if (!vscode.workspace.getConfiguration('vscode-browser-tab').get<boolean>('networkInspector', true)) { return; }
  const s: number = msg.status ?? 0;
  const icon = getStatusIcon(s);
  const statusText = s === 0 ? 'FAILED (aborted/CORS/network error)' : `${s} ${msg.statusText ?? ''}`;
  channel.appendLine(`${ts()} ${icon} ${statusText} ← ${msg.url}`);
}

function getStatusIcon(status: number): string {
  if (status === 0 || status >= 400) {
    return '✗';
  }
  if (status >= 200 && status < 300) {
    return '✓';
  }
  return '○';
}
