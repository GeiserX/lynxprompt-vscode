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
});
