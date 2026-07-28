import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window, workspace, commands, Uri, createMockSecretStorage } from '../__mocks__/vscode';
import { LynxPromptApi } from '../../src/api';
import { diffBlueprint } from '../../src/commands/diff';
import type { LinkMapping } from '../../src/types';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('diffBlueprint', () => {
  let secrets: ReturnType<typeof createMockSecretStorage>;
  let api: LynxPromptApi;
  let linkMappings: Map<string, LinkMapping>;

  beforeEach(() => {
    vi.clearAllMocks();
    secrets = createMockSecretStorage();
    api = new LynxPromptApi(secrets as any);
    linkMappings = new Map();
    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue('https://lynxprompt.com'),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });
    workspace.workspaceFolders = [
      { uri: Uri.file('/workspace'), name: 'workspace', index: 0 },
    ];
  });

  it('shows error when not authenticated', async () => {
    await diffBlueprint(api, linkMappings);
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      'Please sign in to LynxPrompt first.'
    );
  });

  it('prompts to pick a blueprint when no item or mapping', async () => {
    await api.setToken('token');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprints: [
          { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', visibility: 'PRIVATE' },
        ],
        total: 1, limit: 200, offset: 0,
      }),
    });

    window.showQuickPick.mockResolvedValueOnce(undefined); // user cancels

    await diffBlueprint(api, linkMappings);

    expect(window.showQuickPick).toHaveBeenCalled();
  });

  it('shows message when no blueprints available', async () => {
    await api.setToken('token');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprints: [], total: 0, limit: 200, offset: 0 }),
    });

    await diffBlueprint(api, linkMappings);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      'No blueprints available to compare.'
    );
  });

  it('diffs with vscode.Uri item that has link mapping', async () => {
    await api.setToken('token');

    const filePath = '/workspace/AGENTS.md';
    linkMappings.set(filePath, {
      localPath: filePath,
      blueprintId: 'bp-1',
      lastChecksum: 'abc',
    });

    const blueprint = {
      id: 'bp-1',
      name: 'Test',
      type: 'AGENTS_MD',
      content: '# Cloud Content',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint }),
    });

    await diffBlueprint(api, linkMappings, Uri.file(filePath) as any);

    expect(workspace.fs.writeFile).toHaveBeenCalled(); // Wrote temp cloud file
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      expect.anything(),
      expect.anything(),
      expect.stringContaining('Local')
    );
  });

  it('shows cloud version when no local file found', async () => {
    await api.setToken('token');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [{ id: 'bp-1', name: 'Test', type: 'AGENTS_MD', visibility: 'PRIVATE' }],
          total: 1, limit: 200, offset: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Cloud' },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({
      label: 'Test',
      blueprintId: 'bp-1',
      type: 'AGENTS_MD',
    });

    // No local file found via link mappings or stat
    workspace.fs.stat.mockRejectedValue(new Error('not found'));

    await diffBlueprint(api, linkMappings);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('No local file found')
    );
  });

  it('shows error when no workspace folder for diff output', async () => {
    await api.setToken('token');
    workspace.workspaceFolders = [];

    const filePath = '/workspace/AGENTS.md';
    linkMappings.set(filePath, {
      localPath: filePath,
      blueprintId: 'bp-1',
      lastChecksum: 'abc',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Cloud' },
      }),
    });

    // Override workspaceFolders to be undefined for the temp file section
    const origFolders = workspace.workspaceFolders;
    workspace.workspaceFolders = undefined as any;

    await diffBlueprint(api, linkMappings, Uri.file(filePath) as any);

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      'No workspace folder open.'
    );

    workspace.workspaceFolders = origFolders;
  });

  it('finds local file via link mappings during blueprint-only diff', async () => {
    await api.setToken('token');

    const filePath = '/workspace/AGENTS.md';
    linkMappings.set(filePath, {
      localPath: filePath,
      blueprintId: 'bp-1',
      lastChecksum: 'abc',
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [{ id: 'bp-1', name: 'Test', type: 'AGENTS_MD', visibility: 'PRIVATE' }],
          total: 1, limit: 200, offset: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Cloud' },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({
      label: 'Test',
      blueprintId: 'bp-1',
      type: 'AGENTS_MD',
    });

    await diffBlueprint(api, linkMappings);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      expect.anything(),
      expect.anything(),
      expect.any(String)
    );
  });

  it('finds local file via fs.stat fallback when no link mapping matches', async () => {
    await api.setToken('token');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [{ id: 'bp-2', name: 'Test2', type: 'AGENTS_MD', visibility: 'PRIVATE' }],
          total: 1, limit: 200, offset: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprint: { id: 'bp-2', name: 'Test2', type: 'AGENTS_MD', content: '# Cloud Content' },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({
      label: 'Test2',
      blueprintId: 'bp-2',
      type: 'AGENTS_MD',
    });

    // No link mapping, but file exists on disk at the default path
    workspace.fs.stat.mockResolvedValueOnce({ type: 1, size: 100, ctime: 0, mtime: 0 });

    await diffBlueprint(api, linkMappings);

    // Should have opened a diff since the file was found via stat
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      expect.anything(),
      expect.anything(),
      expect.stringContaining('Local')
    );
  });

  it('handles BlueprintTreeItem item directly', async () => {
    await api.setToken('token');

    const { BlueprintTreeItem } = await import('../../src/views/blueprintTree');
    const bp = {
      id: 'bp-direct',
      name: 'Direct BP',
      description: null,
      type: 'AGENTS_MD' as const,
      tier: 'SHORT' as const,
      visibility: 'PRIVATE' as const,
      tags: [],
      downloads: 0,
      favorites: 0,
      content_checksum: 'abc',
      created_at: '',
      updated_at: '',
    };
    const treeItem = new BlueprintTreeItem(bp);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprint: { id: 'bp-direct', name: 'Direct BP', type: 'AGENTS_MD', content: '# Direct' },
      }),
    });

    // No local file found
    workspace.fs.stat.mockRejectedValue(new Error('not found'));

    await diffBlueprint(api, linkMappings, treeItem as any);

    // Should show cloud version since no local file
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('No local file found')
    );
  });

  it('handles LocalFileTreeItem item directly', async () => {
    await api.setToken('token');

    const { LocalFileTreeItem } = await import('../../src/views/localFilesTree');
    const configFile = {
      absolutePath: '/workspace/CLAUDE.md',
      relativePath: 'CLAUDE.md',
      type: 'CLAUDE_MD' as const,
      linkedBlueprintId: 'bp-linked',
      status: 'synced' as const,
    };
    const localItem = new LocalFileTreeItem(configFile);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprint: { id: 'bp-linked', name: 'Linked BP', type: 'CLAUDE_MD', content: '# Linked Cloud' },
      }),
    });

    await diffBlueprint(api, linkMappings, localItem as any);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      expect.anything(),
      expect.anything(),
      expect.stringContaining('Local')
    );
  });

  it('handles LocalFileTreeItem without linkedBlueprintId (picks from list)', async () => {
    await api.setToken('token');

    const { LocalFileTreeItem } = await import('../../src/views/localFilesTree');
    const configFile = {
      absolutePath: '/workspace/CLAUDE.md',
      relativePath: 'CLAUDE.md',
      type: 'CLAUDE_MD' as const,
      status: 'untracked' as const,
    };
    const localItem = new LocalFileTreeItem(configFile);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [{ id: 'bp-pick', name: 'Pick Me', type: 'CLAUDE_MD', visibility: 'PRIVATE' }],
          total: 1, limit: 200, offset: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprint: { id: 'bp-pick', name: 'Pick Me', type: 'CLAUDE_MD', content: '# Picked' },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({
      label: 'Pick Me',
      blueprintId: 'bp-pick',
      type: 'CLAUDE_MD',
    });

    await diffBlueprint(api, linkMappings, localItem as any);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      expect.anything(),
      expect.anything(),
      expect.stringContaining('Local')
    );
  });

  it('handles no workspace folders when searching for local file', async () => {
    await api.setToken('token');
    workspace.workspaceFolders = [];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [{ id: 'bp-1', name: 'Test', type: 'AGENTS_MD', visibility: 'PRIVATE' }],
          total: 1, limit: 200, offset: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Cloud' },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({
      label: 'Test',
      blueprintId: 'bp-1',
      type: 'AGENTS_MD',
    });

    await diffBlueprint(api, linkMappings);

    expect(window.showErrorMessage).toHaveBeenCalledWith('No workspace folder open.');
  });

  it('uses vscode.Uri item without link mapping (picks blueprint)', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/AGENTS.md');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [{ id: 'bp-uri', name: 'URI BP', type: 'AGENTS_MD', visibility: 'PRIVATE' }],
          total: 1, limit: 200, offset: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprint: { id: 'bp-uri', name: 'URI BP', type: 'AGENTS_MD', content: '# URI' },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({
      label: 'URI BP',
      blueprintId: 'bp-uri',
      type: 'AGENTS_MD',
    });

    await diffBlueprint(api, linkMappings, fileUri as any);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      expect.anything(),
      expect.anything(),
      expect.stringContaining('Local')
    );
  });
});
