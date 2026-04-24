import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window, commands, createMockSecretStorage, workspace } from '../__mocks__/vscode';
import { LynxPromptApi } from '../../src/api';
import { signIn } from '../../src/commands/signIn';

// Mock the auth module
vi.mock('../../src/auth', () => ({
  performDeviceAuth: vi.fn(),
}));

import { performDeviceAuth } from '../../src/auth';
const mockPerformDeviceAuth = vi.mocked(performDeviceAuth);

// Mock fetch
vi.stubGlobal('fetch', vi.fn());

describe('signIn', () => {
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

  it('prompts to sign out first when already authenticated', async () => {
    await api.setToken('existing-token');

    window.showInformationMessage.mockResolvedValueOnce('Cancel');

    await signIn(api);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('already signed in'),
      'Sign Out',
      'Cancel'
    );
    // Should not proceed to device auth
    expect(mockPerformDeviceAuth).not.toHaveBeenCalled();
  });

  it('signs out and then performs device auth when user chooses Sign Out', async () => {
    await api.setToken('existing-token');

    window.showInformationMessage.mockResolvedValueOnce('Sign Out');
    mockPerformDeviceAuth.mockResolvedValueOnce(false);

    await signIn(api);

    expect(secrets.delete).toHaveBeenCalledWith('lynxprompt.token');
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'lynxprompt.authenticated',
      false
    );
    expect(mockPerformDeviceAuth).toHaveBeenCalledWith(api);
  });

  it('performs device auth when not authenticated', async () => {
    // api has no token set, so isAuthenticated is false
    mockPerformDeviceAuth.mockResolvedValueOnce(false);

    await signIn(api);

    expect(mockPerformDeviceAuth).toHaveBeenCalledWith(api);
  });

  it('sets context and shows user info on successful auth', async () => {
    // NOT authenticated initially
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ name: 'Test User', email: 'test@test.com' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // performDeviceAuth returns true and sets token as side effect
    mockPerformDeviceAuth.mockImplementation(async (apiArg) => {
      await apiArg.setToken('valid-token');
      return true;
    });

    await signIn(api);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'lynxprompt.authenticated',
      true
    );
  });

  it('shows generic message when getUser fails after successful auth', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('API error'));
    vi.stubGlobal('fetch', mockFetch);

    mockPerformDeviceAuth.mockImplementation(async (apiArg) => {
      await apiArg.setToken('valid-token');
      return true;
    });

    await signIn(api);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      'Signed in to LynxPrompt.'
    );
  });

  it('refreshes blueprints after successful auth', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('no user'));
    vi.stubGlobal('fetch', mockFetch);

    mockPerformDeviceAuth.mockImplementation(async (apiArg) => {
      await apiArg.setToken('valid-token');
      return true;
    });

    await signIn(api);

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'lynxprompt.refreshBlueprints'
    );
  });

  it('does not set context or refresh when auth fails', async () => {
    // NOT authenticated initially
    mockPerformDeviceAuth.mockResolvedValueOnce(false);

    await signIn(api);

    // executeCommand should NOT have been called (no setContext, no refresh)
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });
});
