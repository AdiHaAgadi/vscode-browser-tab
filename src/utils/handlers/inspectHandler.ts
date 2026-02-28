import * as vscode from 'vscode';

/** Framework-generated class patterns that won't exist in user source code. */
const FRAMEWORK_CLASS_PATTERNS = [
  /^_ng(?:host|content)-/,
  /^ng-(?:star|scope|binding|isolate|pristine|dirty|valid|invalid|touched|untouched)/,
  /^cdk-/,
  /^mat-mdc-/,
  /^v-b-/,
];

/**
 * Strips bundler/CSS-Modules hash suffixes to recover the original source class name.
 *
 * Examples:
 *   container_qgp7o_1   → container   (hash + counter)
 *   __container__fx12g3 → container   (double-underscore wrapped)
 *   container__2xK9b    → container   (CSS Modules)
 *   container_primary   → unchanged   (semantic word, no digit mix)
 */
function stripHash(cls: string): string {
  let s = cls.replace(/^_+/, '');
  s = s.replace(
    /(?:_+|-{2,})[a-zA-Z0-9]*(?:[a-zA-Z][0-9]|[0-9][a-zA-Z])[a-zA-Z0-9]*(?:_\d+)?$/,
    '',
  );
  return (s && s !== cls) ? s : cls;
}

export async function handleInspectElement(msg: Record<string, any>) {
  const tag: string       = msg.tag ?? 'unknown';
  const id: string        = msg.id ?? '';
  const classes: string[] = msg.classes ?? [];

  const isFramework = (c: string) => FRAMEWORK_CLASS_PATTERNS.some(r => r.test(c));
  const sourceClasses = classes.filter(c => !isFramework(c));

  const terms: { label: string; term: string; description?: string }[] = [];

  if (id) {
    terms.push({ label: `$(search) Search for #${id}`, term: id });
  }

  for (const cls of sourceClasses) {
    const clean = stripHash(cls);
    terms.push(
      clean !== cls
        ? { label: `$(search) Search for .${clean}`, term: clean, description: cls }
        : { label: `$(search) Search for .${cls}`,   term: cls },
    );
  }

  for (const cls of classes.filter(isFramework)) {
    terms.push({ label: `$(warning) ${cls}`, term: cls, description: 'framework-generated, unlikely in source' });
  }

  if (terms.length === 0) {
    vscode.window.showInformationMessage(`Inspected <${tag}> — no class or ID to search for.`);
    return;
  }

  const picked = await vscode.window.showQuickPick(terms, {
    title: `Inspect: <${tag}${id ? '#' + id : ''}>`,
    placeHolder: 'Select to find in workspace files',
  });

  if (picked?.term) {
    vscode.commands.executeCommand('workbench.action.findInFiles', { query: picked.term, triggerSearch: true });
  }
}
