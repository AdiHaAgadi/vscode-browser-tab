import * as vscode from 'vscode';

const CONSOLE_LEVEL: Record<string, number> = { log: 0, info: 0, debug: 0, warn: 1, error: 2 };
const CONSOLE_MIN:   Record<string, number> = { all: 0, warn: 1, error: 2 };

export function handleConsole(
  msg: Record<string, any>,
  channel: vscode.LogOutputChannel,
) {
  const minLevel = vscode.workspace.getConfiguration('vscode-browser-tab').get<string>('consoleOutput', 'all');
  if (minLevel === 'none') { return; }

  const level = (msg.level ?? 'log').toLowerCase() as string;
  if ((CONSOLE_LEVEL[level] ?? 0) < (CONSOLE_MIN[minLevel] ?? 0)) { return; }

  const text = (msg.args as string[]).join(' ');

  const loggers: Record<string, () => void> = {
    error: () => channel.error(text),
    warn:  () => channel.warn(text),
    debug: () => channel.debug(text),
  };
  (loggers[level] ?? (() => channel.info(text)))();
}
