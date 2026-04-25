import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window, workspace, commands, Uri, createMockSecretStorage, resetAllMocks } from '../__mocks__/vscode';
import { LynxPromptApi } from '../../src/api';
import { pushConfig } from '../../src/commands/push';
import { LocalFileTreeItem } from '../../src/views/localFilesTree';
import type { LinkMapping, LocalConfigFile } from '../../src/types';

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

  it('handles LocalFileTreeItem item directly', async () => {
    await api.setToken('token');

    const configFile: LocalConfigFile = {
      absolutePath: '/workspace/AGENTS.md',
      relativePath: 'AGENTS.md',
      type: 'AGENTS_MD',
      status: 'untracked',
    };
    const treeItem = new LocalFileTreeItem(configFile);

    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# From Tree Item'));

    // Create new blueprint flow
    window.showInputBox
      .mockResolvedValueOnce('Tree BP')
      .mockResolvedValueOnce('Description');
    window.showQuickPick.mockResolvedValueOnce({ label: 'Private', value: 'PRIVATE' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint: { id: 'bp-tree', name: 'Tree BP' } }),
    });

    await pushConfig(api, linkMappings, treeItem as any);

    expect(workspace.fs.readFile).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalled();
    expect(linkMappings.get('/workspace/AGENTS.md')?.blueprintId).toBe('bp-tree');
  });

  it('handles vscode.Uri item directly', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/CLAUDE.md');
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# URI Content'));

    window.showInputBox
      .mockResolvedValueOnce('URI BP')
      .mockResolvedValueOnce('');
    window.showQuickPick.mockResolvedValueOnce({ label: 'Public', value: 'PUBLIC' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint: { id: 'bp-uri', name: 'URI BP' } }),
    });

    await pushConfig(api, linkMappings, fileUri as any);

    expect(workspace.fs.readFile).toHaveBeenCalled();
    expect(linkMappings.get('/workspace/CLAUDE.md')?.blueprintId).toBe('bp-uri');
  });

  it('selects type via QuickPick for unrecognized file and creates blueprint', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/custom-file.txt');
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Custom Content'));

    // First QuickPick: type selection
    window.showQuickPick.mockResolvedValueOnce({ label: 'Custom', type: 'CUSTOM' });

    // Create new blueprint flow
    window.showInputBox
      .mockResolvedValueOnce('Custom BP')
      .mockResolvedValueOnce('Custom desc');
    // Second QuickPick: visibility
    window.showQuickPick.mockResolvedValueOnce({ label: 'Team', value: 'TEAM' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blueprint: { id: 'bp-custom', name: 'Custom BP' } }),
    });

    await pushConfig(api, linkMappings);

    expect(mockFetch).toHaveBeenCalled();
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Custom BP')
    );
  });

  it('returns early when empty file dialog result array', async () => {
    await api.setToken('token');
    window.showOpenDialog.mockResolvedValueOnce([]);

    await pushConfig(api, linkMappings);

    expect(workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('validates blueprint name is not empty', async () => {
    await api.setToken('token');

    const fileUri = Uri.file('/workspace/AGENTS.md');
    window.showOpenDialog.mockResolvedValueOnce([fileUri]);
    workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('# Content'));

    // Capture the validateInput callback
    let validateInput: ((val: string) => string | null) | undefined;
    window.showInputBox.mockImplementation(async (opts: any) => {
      if (opts?.validateInput) {
        validateInput = opts.validateInput;
      }
      return undefined; // cancel
    });

    await pushConfig(api, linkMappings);

    // validateInput should have been captured from the name input
    expect(validateInput).toBeDefined();
    expect(validateInput!('')).toBe('Name is required');
    expect(validateInput!('   ')).toBe('Name is required');
    expect(validateInput!('Valid Name')).toBeNull();
  });
});
