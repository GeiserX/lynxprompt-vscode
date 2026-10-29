import { describe, it, expect } from 'vitest';
import { blueprintTypeToPath, pathToBlueprintType, blueprintTypeLabel, resolveInside } from '../../src/utils/fileMapping';

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

  it('never picks up .aider.conf.yml, which can hold API keys', () => {
    expect(pathToBlueprintType('/workspace/.aider.conf.yml')).toBeUndefined();
  });

  it('never picks up .continue/config.json, which can hold API keys', () => {
    expect(pathToBlueprintType('/workspace/.continue/config.json')).toBeUndefined();
  });

  it('detects CODEX.md as the server type CODEX_MD', () => {
    expect(pathToBlueprintType('/workspace/CODEX.md')).toBe('CODEX_MD');
  });

  it('detects every rules file pull writes from the shared table', () => {
    expect(pathToBlueprintType('/workspace/GEMINI.md')).toBe('GEMINI_MD');
    expect(pathToBlueprintType('/workspace/.devin/rules/project.md')).toBe('WINDSURF_RULES');
    expect(pathToBlueprintType('/workspace/.clinerules/project.md')).toBe('CLINE_RULES');
    expect(pathToBlueprintType('/workspace/.kiro/steering/project.md')).toBe('KIRO_STEERING');
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
  // The file LynxPrompt's shared platform table gives each type, as `lynxp pull` writes it
  it.each([
    ['AGENTS_MD', 'AGENTS.md'],
    ['CLAUDE_MD', 'CLAUDE.md'],
    ['CODEX_MD', 'AGENTS.md'],
    ['GEMINI_MD', 'GEMINI.md'],
    ['AIDER_MD', 'AGENTS.md'],
    ['CURSOR_RULES', '.cursor/rules/project.mdc'],
    ['CURSOR_MDC', '.cursor/rules/project.mdc'],
    ['COPILOT_INSTRUCTIONS', '.github/copilot-instructions.md'],
    ['WINDSURF_RULES', '.devin/rules/project.md'],
    ['CLINE_RULES', '.clinerules/project.md'],
    ['KIRO_STEERING', '.kiro/steering/project.md'],
    ['MCP_CONFIG', '.mcp.json'],
  ])('maps %s to %s', (type, file) => {
    expect(blueprintTypeToPath(type, 'Team Gemini rules')).toBe(file);
  });

  it('maps a command type into its folder, one file per command', () => {
    expect(blueprintTypeToPath('CLAUDE_COMMAND', 'Deploy Now')).toBe('.claude/commands/deploy-now.md');
    expect(blueprintTypeToPath('COPILOT_PROMPT', 'Review')).toBe('.github/prompts/review.prompt.md');
  });

  it('maps a skill to its SKILL.md, named by the frontmatter name first', () => {
    expect(blueprintTypeToPath('AGENT_SKILL', 'My Skill')).toBe('.claude/skills/my-skill/SKILL.md');
    expect(blueprintTypeToPath('AGENT_SKILL', 'My Skill', '---\nname: pdf-tools\n---\nbody')).toBe(
      '.claude/skills/pdf-tools/SKILL.md'
    );
  });

  it('maps a subagent to its file under .claude/agents', () => {
    expect(blueprintTypeToPath('AGENT_DEFINITION', 'Code Reviewer')).toBe('.claude/agents/code-reviewer.md');
  });

  it('never writes a file named after the blueprint: CUSTOM and unknown types go to ai-config.md', () => {
    expect(blueprintTypeToPath('CUSTOM', 'my config')).toBe('ai-config.md');
    expect(blueprintTypeToPath('CUSTOM')).toBe('ai-config.md');
    expect(blueprintTypeToPath('SOMETHING_NEW', 'Team Gemini rules')).toBe('ai-config.md');
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
    expect(blueprintTypeLabel('CODEX_MD')).toBe('Codex');
    expect(blueprintTypeLabel('CUSTOM')).toBe('Custom');
  });

  it('returns raw type for unknown type', () => {
    expect(blueprintTypeLabel('UNKNOWN' as any)).toBe('UNKNOWN');
  });
});

describe('resolveInside', () => {
  it('resolves a relative path under the root', () => {
    expect(resolveInside('/workspace', 'packages/api/AGENTS.md')).toBe('/workspace/packages/api/AGENTS.md');
  });

  it('rejects paths that escape the root', () => {
    expect(resolveInside('/workspace', '../outside.md')).toBeUndefined();
    expect(resolveInside('/workspace', 'a/../../outside.md')).toBeUndefined();
    expect(resolveInside('/workspace', '/etc/passwd')).toBeUndefined();
    expect(resolveInside('/workspace', '')).toBeUndefined();
  });
});
