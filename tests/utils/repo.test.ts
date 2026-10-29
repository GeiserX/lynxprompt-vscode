import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { normalizeRemote, repositoryRoots } from '../../src/utils/repo';

// Same vectors and hash as the CLI (cli/src) and the GitHub Action: one
// repository must map to one hierarchy whichever client pushed it
const VECTORS = [
  'git@github.com:GeiserX/LynxPrompt.git',
  'https://github.com/GeiserX/LynxPrompt',
  'https://github.com/GeiserX/LynxPrompt.git/',
  'ssh://git@github.com:22/GeiserX/LynxPrompt.git',
  'https://x-access-token:abc@GitHub.com/GeiserX/LynxPrompt',
];
const CANONICAL = 'https://github.com/GeiserX/LynxPrompt';
const ROOT = 'eb2e56c7498b9899';

describe('normalizeRemote', () => {
  it.each(VECTORS)('%s -> the canonical https URL', (remote) => {
    expect(normalizeRemote(remote)).toBe(CANONICAL);
  });

  it('turns git:// into https and keeps the path case', () => {
    expect(normalizeRemote('git://Example.org/Owner/Repo.git')).toBe('https://example.org/Owner/Repo');
  });

  it('leaves a local path alone', () => {
    expect(normalizeRemote('/srv/git/repo.git')).toBe('/srv/git/repo');
  });
});

describe('repositoryRoots', () => {
  it.each(VECTORS)('%s gives the pinned root', (remote) => {
    const roots = repositoryRoots(`[remote "origin"]\n\turl = ${remote}\n`);
    expect(roots?.root).toBe(ROOT);
  });

  it('keeps the raw-remote hash as the legacy key', () => {
    const remote = 'git@github.com:GeiserX/LynxPrompt.git';
    const roots = repositoryRoots(`\turl = ${remote}\n`);
    expect(roots?.legacyRoot).toBe(createHash('sha256').update(remote).digest('hex').slice(0, 16));
  });

  it('is undefined when the config names no remote', () => {
    expect(repositoryRoots('[core]\n\tbare = false\n')).toBeUndefined();
  });
});
