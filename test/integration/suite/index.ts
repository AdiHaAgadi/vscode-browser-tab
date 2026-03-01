import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

/**
 * This file is loaded by @vscode/test-electron inside the VS Code process.
 * It discovers and runs all *.test.js files in this directory.
 */
export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui:      'tdd',
    color:   true,
    timeout: 15_000,   // panels and proxy start slowly in CI
  });

  const testsRoot = path.resolve(__dirname);
  console.log('Mocha Tests Root:', testsRoot);
  const files = await glob('**/*.test.js', { cwd: testsRoot, absolute: true });
  console.log('Found test files:', files);
  files.sort().forEach(f => mocha.addFile(f));

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) { reject(new Error(`${failures} test(s) failed.`)); }
      else { resolve(); }
    });
  });
}
