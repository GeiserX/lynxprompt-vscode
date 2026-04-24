import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window, env, createMockSecretStorage, workspace } from './__mocks__/vscode';
import { LynxPromptApi } from '../src/api';
import { performDeviceAuth } from '../src/auth';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('performDeviceAuth', () => {
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

  // The auth module has a `sleep(2000)` call in its polling loop.
  // We override withProgress to simulate the polling flow without actually sleeping.

  it('opens browser with auth URL on init and returns true on completed', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'sess-1',
          auth_url: 'https://lynxprompt.com/auth?session=sess-1',
          expires_at: '2025-12-31',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'completed', token: 'new-token' }),
      });

    // Override withProgress to call task but with a cancellation token that
    // lets us control the polling. The key insight: we need setTimeout/sleep to resolve.
    // So we use real timers but mock withProgress to skip the actual sleep.
    window.withProgress.mockImplementation(
      async (_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
        const progress = { report: vi.fn() };
        const cancellation = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
        // The task calls sleep() internally. We need to let it resolve.
        // By default, the real setTimeout will work fine since the poll
        // returns 'completed' on the first poll attempt.
        return task(progress, cancellation);
      }
    );

    const result = await performDeviceAuth(api);

    expect(result).toBe(true);
    expect(env.openExternal).toHaveBeenCalled();
    expect(api.token).toBe('new-token');
  }, 15000);

  it('shows error if browser fails to open but still succeeds auth', async () => {
    env.openExternal.mockResolvedValueOnce(false);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'sess-1',
          auth_url: 'https://lynxprompt.com/auth',
          expires_at: '2025-12-31',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'completed', token: 'tk' }),
      });

    window.withProgress.mockImplementation(
      async (_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
        const progress = { report: vi.fn() };
        const cancellation = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
        return task(progress, cancellation);
      }
    );

    const result = await performDeviceAuth(api);
    expect(result).toBe(true);
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to open browser')
    );
  }, 15000);

  it('returns false when session expires', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          session_id: 'sess-1',
          auth_url: 'https://lynxprompt.com/auth',
          expires_at: '2025-12-31',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'expired' }),
      });

    window.withProgress.mockImplementation(
      async (_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
        const progress = { report: vi.fn() };
        const cancellation = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
        return task(progress, cancellation);
      }
    );

    const result = await performDeviceAuth(api);
    expect(result).toBe(false);
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('expired')
    );
  }, 15000);

  it('returns false when cancelled by user', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: 'sess-1',
        auth_url: 'https://lynxprompt.com/auth',
        expires_at: '2025-12-31',
      }),
    });

    // Cancellation token already set before the task runs
    window.withProgress.mockImplementation(
      async (_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
        const progress = { report: vi.fn() };
        const cancellation = { isCancellationRequested: true, onCancellationRequested: vi.fn() };
        return task(progress, cancellation);
      }
    );

    const result = await performDeviceAuth(api);
    expect(result).toBe(false);
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('cancelled')
    );
  }, 15000);

  it('returns false and shows error on exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    window.withProgress.mockImplementation(
      async (_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
        const progress = { report: vi.fn() };
        const cancellation = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
        return task(progress, cancellation);
      }
    );

    const result = await performDeviceAuth(api);
    expect(result).toBe(false);
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Network error')
    );
  }, 15000);

  it('handles non-Error exception', async () => {
    mockFetch.mockRejectedValueOnce('string error');

    window.withProgress.mockImplementation(
      async (_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
        const progress = { report: vi.fn() };
        const cancellation = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
        return task(progress, cancellation);
      }
    );

    const result = await performDeviceAuth(api);
    expect(result).toBe(false);
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error')
    );
  }, 15000);
});
