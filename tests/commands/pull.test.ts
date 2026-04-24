import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window, workspace, commands, Uri, createMockSecretStorage, resetAllMocks } from '../__mocks__/vscode';
import { LynxPromptApi } from '../../src/api';
import { pullBlueprint } from '../../src/commands/pull';
import { BlueprintTreeItem } from '../../src/views/blueprintTree';
import type { LinkMapping } from '../../src/types';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock configDetector
vi.mock('../../src/utils/configDetector', () => ({
  computeFileChecksum: vi.fn().mockResolvedValue('checksum-abc'),
}));

describe('pullBlueprint', () => {
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
    await pullBlueprint(api, linkMappings);
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      'Please sign in to LynxPrompt first.'
    );
  });

  it('prompts to pick a blueprint when no item provided', async () => {
    await api.setToken('token');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprints: [
          { id: 'bp-1', name: 'Test BP', type: 'AGENTS_MD', visibility: 'PRIVATE', description: 'A desc' },
        ],
        total: 1,
        limit: 200,
        offset: 0,
      }),
    });

    window.showQuickPick.mockResolvedValueOnce(undefined); // user cancels

    await pullBlueprint(api, linkMappings);

    expect(window.showQuickPick).toHaveBeenCalled();
  });

  it('shows message when user has no blueprints', async () => {
    await api.setToken('token');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprints: [], total: 0, limit: 200, offset: 0 }),
    });

    await pullBlueprint(api, linkMappings);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('no blueprints')
    );
  });

  it('returns early when user cancels blueprint pick', async () => {
    await api.setToken('token');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprints: [{ id: 'bp-1', name: 'Test', type: 'AGENTS_MD', visibility: 'PRIVATE' }],
        total: 1,
        limit: 200,
        offset: 0,
      }),
    });

    window.showQuickPick.mockResolvedValueOnce(undefined);

    await pullBlueprint(api, linkMappings);

    // Should not have fetched the full blueprint
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only listBlueprints
  });

  it('shows error when no workspace folder is open', async () => {
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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Test', repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });

    await pullBlueprint(api, linkMappings);

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('No workspace folder')
    );
  });

  it('asks to pick workspace folder when multiple exist', async () => {
    await api.setToken('token');
    workspace.workspaceFolders = [
      { uri: Uri.file('/workspace1'), name: 'ws1', index: 0 },
      { uri: Uri.file('/workspace2'), name: 'ws2', index: 1 },
    ];

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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Test', repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });
    window.showWorkspaceFolderPick.mockResolvedValueOnce(undefined); // user cancels

    await pullBlueprint(api, linkMappings);

    expect(window.showWorkspaceFolderPick).toHaveBeenCalled();
  });

  it('writes file and creates link mapping on successful pull', async () => {
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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Test Content', repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });

    // File doesn't exist
    workspace.fs.stat.mockRejectedValueOnce(new Error('File not found'));

    await pullBlueprint(api, linkMappings);

    expect(workspace.fs.writeFile).toHaveBeenCalled();
    expect(linkMappings.has('/workspace/AGENTS.md')).toBe(true);
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('pulled')
    );
  });

  it('uses repository_path when available', async () => {
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
          blueprint: {
            id: 'bp-1',
            name: 'Test',
            type: 'AGENTS_MD',
            content: '# Test',
            repository_path: 'custom/path/AGENTS.md',
          },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });
    workspace.fs.stat.mockRejectedValueOnce(new Error('File not found'));

    await pullBlueprint(api, linkMappings);

    expect(workspace.fs.writeFile).toHaveBeenCalled();
    expect(linkMappings.has('/workspace/custom/path/AGENTS.md')).toBe(true);
  });

  it('handles file already up to date', async () => {
    await api.setToken('token');

    const content = '# Already synced';

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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content, repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });

    // File exists with same content
    workspace.fs.stat.mockResolvedValueOnce({ type: 1 });
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from(content));

    await pullBlueprint(api, linkMappings);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('already up to date')
    );
  });

  it('prompts for overwrite when file differs', async () => {
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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Cloud', repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });

    // File exists with different content
    workspace.fs.stat.mockResolvedValueOnce({ type: 1 });
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Local'));

    // User cancels overwrite
    window.showWarningMessage.mockResolvedValueOnce('Cancel');

    await pullBlueprint(api, linkMappings);

    // Should not write
    expect(workspace.fs.writeFile).not.toHaveBeenCalled();
  });

  it('overwrites when user confirms', async () => {
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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Cloud', repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });

    workspace.fs.stat.mockResolvedValueOnce({ type: 1 });
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Local'));

    window.showWarningMessage.mockResolvedValueOnce('Overwrite');

    await pullBlueprint(api, linkMappings);

    expect(workspace.fs.writeFile).toHaveBeenCalled();
  });

  it('Show Diff flow: shows diff then overwrites on confirm', async () => {
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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Cloud Version', repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });

    // File exists with different content
    workspace.fs.stat.mockResolvedValueOnce({ type: 1 });
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Local Version'));

    // First warning: user picks "Show Diff"
    window.showWarningMessage
      .mockResolvedValueOnce('Show Diff')
      // Second warning: user picks "Overwrite"
      .mockResolvedValueOnce('Overwrite');

    await pullBlueprint(api, linkMappings);

    // Should have executed vscode.diff
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      expect.anything(),
      expect.anything(),
      expect.stringContaining('Local')
    );
    // Should have written the file (overwrite after diff)
    expect(workspace.fs.writeFile).toHaveBeenCalled();
  });

  it('Show Diff flow: cancels after viewing diff', async () => {
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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Cloud', repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });

    workspace.fs.stat.mockResolvedValueOnce({ type: 1 });
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Local'));

    // Show Diff then Cancel
    window.showWarningMessage
      .mockResolvedValueOnce('Show Diff')
      .mockResolvedValueOnce('Cancel');

    await pullBlueprint(api, linkMappings);

    // Should NOT have written the file
    // writeFile is called once for the temp cloud file, but not for the actual pull
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      expect.anything(),
      expect.anything(),
      expect.any(String)
    );
  });

  it('handles BlueprintTreeItem with existing linked file that still exists', async () => {
    await api.setToken('token');

    // Create a BlueprintTreeItem
    const bp = {
      id: 'bp-1',
      name: 'Test',
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

    // Link mapping exists and file exists
    linkMappings.set('/workspace/AGENTS.md', {
      localPath: '/workspace/AGENTS.md',
      blueprintId: 'bp-1',
      lastChecksum: 'abc',
    });

    // File exists
    workspace.fs.stat.mockResolvedValueOnce({ type: 1 });

    await pullBlueprint(api, linkMappings, treeItem);

    // Should open the existing file, not fetch from API
    expect(workspace.openTextDocument).toHaveBeenCalled();
    expect(window.showTextDocument).toHaveBeenCalled();
    // Should NOT have called fetch (no need to get blueprint)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles BlueprintTreeItem with stale linked file (deleted)', async () => {
    await api.setToken('token');

    const bp = {
      id: 'bp-1',
      name: 'Test',
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

    // Link mapping exists but file was deleted
    linkMappings.set('/workspace/AGENTS.md', {
      localPath: '/workspace/AGENTS.md',
      blueprintId: 'bp-1',
      lastChecksum: 'abc',
    });

    // File doesn't exist (deleted)
    workspace.fs.stat.mockRejectedValueOnce(new Error('File not found'));

    // Now it proceeds to fetch the blueprint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Content', repository_path: null },
      }),
    });

    // File doesn't exist at target either
    workspace.fs.stat.mockRejectedValueOnce(new Error('File not found'));

    await pullBlueprint(api, linkMappings, treeItem);

    // Should remove stale mapping and proceed with pull
    expect(workspace.fs.writeFile).toHaveBeenCalled();
  });

  it('handles BlueprintTreeItem directly fetching blueprint', async () => {
    await api.setToken('token');

    const bp = {
      id: 'bp-2',
      name: 'New Blueprint',
      description: null,
      type: 'CLAUDE_MD' as const,
      tier: 'SHORT' as const,
      visibility: 'PUBLIC' as const,
      tags: [],
      downloads: 0,
      favorites: 0,
      content_checksum: 'xyz',
      created_at: '',
      updated_at: '',
    };
    const treeItem = new BlueprintTreeItem(bp);

    // No existing link mapping
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprint: { id: 'bp-2', name: 'New Blueprint', type: 'CLAUDE_MD', content: '# Claude', repository_path: null },
      }),
    });

    // File doesn't exist
    workspace.fs.stat.mockRejectedValueOnce(new Error('File not found'));

    await pullBlueprint(api, linkMappings, treeItem);

    expect(workspace.fs.writeFile).toHaveBeenCalled();
    expect(linkMappings.has('/workspace/CLAUDE.md')).toBe(true);
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('pulled')
    );
  });

  it('refreshes local files tree after successful pull', async () => {
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
          blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Content', repository_path: null },
        }),
      });

    window.showQuickPick.mockResolvedValueOnce({ label: 'Test', blueprintId: 'bp-1' });
    workspace.fs.stat.mockRejectedValueOnce(new Error('File not found'));

    await pullBlueprint(api, linkMappings);

    expect(commands.executeCommand).toHaveBeenCalledWith('lynxprompt.refreshLocalFiles');
  });
});
