import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSecretStorage, workspace, commands } from './__mocks__/vscode';
import * as crypto from 'crypto';
import { LynxPromptApi, ApiRequestError, createPkcePair } from '../src/api';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('LynxPromptApi', () => {
  let secrets: ReturnType<typeof createMockSecretStorage>;
  let api: LynxPromptApi;

  beforeEach(() => {
    vi.clearAllMocks();
    secrets = createMockSecretStorage();
    api = new LynxPromptApi(secrets as any);
    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'apiUrl') return 'https://lynxprompt.geiser.cloud';
        return defaultValue;
      }),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });
  });

  describe('token management', () => {
    it('starts with no token', () => {
      expect(api.token).toBeUndefined();
      expect(api.isAuthenticated).toBe(false);
    });

    it('loadToken retrieves from secret storage', async () => {
      secrets.get.mockResolvedValue('test-token');
      const result = await api.loadToken();
      expect(result).toBe('test-token');
      expect(api.token).toBe('test-token');
      expect(api.isAuthenticated).toBe(true);
    });

    it('loadToken returns undefined when no token stored', async () => {
      secrets.get.mockResolvedValue(undefined);
      const result = await api.loadToken();
      expect(result).toBeUndefined();
      expect(api.isAuthenticated).toBe(false);
    });

    it('setToken stores in secret storage', async () => {
      await api.setToken('my-token');
      expect(secrets.store).toHaveBeenCalledWith('lynxprompt.token', 'my-token');
      expect(api.token).toBe('my-token');
      expect(api.isAuthenticated).toBe(true);
    });

    it('clearToken removes token', async () => {
      await api.setToken('my-token');
      await api.clearToken();
      expect(secrets.delete).toHaveBeenCalledWith('lynxprompt.token');
      expect(api.token).toBeUndefined();
      expect(api.isAuthenticated).toBe(false);
    });

    it('isAuthenticated is false for empty string token', async () => {
      await api.setToken('');
      expect(api.isAuthenticated).toBe(false);
    });
  });

  describe('request method', () => {
    beforeEach(async () => {
      await api.setToken('test-token');
    });

    it('adds authorization header for authenticated requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      });

      await api.getUser();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/user',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
            'User-Agent': 'lynxprompt-vscode/0.1.0',
          }),
        })
      );
    });

    it('throws when not authenticated for authenticated endpoints', async () => {
      await api.clearToken();
      await expect(api.getUser()).rejects.toThrow('Not authenticated');
    });

    it('handles 401 by clearing token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Token expired' }),
      });

      await expect(api.getUser()).rejects.toThrow('Authentication expired');
      expect(api.token).toBeUndefined();
      expect(commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'lynxprompt.authenticated',
        false
      );
    });

    it('handles API error with error body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Something went wrong' }),
      });

      await expect(api.getUser()).rejects.toThrow('API error (500): Something went wrong');
    });

    it('handles API error with details field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: '', details: 'Detailed error info' }),
      });

      await expect(api.getUser()).rejects.toThrow('API error (400): Detailed error info');
    });

    it('handles API error when json parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => { throw new Error('not json'); },
      });

      await expect(api.getUser()).rejects.toThrow('API error (503): Service Unavailable');
    });

    it('handles 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await api.deleteBlueprint('test-id');
      expect(result).toBeUndefined();
    });

    it('strips trailing slashes from base URL', async () => {
      workspace.getConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue('https://lynxprompt.geiser.cloud///'),
        update: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: '1' }),
      });

      await api.getUser();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/user',
        expect.any(Object)
      );
    });

    it.each(['https://lynxprompt.com', 'https://lynxprompt.com/'])(
      'sends a saved legacy official URL (%s) to the new host',
      async (saved) => {
        workspace.getConfiguration.mockReturnValue({
          get: vi.fn().mockReturnValue(saved),
          update: vi.fn(),
          has: vi.fn(),
          inspect: vi.fn(),
        });
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: '1' }) });

        await api.getUser();
        expect(mockFetch).toHaveBeenCalledWith(
          'https://lynxprompt.geiser.cloud/api/v1/user',
          expect.any(Object)
        );
      }
    );

    it('keeps a custom self-hosted URL', async () => {
      workspace.getConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue('https://lp.example.com/'),
        update: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
      });
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: '1' }) });

      await api.getUser();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lp.example.com/api/v1/user',
        expect.any(Object)
      );
    });
  });

  describe('auth endpoints', () => {
    it('initDeviceAuth sends POST without auth', async () => {
      const mockResponse = { session_id: 'sess-123', auth_url: 'https://example.com/auth', expires_at: '2025-01-01' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.initDeviceAuth('challenge-abc');
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/cli-auth/init',
        expect.objectContaining({
          method: 'POST',
          headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
        })
      );
    });

    it('pollDeviceAuth sends GET without auth', async () => {
      const mockResponse = { status: 'completed', token: 'new-token' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.pollDeviceAuth('sess-123', 'verifier-xyz');
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/cli-auth/poll?session=sess-123',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('pollDeviceAuth encodes session ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'pending' }),
      });

      await api.pollDeviceAuth('sess with spaces', 'verifier-xyz');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/cli-auth/poll?session=sess%20with%20spaces',
        expect.any(Object)
      );
    });
  });

  describe('sign-in with PKCE', () => {
    it('initDeviceAuth sends the code challenge, so the server keeps accepting the login after 2027-01-01', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      await api.initDeviceAuth('challenge-abc');

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ code_challenge: 'challenge-abc' });
    });

    it('pollDeviceAuth sends the verifier, so the session id alone cannot collect the token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'pending' }) });

      await api.pollDeviceAuth('sess-1', 'verifier-xyz');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['X-CLI-Verifier']).toBe('verifier-xyz');
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('createPkcePair returns a base64url SHA-256 challenge of a fresh verifier', () => {
      const a = createPkcePair();
      const b = createPkcePair();
      expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(a.challenge).toBe(crypto.createHash('sha256').update(a.verifier).digest('base64url'));
      expect(a.verifier).not.toBe(b.verifier);
    });
  });

  describe('revokeToken', () => {
    it('POSTs the stored token to /api/cli-auth/revoke', async () => {
      await api.setToken('tok-1');
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });

      await api.revokeToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/cli-auth/revoke',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
        })
      );
    });

    it('never throws, even when the server is unreachable', async () => {
      await api.setToken('tok-1');
      mockFetch.mockRejectedValueOnce(new Error('offline'));

      await expect(api.revokeToken()).resolves.toBeUndefined();
    });

    it('does nothing without a token', async () => {
      await api.revokeToken();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getUser', () => {
    it('unwraps the { user } object /api/v1/user returns', async () => {
      await api.setToken('tok-1');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: { id: 'u1', name: 'Ada', email: 'ada@example.com', image: null } }),
      });

      const user = await api.getUser();

      expect(user.name).toBe('Ada');
      expect(user.email).toBe('ada@example.com');
    });
  });

  describe('listAllBlueprints', () => {
    it('pages with limit=100 until has_more is false', async () => {
      await api.setToken('tok-1');
      const page = (ids: string[], has_more: boolean) => ({
        ok: true,
        status: 200,
        json: async () => ({ blueprints: ids.map((id) => ({ id })), total: 150, limit: 100, offset: 0, has_more }),
      });
      mockFetch
        .mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, i) => `a${i}`), true))
        .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, i) => `b${i}`), false));

      const all = await api.listAllBlueprints();

      expect(all).toHaveLength(150);
      expect(mockFetch.mock.calls[0][0]).toBe('https://lynxprompt.geiser.cloud/api/v1/blueprints?limit=100&offset=0');
      expect(mockFetch.mock.calls[1][0]).toBe('https://lynxprompt.geiser.cloud/api/v1/blueprints?limit=100&offset=100');
    });
  });

  describe('errors', () => {
    it('carry the HTTP status', async () => {
      await api.setToken('tok-1');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({ error: 'Conflict - blueprint has been modified' }),
      });

      const error = await api.updateBlueprint('1', { content: 'x', expected_checksum: 'old' }).catch((e) => e);

      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error.status).toBe(409);
    });
  });

  describe('blueprint endpoints', () => {
    beforeEach(async () => {
      await api.setToken('test-token');
    });

    it('listBlueprints with default params', async () => {
      const mockResponse = { blueprints: [], total: 0, limit: 100, offset: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.listBlueprints();
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/blueprints?limit=100&offset=0',
        expect.any(Object)
      );
    });

    it('listBlueprints with visibility filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ blueprints: [], total: 0, limit: 50, offset: 10 }),
      });

      await api.listBlueprints(50, 10, 'PUBLIC');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/blueprints?limit=50&offset=10&visibility=PUBLIC',
        expect.any(Object)
      );
    });

    it('getBlueprint returns blueprint from response wrapper', async () => {
      const bp = { id: '1', name: 'Test', content: '# Test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ blueprint: bp }),
      });

      const result = await api.getBlueprint('1');
      expect(result).toEqual(bp);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/blueprints/1',
        expect.any(Object)
      );
    });

    it('getBlueprint encodes ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ blueprint: { id: 'a/b' } }),
      });

      await api.getBlueprint('a/b');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/blueprints/a%2Fb',
        expect.any(Object)
      );
    });

    it('createBlueprint sends POST with body', async () => {
      const bp = { id: 'new-1', name: 'New BP' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ blueprint: bp }),
      });

      const result = await api.createBlueprint({
        name: 'New BP',
        type: 'AGENTS_MD',
        content: '# Test',
      });

      expect(result).toEqual(bp);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/blueprints',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New BP', type: 'AGENTS_MD', content: '# Test' }),
        })
      );
    });

    it('updateBlueprint sends PUT with body', async () => {
      const bp = { id: '1', name: 'Updated' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ blueprint: bp }),
      });

      const result = await api.updateBlueprint('1', { name: 'Updated' });
      expect(result).toEqual(bp);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/blueprints/1',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('deleteBlueprint sends DELETE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await api.deleteBlueprint('1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynxprompt.geiser.cloud/api/v1/blueprints/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
