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
      get: vi.fn().mockReturnValue('https://lynxprompt.geiser.cloud'),
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

  const linkedTreeItem = () =>
    new BlueprintTreeItem({
      id: 'bp-1',
      name: 'Test',
      description: null,
      type: 'AGENTS_MD',
      tier: 'SHORT',
      category: null,
      visibility: 'PRIVATE',
      tags: [],
      downloads: 0,
      favorites: 0,
      content_checksum: 'abc',
      repository_path: null,
      created_at: '',
      updated_at: '',
    });

  it('opens a linked file without writing when the cloud version is the same', async () => {
    await api.setToken('token');
    linkMappings.set('/workspace/AGENTS.md', {
      localPath: '/workspace/AGENTS.md',
      blueprintId: 'bp-1',
      lastChecksum: 'abc',
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Same', repository_path: null, content_checksum: 'remote-1' },
      }),
    });
    workspace.fs.stat.mockResolvedValue({ type: 1 });
    workspace.fs.readFile.mockResolvedValue(Buffer.from('# Same'));

    await pullBlueprint(api, linkMappings, linkedTreeItem());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(window.showTextDocument).toHaveBeenCalled();
    expect(linkMappings.get('/workspace/AGENTS.md')?.remoteChecksum).toBe('remote-1');
  });

  it('fetches the cloud version of a linked blueprint and offers to overwrite when it changed', async () => {
    await api.setToken('token');
    // Linked to a nested file, not the path the type gives
    linkMappings.set('/workspace/packages/api/AGENTS.md', {
      localPath: '/workspace/packages/api/AGENTS.md',
      blueprintId: 'bp-1',
      lastChecksum: 'abc',
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        blueprint: { id: 'bp-1', name: 'Test', type: 'AGENTS_MD', content: '# Edited on the web', repository_path: null, content_checksum: 'remote-2' },
      }),
    });
    workspace.fs.stat.mockResolvedValue({ type: 1 });
    workspace.fs.readFile.mockResolvedValue(Buffer.from('# Old local'));
    window.showWarningMessage.mockResolvedValueOnce('Overwrite');

    await pullBlueprint(api, linkMappings, linkedTreeItem());

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('differs from the cloud version'),
      expect.anything(),
      'Overwrite',
      'Show Diff',
      'Cancel'
    );
    const [uri, data] = workspace.fs.writeFile.mock.calls[0];
    expect(uri.fsPath).toBe('/workspace/packages/api/AGENTS.md');
    expect(Buffer.from(data).toString()).toBe('# Edited on the web');
  });

  it('refuses a repository_path that escapes the workspace', async () => {
    await api.setToken('token');
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ blueprints: [{ id: 'bp-1', name: 'Evil', type: 'AGENTS_MD', visibility: 'PUBLIC' }], has_more: false }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ blueprint: { id: 'bp-1', name: 'Evil', type: 'AGENTS_MD', content: 'x', repository_path: '../../.bashrc' } }),
      });
    window.showQuickPick.mockResolvedValueOnce({ label: 'Evil', blueprintId: 'bp-1' });

    await pullBlueprint(api, linkMappings);

    expect(workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(workspace.fs.stat).not.toHaveBeenCalled();
    expect(window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('outside the workspace'));
  });

  it('writes a Cline rule to .cline/rules/ when a legacy .clinerules file exists', async () => {
    await api.setToken('token');
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ blueprints: [{ id: 'bp-1', name: 'C', type: 'CLINE_RULES', visibility: 'PRIVATE' }], has_more: false }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ blueprint: { id: 'bp-1', name: 'C', type: 'CLINE_RULES', content: '# Cline', repository_path: null } }),
      });
    window.showQuickPick.mockResolvedValueOnce({ label: 'C', blueprintId: 'bp-1' });
    workspace.fs.stat
      .mockResolvedValueOnce({ type: 1 }) // .clinerules is a file
      .mockRejectedValueOnce(new Error('not found')); // target does not exist yet

    await pullBlueprint(api, linkMappings);

    expect(workspace.fs.writeFile.mock.calls[0][0].fsPath).toBe('/workspace/.cline/rules/project.md');
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
