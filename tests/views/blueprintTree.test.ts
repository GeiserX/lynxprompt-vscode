import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSecretStorage, workspace, window } from '../__mocks__/vscode';
import { LynxPromptApi } from '../../src/api';
import { BlueprintTreeProvider, BlueprintTreeItem } from '../../src/views/blueprintTree';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('BlueprintTreeProvider', () => {
  let secrets: ReturnType<typeof createMockSecretStorage>;
  let api: LynxPromptApi;
  let provider: BlueprintTreeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    secrets = createMockSecretStorage();
    api = new LynxPromptApi(secrets as any);
    provider = new BlueprintTreeProvider(api);
    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue('https://lynxprompt.com'),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });
  });

  describe('getChildren (root)', () => {
    it('returns empty when not authenticated', async () => {
      const children = await provider.getChildren();
      expect(children).toEqual([]);
    });

    it('returns type groups when authenticated', async () => {
      await api.setToken('token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [
            { id: '1', name: 'A', type: 'AGENTS_MD', tier: 'SHORT', visibility: 'PRIVATE', tags: [], downloads: 0, favorites: 0, content_checksum: 'a' },
            { id: '2', name: 'B', type: 'AGENTS_MD', tier: 'SHORT', visibility: 'PUBLIC', tags: [], downloads: 5, favorites: 2, content_checksum: 'b' },
            { id: '3', name: 'C', type: 'CLAUDE_MD', tier: 'LONG', visibility: 'TEAM', tags: ['x'], downloads: 1, favorites: 0, content_checksum: 'c' },
          ],
          total: 3,
          limit: 200,
          offset: 0,
        }),
      });

      const children = await provider.getChildren();
      expect(children).toHaveLength(2); // AGENTS_MD group and CLAUDE_MD group

      // Groups should be sorted alphabetically by label
      const labels = children.map((c) => (c as any).label);
      expect(labels[0]).toContain('AGENTS.md');
      expect(labels[1]).toContain('CLAUDE.md');
    });

    it('handles API error gracefully', async () => {
      await api.setToken('token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const children = await provider.getChildren();
      expect(children).toEqual([]);
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load blueprints')
      );
    });
  });

  describe('getChildren (group)', () => {
    it('returns blueprint items for a type group', async () => {
      await api.setToken('token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [
            { id: '1', name: 'A', type: 'AGENTS_MD', tier: 'SHORT', visibility: 'PRIVATE', tags: [], downloads: 0, favorites: 0, content_checksum: 'a' },
            { id: '2', name: 'B', type: 'CLAUDE_MD', tier: 'SHORT', visibility: 'PUBLIC', tags: [], downloads: 0, favorites: 0, content_checksum: 'b' },
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      });

      // Fetch root groups first
      const groups = await provider.getChildren();
      expect(groups.length).toBeGreaterThan(0);

      // Get children of first group
      const agentsGroup = groups.find((g) => (g as any).label?.includes('AGENTS'));
      const items = await provider.getChildren(agentsGroup);
      expect(items).toHaveLength(1);
      expect((items[0] as BlueprintTreeItem).blueprint.name).toBe('A');
    });

    it('returns empty for non-group elements', async () => {
      await api.setToken('token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [
            { id: '1', name: 'A', type: 'AGENTS_MD', tier: 'SHORT', visibility: 'PRIVATE', tags: [], downloads: 0, favorites: 0, content_checksum: 'a' },
          ],
          total: 1, limit: 200, offset: 0,
        }),
      });

      const groups = await provider.getChildren();
      const items = await provider.getChildren(groups[0]);
      // Getting children of a leaf BlueprintTreeItem
      const leafChildren = await provider.getChildren(items[0]);
      expect(leafChildren).toEqual([]);
    });
  });

  describe('refresh', () => {
    it('fires onDidChangeTreeData event', () => {
      const listener = vi.fn();
      provider.onDidChangeTreeData(listener);

      provider.refresh();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getTreeItem', () => {
    it('returns the element itself', async () => {
      await api.setToken('token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          blueprints: [
            { id: '1', name: 'A', type: 'AGENTS_MD', tier: 'SHORT', visibility: 'PRIVATE', tags: [], downloads: 0, favorites: 0, content_checksum: 'a' },
          ],
          total: 1, limit: 200, offset: 0,
        }),
      });

      const groups = await provider.getChildren();
      const result = provider.getTreeItem(groups[0]);
      expect(result).toBe(groups[0]);
    });
  });
});

describe('BlueprintTreeItem', () => {
  it('sets properties from blueprint data', () => {
    const bp = {
      id: '1',
      name: 'Test Blueprint',
      description: 'A test',
      type: 'AGENTS_MD' as const,
      tier: 'SHORT' as const,
      visibility: 'PRIVATE' as const,
      tags: ['test', 'demo'],
      downloads: 42,
      favorites: 7,
      content_checksum: 'abc',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    };

    const item = new BlueprintTreeItem(bp);

    expect(item.label).toBe('Test Blueprint');
    expect(item.description).toBe('private');
    expect(item.contextValue).toBe('blueprint');
    expect(item.command?.command).toBe('lynxprompt.pullBlueprint');
  });

  it('shows lock icon for private blueprints', () => {
    const bp = {
      id: '1', name: 'Test', description: null, type: 'AGENTS_MD' as const,
      tier: 'SHORT' as const, visibility: 'PRIVATE' as const, tags: [],
      downloads: 0, favorites: 0, content_checksum: 'a',
      created_at: '', updated_at: '',
    };

    const item = new BlueprintTreeItem(bp);
    expect((item.iconPath as any).id).toBe('lock');
  });

  it('shows globe icon for public blueprints', () => {
    const bp = {
      id: '1', name: 'Test', description: null, type: 'AGENTS_MD' as const,
      tier: 'SHORT' as const, visibility: 'PUBLIC' as const, tags: [],
      downloads: 0, favorites: 0, content_checksum: 'a',
      created_at: '', updated_at: '',
    };

    const item = new BlueprintTreeItem(bp);
    expect((item.iconPath as any).id).toBe('globe');
  });

  it('shows organization icon for team blueprints', () => {
    const bp = {
      id: '1', name: 'Test', description: null, type: 'AGENTS_MD' as const,
      tier: 'SHORT' as const, visibility: 'TEAM' as const, tags: [],
      downloads: 0, favorites: 0, content_checksum: 'a',
      created_at: '', updated_at: '',
    };

    const item = new BlueprintTreeItem(bp);
    expect((item.iconPath as any).id).toBe('organization');
  });

  it('includes tags in tooltip when present', () => {
    const bp = {
      id: '1', name: 'Test', description: 'Desc', type: 'AGENTS_MD' as const,
      tier: 'SHORT' as const, visibility: 'PRIVATE' as const, tags: ['tag1', 'tag2'],
      downloads: 10, favorites: 3, content_checksum: 'a',
      created_at: '', updated_at: '',
    };

    const item = new BlueprintTreeItem(bp);
    const tooltip = item.tooltip as any;
    expect(tooltip.value).toContain('tag1, tag2');
    expect(tooltip.value).toContain('Desc');
    expect(tooltip.value).toContain('Downloads');
  });
});
