import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspace, Uri } from '../__mocks__/vscode';
import { LocalFilesTreeProvider, LocalFileTreeItem } from '../../src/views/localFilesTree';
import type { LinkMapping, LocalConfigFile } from '../../src/types';

// Mock configDetector
vi.mock('../../src/utils/configDetector', () => ({
  detectConfigFiles: vi.fn().mockResolvedValue([]),
  computeFileChecksum: vi.fn().mockResolvedValue('checksum-abc'),
}));

import { detectConfigFiles } from '../../src/utils/configDetector';
const mockDetectConfigFiles = vi.mocked(detectConfigFiles);

describe('LocalFilesTreeProvider', () => {
  let linkMappings: Map<string, LinkMapping>;
  let provider: LocalFilesTreeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    linkMappings = new Map();
    provider = new LocalFilesTreeProvider(linkMappings);
    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'autoDetectConfigFiles') return true;
        return defaultValue;
      }),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });
  });

  describe('getChildren', () => {
    it('returns empty when autoDetectConfigFiles is disabled', async () => {
      workspace.getConfiguration.mockReturnValue({
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'autoDetectConfigFiles') return false;
          return true;
        }),
        update: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
      });

      const children = await provider.getChildren();
      expect(children).toEqual([]);
    });

    it('returns detected config files', async () => {
      const mockFiles: LocalConfigFile[] = [
        {
          absolutePath: '/workspace/AGENTS.md',
          relativePath: 'AGENTS.md',
          type: 'AGENTS_MD',
          status: 'untracked',
        },
        {
          absolutePath: '/workspace/CLAUDE.md',
          relativePath: 'CLAUDE.md',
          type: 'CLAUDE_MD',
          linkedBlueprintId: 'bp-1',
          status: 'synced',
        },
      ];

      mockDetectConfigFiles.mockResolvedValueOnce(mockFiles);

      const children = await provider.getChildren();
      expect(children).toHaveLength(2);
      expect(children[0]).toBeInstanceOf(LocalFileTreeItem);
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
    it('returns the element itself', () => {
      const file: LocalConfigFile = {
        absolutePath: '/workspace/AGENTS.md',
        relativePath: 'AGENTS.md',
        type: 'AGENTS_MD',
        status: 'untracked',
      };
      const item = new LocalFileTreeItem(file);
      expect(provider.getTreeItem(item)).toBe(item);
    });
  });

  describe('linkMappings getter', () => {
    it('returns the link mappings', () => {
      expect(provider.linkMappings).toBe(linkMappings);
    });
  });
});

describe('LocalFileTreeItem', () => {
  it('sets properties from config file - untracked', () => {
    const file: LocalConfigFile = {
      absolutePath: '/workspace/AGENTS.md',
      relativePath: 'AGENTS.md',
      type: 'AGENTS_MD',
      status: 'untracked',
    };

    const item = new LocalFileTreeItem(file);

    expect(item.label).toBe('AGENTS.md');
    expect(item.description).toContain('AGENTS.md');
    expect(item.description).toContain('untracked');
    expect(item.contextValue).toBe('localConfig');
    expect(item.command?.command).toBe('vscode.open');
    expect((item.iconPath as any).id).toBe('circle-outline');
  });

  it('sets linked context value when linked', () => {
    const file: LocalConfigFile = {
      absolutePath: '/workspace/CLAUDE.md',
      relativePath: 'CLAUDE.md',
      type: 'CLAUDE_MD',
      linkedBlueprintId: 'bp-1',
      status: 'synced',
    };

    const item = new LocalFileTreeItem(file);

    expect(item.contextValue).toBe('localConfigLinked');
    expect((item.iconPath as any).id).toBe('check');
  });

  it('shows warning icon for modified status', () => {
    const file: LocalConfigFile = {
      absolutePath: '/workspace/CLAUDE.md',
      relativePath: 'CLAUDE.md',
      type: 'CLAUDE_MD',
      linkedBlueprintId: 'bp-1',
      status: 'modified',
    };

    const item = new LocalFileTreeItem(file);

    expect((item.iconPath as any).id).toBe('warning');
  });

  it('includes linked blueprint ID in tooltip', () => {
    const file: LocalConfigFile = {
      absolutePath: '/workspace/AGENTS.md',
      relativePath: 'AGENTS.md',
      type: 'AGENTS_MD',
      linkedBlueprintId: 'bp-42',
      status: 'synced',
    };

    const item = new LocalFileTreeItem(file);
    const tooltip = item.tooltip as any;
    expect(tooltip.value).toContain('bp-42');
    expect(tooltip.value).toContain('AGENTS.md');
    expect(tooltip.value).toContain('synced');
  });

  it('does not include linked blueprint ID in tooltip when not linked', () => {
    const file: LocalConfigFile = {
      absolutePath: '/workspace/AGENTS.md',
      relativePath: 'AGENTS.md',
      type: 'AGENTS_MD',
      status: 'untracked',
    };

    const item = new LocalFileTreeItem(file);
    const tooltip = item.tooltip as any;
    expect(tooltip.value).not.toContain('Linked to');
  });

  it('sets resourceUri from absolutePath', () => {
    const file: LocalConfigFile = {
      absolutePath: '/workspace/my/AGENTS.md',
      relativePath: 'my/AGENTS.md',
      type: 'AGENTS_MD',
      status: 'untracked',
    };

    const item = new LocalFileTreeItem(file);
    expect(item.resourceUri?.fsPath).toBe('/workspace/my/AGENTS.md');
  });
});
