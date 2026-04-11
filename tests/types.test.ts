import { describe, it, expect } from 'vitest';
import type {
  Blueprint,
  BlueprintListItem,
  BlueprintType,
  BlueprintTier,
  BlueprintVisibility,
  BlueprintListResponse,
  CreateBlueprintRequest,
  UpdateBlueprintRequest,
  UserInfo,
  DeviceAuthInitResponse,
  DeviceAuthPollResponse,
  LocalConfigFile,
  LinkMapping,
} from '../src/types';

describe('Type definitions', () => {
  it('BlueprintType covers all known types', () => {
    const types: BlueprintType[] = [
      'AGENTS_MD',
      'CLAUDE_MD',
      'CURSOR_RULES',
      'COPILOT_INSTRUCTIONS',
      'WINDSURF_RULES',
      'CLINE_RULES',
      'AIDER_RULES',
      'CONTINUE_RULES',
      'CODEX_RULES',
      'CUSTOM',
    ];
    expect(types).toHaveLength(10);
  });

  it('BlueprintTier values', () => {
    const tiers: BlueprintTier[] = ['SHORT', 'INTERMEDIATE', 'LONG', 'SUPERLONG'];
    expect(tiers).toHaveLength(4);
  });

  it('BlueprintVisibility values', () => {
    const vis: BlueprintVisibility[] = ['PRIVATE', 'TEAM', 'PUBLIC'];
    expect(vis).toHaveLength(3);
  });

  it('Blueprint interface is structurally valid', () => {
    const bp: Blueprint = {
      id: '1',
      name: 'Test',
      description: null,
      type: 'AGENTS_MD',
      tier: 'SHORT',
      category: null,
      tags: ['test'],
      visibility: 'PRIVATE',
      downloads: 0,
      favorites: 0,
      content: '# Test',
      content_checksum: 'abc',
      repository_path: null,
      hierarchy_id: null,
      parent_id: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };
    expect(bp.id).toBe('1');
    expect(bp.type).toBe('AGENTS_MD');
  });

  it('BlueprintListResponse is structurally valid', () => {
    const response: BlueprintListResponse = {
      blueprints: [],
      total: 0,
      limit: 100,
      offset: 0,
    };
    expect(response.blueprints).toEqual([]);
  });

  it('DeviceAuthPollResponse status values', () => {
    const pending: DeviceAuthPollResponse = { status: 'pending' };
    const completed: DeviceAuthPollResponse = { status: 'completed', token: 'abc' };
    const expired: DeviceAuthPollResponse = { status: 'expired' };
    expect(pending.status).toBe('pending');
    expect(completed.token).toBe('abc');
    expect(expired.status).toBe('expired');
  });

  it('LocalConfigFile status values', () => {
    const statuses: LocalConfigFile['status'][] = ['synced', 'modified', 'untracked'];
    expect(statuses).toHaveLength(3);
  });

  it('LinkMapping is structurally valid', () => {
    const mapping: LinkMapping = {
      localPath: '/path/to/file',
      blueprintId: '123',
      lastChecksum: 'abc123',
    };
    expect(mapping.blueprintId).toBe('123');
  });
});
