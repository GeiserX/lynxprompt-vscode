import { describe, it, expect } from 'vitest';

// Test the pure conversion logic extracted from generate.ts
// These functions are private in the module, so we test the logic patterns directly.

describe('stripFormatHeaders', () => {
  function stripFormatHeaders(content: string): string {
    let result = content;
    result = result.replace(/^---\n[\s\S]*?\n---\n?/, '');
    result = result.replace(
      /^#\s+(AGENTS\.md|CLAUDE\.md|Copilot Instructions|Codex Rules)[^\n]*\n*/i,
      ''
    );
    return result.trim();
  }

  it('strips MDC frontmatter', () => {
    const input = '---\ndescription: test\nglobs:\nalwaysApply: true\n---\n\nActual content';
    expect(stripFormatHeaders(input)).toBe('Actual content');
  });

  it('strips AGENTS.md header', () => {
    const input = '# AGENTS.md\n\nContent here';
    expect(stripFormatHeaders(input)).toBe('Content here');
  });

  it('strips CLAUDE.md header', () => {
    const input = '# CLAUDE.md\n\nContent here';
    expect(stripFormatHeaders(input)).toBe('Content here');
  });

  it('strips Copilot Instructions header', () => {
    const input = '# Copilot Instructions\n\nContent here';
    expect(stripFormatHeaders(input)).toBe('Content here');
  });

  it('preserves content without known headers', () => {
    const input = '# My Custom Rules\n\nContent here';
    expect(stripFormatHeaders(input)).toBe('# My Custom Rules\n\nContent here');
  });

  it('handles empty content', () => {
    expect(stripFormatHeaders('')).toBe('');
  });
});

describe('format wrapping', () => {
  function wrapCursorRules(content: string): string {
    return `---\ndescription: Project rules\nglobs:\nalwaysApply: true\n---\n\n${content}\n`;
  }

  function wrapClaudeMd(content: string): string {
    return `# CLAUDE.md\n\n${content}\n`;
  }

  function wrapAgentsMd(content: string): string {
    return `# AGENTS.md\n\n${content}\n`;
  }

  function wrapCopilotInstructions(content: string): string {
    return `# Copilot Instructions\n\n${content}\n`;
  }

  function wrapCodexMd(content: string): string {
    return `# CODEX.md\n\n${content}\n`;
  }

  it('wraps cursor rules with frontmatter', () => {
    const result = wrapCursorRules('My rules');
    expect(result).toContain('---');
    expect(result).toContain('alwaysApply: true');
    expect(result).toContain('My rules');
  });

  it('wraps CLAUDE.md with header', () => {
    const result = wrapClaudeMd('My config');
    expect(result).toBe('# CLAUDE.md\n\nMy config\n');
  });

  it('wraps AGENTS.md with header', () => {
    const result = wrapAgentsMd('My config');
    expect(result).toBe('# AGENTS.md\n\nMy config\n');
  });

  it('wraps copilot instructions with header', () => {
    const result = wrapCopilotInstructions('My config');
    expect(result).toBe('# Copilot Instructions\n\nMy config\n');
  });

  it('wraps CODEX.md with header', () => {
    const result = wrapCodexMd('My config');
    expect(result).toBe('# CODEX.md\n\nMy config\n');
  });
});
