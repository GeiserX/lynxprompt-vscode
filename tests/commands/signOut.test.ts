import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window, commands, createMockSecretStorage, workspace } from '../__mocks__/vscode';
import { LynxPromptApi } from '../../src/api';
import { signOut } from '../../src/commands/signOut';

// Mock fetch
vi.stubGlobal('fetch', vi.fn());

describe('signOut', () => {
  let secrets: ReturnType<typeof createMockSecretStorage>;
  let api: LynxPromptApi;

  beforeEach(() => {
    vi.clearAllMocks();
    secrets = createMockSecretStorage();
    api = new LynxPromptApi(secrets as any);
    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue('https://lynxprompt.com'),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });
  });

  it('shows message when not authenticated', async () => {
    await signOut(api);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      'You are not signed in to LynxPrompt.'
    );
    expect(secrets.delete).not.toHaveBeenCalled();
  });

  it('does nothing when user cancels confirmation', async () => {
    await api.setToken('token');

    window.showWarningMessage.mockResolvedValueOnce(undefined);

    await signOut(api);

    expect(secrets.delete).not.toHaveBeenCalled();
  });

  it('clears token and updates context on confirm', async () => {
    await api.setToken('token');

    window.showWarningMessage.mockResolvedValueOnce('Sign Out');

    await signOut(api);

    expect(secrets.delete).toHaveBeenCalledWith('lynxprompt.token');
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'lynxprompt.authenticated',
      false
    );
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      'Signed out of LynxPrompt.'
    );
  });

  it('refreshes blueprints after signing out', async () => {
    await api.setToken('token');

    window.showWarningMessage.mockResolvedValueOnce('Sign Out');

    await signOut(api);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'lynxprompt.refreshBlueprints'
    );
  });

  it('shows modal confirmation dialog', async () => {
    await api.setToken('token');

    window.showWarningMessage.mockResolvedValueOnce(undefined);

    await signOut(api);

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      'Sign out of LynxPrompt?',
      { modal: true },
      'Sign Out'
    );
  });
});
