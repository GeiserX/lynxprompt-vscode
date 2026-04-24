import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window, workspace, commands, Uri, createMockSecretStorage, resetAllMocks } from '../__mocks__/vscode';
import { LynxPromptApi } from '../../src/api';
import { pushConfig } from '../../src/commands/push';
import type { LinkMapping } from '../../src/types';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock configDetector
vi.mock('../../src/utils/configDetector', () => ({
  computeFileChecksum: vi.fn().mockResolvedValue('checksum-abc'),
}));

describe('pushConfig', () => {
  let secrets: ReturnType<typeof createMockSecretStorage>;
  let api: LynxPromptApi;
  let linkMappings: Map<string, LinkMapping>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllMocks();
    mockFetch.mockReset();
    secrets = createMockSecretStorage();
    api = new LynxPromptApi(secrets as any);
    linkMappings = new Map();
    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue('https://lynxprompt.com'),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });
  });

  it('shows error when not authenticated', async () => {
    await pushConfig(api, linkMappings);
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      'Please sign in to LynxPrompt first.'
    );
  });

  it('opens file dialog when no item provided', async () => {
    await api.setToken('token');
    window.showOpenDialog.mockResolvedValueOnce(undefined);

    await pushConfig(api, linkMappings);

    expect(window.showOpenDialog).toHaveBeenCalled();
  });

  it('returns early when user cancels file dialog', async () => {
    await api.setToken('token');
    window.showOpenDialog.mockResolvedValueOnce(undefined);

    await pushConfig(api, linkMappings);

    expect(workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('uses file from open dialog and creates blueprint', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/AGENTS.md');
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    // AGENTS.md auto-detects type, so no type QuickPick
    // Goes straight to create-new flow (no existing link mapping)
    window.showInputBox
      .mockResolvedValueOnce('My Blueprint')  // name
      .mockResolvedValueOnce('Description');   // description
    window.showQuickPick.mockResolvedValueOnce({ label: 'Private', value: 'PRIVATE' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint: { id: 'new-1', name: 'My Blueprint' } }),
    });

    await pushConfig(api, linkMappings);

    expect(workspace.fs.readFile).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalled();
  });

  it('prompts for blueprint type when not auto-detected', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/custom-file.txt');
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    // Type can't be detected, QuickPick for type first - user cancels
    window.showQuickPick.mockResolvedValueOnce(undefined);

    await pushConfig(api, linkMappings);

    expect(window.showQuickPick).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('warns on empty file content', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/AGENTS.md');
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('   '));

    await pushConfig(api, linkMappings);

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      'File is empty. Nothing to push.'
    );
  });

  it('updates existing linked blueprint', async () => {
    await api.setToken('token');

    const filePath = '/workspace/AGENTS.md';
    linkMappings.set(filePath, {
      localPath: filePath,
      blueprintId: 'bp-1',
      lastChecksum: 'old-checksum',
    });

    const fileUri = Uri.file(filePath);
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Updated Content'));

    // User picks "Update existing blueprint"
    window.showQuickPick.mockResolvedValueOnce({
      label: 'Update existing blueprint',
      description: 'bp-1',
      action: 'update',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint: { id: 'bp-1', name: 'Updated' } }),
    });

    await pushConfig(api, linkMappings);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/blueprints/bp-1'),
      expect.objectContaining({ method: 'PUT' })
    );
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('bp-1 updated')
    );
  });

  it('creates new blueprint from linked file when user chooses create', async () => {
    await api.setToken('token');

    const filePath = '/workspace/AGENTS.md';
    linkMappings.set(filePath, {
      localPath: filePath,
      blueprintId: 'bp-1',
      lastChecksum: 'old',
    });

    const fileUri = Uri.file(filePath);
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    // First QuickPick: "Create new blueprint"
    window.showQuickPick
      .mockResolvedValueOnce({
        label: 'Create new blueprint',
        action: 'create',
      })
      // Second QuickPick: visibility
      .mockResolvedValueOnce({ label: 'Public', value: 'PUBLIC' });

    window.showInputBox
      .mockResolvedValueOnce('New BP')  // name
      .mockResolvedValueOnce('Desc');   // description

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint: { id: 'new-2', name: 'New BP' } }),
    });

    await pushConfig(api, linkMappings);

    expect(linkMappings.get(filePath)?.blueprintId).toBe('new-2');
  });

  it('returns early when user cancels name input', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/AGENTS.md');
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    // No link mapping, goes straight to create flow
    window.showInputBox.mockResolvedValueOnce(undefined); // cancel name

    await pushConfig(api, linkMappings);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns early when user cancels visibility pick', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/AGENTS.md');
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    window.showInputBox
      .mockResolvedValueOnce('My BP')  // name
      .mockResolvedValueOnce('');       // description
    window.showQuickPick.mockResolvedValueOnce(undefined); // cancel visibility

    await pushConfig(api, linkMappings);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns early when user cancels update/create choice', async () => {
    await api.setToken('token');

    const filePath = '/workspace/AGENTS.md';
    linkMappings.set(filePath, {
      localPath: filePath,
      blueprintId: 'bp-1',
      lastChecksum: 'old',
    });

    const fileUri = Uri.file(filePath);
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    window.showQuickPick.mockResolvedValueOnce(undefined); // cancel choice

    await pushConfig(api, linkMappings);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refreshes both trees after creating a blueprint', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/AGENTS.md');
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    window.showInputBox
      .mockResolvedValueOnce('BP')       // name
      .mockResolvedValueOnce(undefined); // no description (undefined)
    window.showQuickPick.mockResolvedValueOnce({ label: 'Private', value: 'PRIVATE' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint: { id: 'bp-new', name: 'BP' } }),
    });

    await pushConfig(api, linkMappings);

    expect(commands.executeCommand).toHaveBeenCalledWith('lynxprompt.refreshBlueprints');
    expect(commands.executeCommand).toHaveBeenCalledWith('lynxprompt.refreshLocalFiles');
  });

  it('refreshes trees after updating an existing blueprint', async () => {
    await api.setToken('token');

    const filePath = '/workspace/AGENTS.md';
    linkMappings.set(filePath, {
      localPath: filePath,
      blueprintId: 'bp-1',
      lastChecksum: 'old',
    });

    const fileUri = Uri.file(filePath);
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    window.showQuickPick.mockResolvedValueOnce({
      label: 'Update existing blueprint',
      description: 'bp-1',
      action: 'update',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint: { id: 'bp-1', name: 'Updated' } }),
    });

    await pushConfig(api, linkMappings);

    expect(commands.executeCommand).toHaveBeenCalledWith('lynxprompt.refreshBlueprints');
    expect(commands.executeCommand).toHaveBeenCalledWith('lynxprompt.refreshLocalFiles');
  });
});
