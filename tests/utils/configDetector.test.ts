import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspace, Uri } from '../__mocks__/vscode';
import { detectConfigFiles, computeFileChecksum, getConfigFileType } from '../../src/utils/configDetector';
import type { LinkMapping } from '../../src/types';

describe('computeFileChecksum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes SHA-256 hash of file contents', async () => {
    const content = Buffer.from('Hello, world!');
    workspace.fs.readFile.mockResolvedValueOnce(content);

    const checksum = await computeFileChecksum(Uri.file('/test.md'));

    expect(checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(workspace.fs.readFile).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/test.md' }));
  });

  it('returns empty string on read error', async () => {
    workspace.fs.readFile.mockRejectedValueOnce(new Error('File not found'));

    const checksum = await computeFileChecksum(Uri.file('/missing.md'));

    expect(checksum).toBe('');
  });

  it('produces different checksums for different content', async () => {
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('content-a'));
    const checksumA = await computeFileChecksum(Uri.file('/a.md'));

    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('content-b'));
    const checksumB = await computeFileChecksum(Uri.file('/b.md'));

    expect(checksumA).not.toBe(checksumB);
  });

  it('produces same checksum for same content', async () => {
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('same'));
    const checksum1 = await computeFileChecksum(Uri.file('/a.md'));

    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('same'));
    const checksum2 = await computeFileChecksum(Uri.file('/b.md'));

    expect(checksum1).toBe(checksum2);
  });
});

describe('getConfigFileType', () => {
  it('delegates to pathToBlueprintType', () => {
    expect(getConfigFileType('/workspace/AGENTS.md')).toBe('AGENTS_MD');
    expect(getConfigFileType('/workspace/CLAUDE.md')).toBe('CLAUDE_MD');
    expect(getConfigFileType('/workspace/README.md')).toBeUndefined();
  });
});

describe('detectConfigFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspace.workspaceFolders = [
      { uri: Uri.file('/workspace'), name: 'workspace', index: 0 },
    ];
    workspace.getWorkspaceFolder.mockReturnValue({
      uri: Uri.file('/workspace'),
      name: 'workspace',
      index: 0,
    });
  });

  it('returns empty when no workspace folders', async () => {
    workspace.workspaceFolders = [];
    const results = await detectConfigFiles(new Map());
    expect(results).toEqual([]);
  });

  it('returns empty when workspaceFolders is undefined', async () => {
    workspace.workspaceFolders = undefined as any;
    const results = await detectConfigFiles(new Map());
    expect(results).toEqual([]);
  });

  it('detects config files from workspace', async () => {
    // Mock findFiles to return some URIs for the first glob pattern (AGENTS.md)
    workspace.findFiles
      .mockResolvedValueOnce([Uri.file('/workspace/AGENTS.md')]) // **/AGENTS.md
      .mockResolvedValueOnce([]) // **/CLAUDE.md
      .mockResolvedValueOnce([]) // .cursor/rules/*.mdc
      .mockResolvedValueOnce([]) // .cursor/rules/*.md
      .mockResolvedValueOnce([]) // copilot-instructions.md
      .mockResolvedValueOnce([]) // copilot-instructions.md (root)
      .mockResolvedValueOnce([]) // .windsurfrules
      .mockResolvedValueOnce([]) // .clinerules
      .mockResolvedValueOnce([]) // .aider.conf.yml
      .mockResolvedValueOnce([]) // .continue/config.json
      .mockResolvedValueOnce([]); // CODEX.md

    const results = await detectConfigFiles(new Map());
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('AGENTS_MD');
    expect(results[0].status).toBe('untracked');
    expect(results[0].relativePath).toBe('AGENTS.md');
  });

  it('deduplicates files found by multiple glob patterns', async () => {
    const uri = Uri.file('/workspace/AGENTS.md');
    workspace.findFiles
      .mockResolvedValueOnce([uri]) // First glob
      .mockResolvedValueOnce([uri]) // Same URI from another glob
      .mockResolvedValue([]); // Rest return empty

    const results = await detectConfigFiles(new Map());
    expect(results).toHaveLength(1);
  });

  it('marks linked file as synced when checksum matches', async () => {
    const uri = Uri.file('/workspace/AGENTS.md');
    workspace.findFiles.mockResolvedValueOnce([uri]).mockResolvedValue([]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('content'));

    const linkMappings = new Map<string, LinkMapping>();

    // Compute the expected checksum
    const crypto = await import('crypto');
    const expectedChecksum = crypto.createHash('sha256').update(Buffer.from('content')).digest('hex');

    linkMappings.set('/workspace/AGENTS.md', {
      localPath: '/workspace/AGENTS.md',
      blueprintId: 'bp-1',
      lastChecksum: expectedChecksum,
    });

    const results = await detectConfigFiles(linkMappings);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('synced');
    expect(results[0].linkedBlueprintId).toBe('bp-1');
  });

  it('marks linked file as modified when checksum differs', async () => {
    const uri = Uri.file('/workspace/AGENTS.md');
    workspace.findFiles.mockResolvedValueOnce([uri]).mockResolvedValue([]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('new content'));

    const linkMappings = new Map<string, LinkMapping>();
    linkMappings.set('/workspace/AGENTS.md', {
      localPath: '/workspace/AGENTS.md',
      blueprintId: 'bp-1',
      lastChecksum: 'old-checksum-that-wont-match',
    });

    const results = await detectConfigFiles(linkMappings);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('modified');
  });

  it('sorts results: synced first, then modified, then untracked', async () => {
    workspace.findFiles
      .mockResolvedValueOnce([Uri.file('/workspace/AGENTS.md')]) // untracked
      .mockResolvedValueOnce([Uri.file('/workspace/CLAUDE.md')]) // will be modified
      .mockResolvedValue([]);

    workspace.fs.readFile.mockResolvedValue(Buffer.from('content'));

    const linkMappings = new Map<string, LinkMapping>();
    linkMappings.set('/workspace/CLAUDE.md', {
      localPath: '/workspace/CLAUDE.md',
      blueprintId: 'bp-1',
      lastChecksum: 'different-checksum',
    });

    const results = await detectConfigFiles(linkMappings);
    expect(results).toHaveLength(2);
    // modified before untracked
    expect(results[0].status).toBe('modified');
    expect(results[1].status).toBe('untracked');
  });

  it('skips files with unrecognized types', async () => {
    // Return a URI whose path won't match any known type
    workspace.findFiles
      .mockResolvedValueOnce([Uri.file('/workspace/README.md')])
      .mockResolvedValue([]);

    const results = await detectConfigFiles(new Map());
    expect(results).toHaveLength(0);
  });
});
