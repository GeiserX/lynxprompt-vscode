import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import * as path from 'path';

// What `vsce package` would put in the VSIX: only the runtime files, never
// the repo's agent, tracker or CI files
const ALLOWED = /^(dist\/extension\.js|media\/.+|package\.json|README\.md|CHANGELOG\.md|LICENSE)$/;

describe('published package', () => {
  it('contains only the allowlisted files', () => {
    const root = path.resolve(__dirname, '..');
    const vsce = path.join(root, 'node_modules', '@vscode', 'vsce', 'vsce');
    const out = execFileSync(process.execPath, [vsce, 'ls'], {
      cwd: root,
      encoding: 'utf-8',
    });
    const files = out.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(files).toContain('package.json');
    expect(files.filter((f) => !ALLOWED.test(f))).toEqual([]);
  }, 60_000);
});
