import { describe, it, expect } from 'vitest';
import { blueprintTypeToPath, pathToBlueprintType, blueprintTypeLabel } from '../../src/utils/fileMapping';

describe('pathToBlueprintType', () => {
  it('detects AGENTS.md', () => {
    expect(pathToBlueprintType('/workspace/AGENTS.md')).toBe('AGENTS_MD');
  });

  it('detects CLAUDE.md', () => {
    expect(pathToBlueprintType('/workspace/CLAUDE.md')).toBe('CLAUDE_MD');
  });

  it('detects .cursor/rules/*.mdc', () => {
    expect(pathToBlueprintType('/workspace/.cursor/rules/my-rule.mdc')).toBe('CURSOR_RULES');
  });

  it('detects .cursor/rules/*.md', () => {
    expect(pathToBlueprintType('/workspace/.cursor/rules/rule.md')).toBe('CURSOR_RULES');
  });

  it('detects copilot-instructions.md', () => {
    expect(pathToBlueprintType('/workspace/.github/copilot-instructions.md')).toBe('COPILOT_INSTRUCTIONS');
  });

  it('detects copilot-instructions.md at root', () => {
    expect(pathToBlueprintType('/workspace/copilot-instructions.md')).toBe('COPILOT_INSTRUCTIONS');
  });

  it('detects .windsurfrules', () => {
    expect(pathToBlueprintType('/workspace/.windsurfrules')).toBe('WINDSURF_RULES');
  });

  it('detects .clinerules', () => {
    expect(pathToBlueprintType('/workspace/.clinerules')).toBe('CLINE_RULES');
  });

  it('detects .aider.conf.yml', () => {
    expect(pathToBlueprintType('/workspace/.aider.conf.yml')).toBe('AIDER_RULES');
  });

  it('detects .continue/config.json', () => {
    expect(pathToBlueprintType('/workspace/.continue/config.json')).toBe('CONTINUE_RULES');
  });

  it('detects CODEX.md', () => {
    expect(pathToBlueprintType('/workspace/CODEX.md')).toBe('CODEX_RULES');
  });

  it('returns undefined for unknown files', () => {
    expect(pathToBlueprintType('/workspace/README.md')).toBeUndefined();
  });

  it('returns undefined for config.json not in .continue', () => {
    expect(pathToBlueprintType('/workspace/config.json')).toBeUndefined();
  });

  it('handles backslash paths (Windows)', () => {
    expect(pathToBlueprintType('C:\\workspace\\.cursor\\rules\\rule.mdc')).toBe('CURSOR_RULES');
  });
});

describe('blueprintTypeToPath', () => {
  it('maps AGENTS_MD to AGENTS.md', () => {
    expect(blueprintTypeToPath('AGENTS_MD')).toBe('AGENTS.md');
  });

  it('maps CLAUDE_MD to CLAUDE.md', () => {
    expect(blueprintTypeToPath('CLAUDE_MD')).toBe('CLAUDE.md');
  });

  it('maps CURSOR_RULES with name', () => {
    expect(blueprintTypeToPath('CURSOR_RULES', 'my rule')).toBe('.cursor/rules/my_rule.mdc');
  });

  it('maps CURSOR_RULES without name', () => {
    expect(blueprintTypeToPath('CURSOR_RULES')).toBe('.cursor/rules/default.mdc');
  });

  it('maps COPILOT_INSTRUCTIONS', () => {
    expect(blueprintTypeToPath('COPILOT_INSTRUCTIONS')).toBe('.github/copilot-instructions.md');
  });

  it('maps WINDSURF_RULES', () => {
    expect(blueprintTypeToPath('WINDSURF_RULES')).toBe('.windsurfrules');
  });

  it('maps CLINE_RULES', () => {
    expect(blueprintTypeToPath('CLINE_RULES')).toBe('.clinerules');
  });

  it('maps AIDER_RULES', () => {
    expect(blueprintTypeToPath('AIDER_RULES')).toBe('.aider.conf.yml');
  });

  it('maps CONTINUE_RULES', () => {
    expect(blueprintTypeToPath('CONTINUE_RULES')).toBe('.continue/config.json');
  });

  it('maps CODEX_RULES', () => {
    expect(blueprintTypeToPath('CODEX_RULES')).toBe('CODEX.md');
  });

  it('maps CUSTOM with name', () => {
    expect(blueprintTypeToPath('CUSTOM', 'my config')).toBe('my_config');
  });

  it('maps CUSTOM without name', () => {
    expect(blueprintTypeToPath('CUSTOM')).toBe('ai-config.md');
  });
});

describe('blueprintTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(blueprintTypeLabel('AGENTS_MD')).toBe('AGENTS.md');
    expect(blueprintTypeLabel('CLAUDE_MD')).toBe('CLAUDE.md');
    expect(blueprintTypeLabel('CURSOR_RULES')).toBe('Cursor Rules');
    expect(blueprintTypeLabel('COPILOT_INSTRUCTIONS')).toBe('Copilot Instructions');
    expect(blueprintTypeLabel('WINDSURF_RULES')).toBe('Windsurf Rules');
    expect(blueprintTypeLabel('CLINE_RULES')).toBe('Cline Rules');
    expect(blueprintTypeLabel('AIDER_RULES')).toBe('Aider Rules');
    expect(blueprintTypeLabel('CONTINUE_RULES')).toBe('Continue Rules');
    expect(blueprintTypeLabel('CODEX_RULES')).toBe('Codex Rules');
    expect(blueprintTypeLabel('CUSTOM')).toBe('Custom');
  });

  it('returns raw type for unknown type', () => {
    expect(blueprintTypeLabel('UNKNOWN' as any)).toBe('UNKNOWN');
  });
});
