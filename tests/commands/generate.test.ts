import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window, workspace, env, resetAllMocks } from '../__mocks__/vscode';
import { generateConfig, convertFormat } from '../../src/commands/generate';

describe('generateConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllMocks();
    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'apiUrl') return 'https://lynxprompt.com';
        return defaultValue;
      }),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });
  });

  it('opens wizard URL in browser', async () => {
    await generateConfig();

    expect(env.openExternal).toHaveBeenCalled();
    const calledUri = env.openExternal.mock.calls[0][0];
    expect(calledUri.path).toContain('lynxprompt.com/wizard');
  });

  it('strips trailing slashes from API URL', async () => {
    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue('https://lynxprompt.com///'),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });

    await generateConfig();

    const calledUri = env.openExternal.mock.calls[0][0];
    expect(calledUri.path).toContain('lynxprompt.com/wizard');
    expect(calledUri.path).not.toContain('///');
  });
});

describe('convertFormat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllMocks();
  });

  it('shows error when no active editor', async () => {
    window.activeTextEditor = undefined;

    await convertFormat();

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Open an AI config file first')
    );
  });

  it('shows warning when file is empty', async () => {
    window.activeTextEditor = {
      document: { getText: () => '   ' },
      edit: vi.fn(),
    } as any;

    await convertFormat();

    expect(window.showWarningMessage).toHaveBeenCalledWith(
      'The current file is empty.'
    );
  });

  it('returns early when user cancels format pick', async () => {
    window.activeTextEditor = {
      document: { getText: () => '# Some content' },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce(undefined);

    await convertFormat();

    expect(workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it('converts to AGENTS.md format', async () => {
    window.activeTextEditor = {
      document: { getText: () => 'My rules content' },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'AGENTS.md', type: 'AGENTS_MD' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    expect(workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('# AGENTS.md'),
        language: 'markdown',
      })
    );
    expect(window.showTextDocument).toHaveBeenCalled();
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('AGENTS.md')
    );
  });

  it('converts to CLAUDE.md format', async () => {
    window.activeTextEditor = {
      document: { getText: () => 'My content' },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'CLAUDE.md', type: 'CLAUDE_MD' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    expect(workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('# CLAUDE.md'),
      })
    );
  });

  it('converts to Cursor Rules format with frontmatter', async () => {
    window.activeTextEditor = {
      document: { getText: () => 'My content' },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({
      label: 'Cursor Rules (.cursor/rules/*.mdc)',
      type: 'CURSOR_RULES',
    });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    expect(workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('alwaysApply: true'),
      })
    );
  });

  it('converts to Copilot Instructions format', async () => {
    window.activeTextEditor = {
      document: { getText: () => 'Rules here' },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'Copilot Instructions', type: 'COPILOT_INSTRUCTIONS' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    expect(workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('# Copilot Instructions'),
      })
    );
  });

  it('converts to Windsurf Rules (plain text, no wrapping)', async () => {
    window.activeTextEditor = {
      document: { getText: () => 'Plain rules' },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'Windsurf Rules', type: 'WINDSURF_RULES' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    expect(workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Plain rules',
      })
    );
  });

  it('converts to Cline Rules (plain text)', async () => {
    window.activeTextEditor = {
      document: { getText: () => 'Cline content' },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'Cline Rules', type: 'CLINE_RULES' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    expect(workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Cline content',
      })
    );
  });

  it('converts to Codex Rules format', async () => {
    window.activeTextEditor = {
      document: { getText: () => 'Codex stuff' },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'Codex Rules', type: 'CODEX_RULES' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    expect(workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('# CODEX.md'),
      })
    );
  });

  it('strips existing MDC frontmatter before converting', async () => {
    const mdcContent = '---\ndescription: test\nglobs:\nalwaysApply: true\n---\n\nActual content';
    window.activeTextEditor = {
      document: { getText: () => mdcContent },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'AGENTS.md', type: 'AGENTS_MD' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    const openDocCall = workspace.openTextDocument.mock.calls[0][0] as { content: string };
    expect(openDocCall.content).toContain('Actual content');
    expect(openDocCall.content).not.toContain('alwaysApply');
  });

  it('strips existing AGENTS.md header before converting', async () => {
    const agentsContent = '# AGENTS.md\n\nMy rules here';
    window.activeTextEditor = {
      document: { getText: () => agentsContent },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'CLAUDE.md', type: 'CLAUDE_MD' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    const openDocCall = workspace.openTextDocument.mock.calls[0][0] as { content: string };
    expect(openDocCall.content).toContain('# CLAUDE.md');
    expect(openDocCall.content).toContain('My rules here');
    // Should not have double "# AGENTS.md" header
    expect(openDocCall.content).not.toContain('# AGENTS.md');
  });

  it('strips Copilot Instructions header before converting', async () => {
    const copilotContent = '# Copilot Instructions\n\nInstructions here';
    window.activeTextEditor = {
      document: { getText: () => copilotContent },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'AGENTS.md', type: 'AGENTS_MD' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    const openDocCall = workspace.openTextDocument.mock.calls[0][0] as { content: string };
    expect(openDocCall.content).not.toContain('# Copilot Instructions');
    expect(openDocCall.content).toContain('Instructions here');
  });

  it('strips CLAUDE.md header before converting', async () => {
    const claudeContent = '# CLAUDE.md\n\nClaude instructions here';
    window.activeTextEditor = {
      document: { getText: () => claudeContent },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'AGENTS.md', type: 'AGENTS_MD' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    const openDocCall = workspace.openTextDocument.mock.calls[0][0] as { content: string };
    expect(openDocCall.content).not.toContain('# CLAUDE.md');
    expect(openDocCall.content).toContain('Claude instructions here');
  });

  it('strips Codex Rules header before converting', async () => {
    const codexContent = '# Codex Rules\n\nCodex instructions';
    window.activeTextEditor = {
      document: { getText: () => codexContent },
      edit: vi.fn(),
    } as any;

    window.showQuickPick.mockResolvedValueOnce({ label: 'CLAUDE.md', type: 'CLAUDE_MD' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    const openDocCall = workspace.openTextDocument.mock.calls[0][0] as { content: string };
    expect(openDocCall.content).toContain('# CLAUDE.md');
    expect(openDocCall.content).toContain('Codex instructions');
  });

  it('handles unknown target type as plain text (default case)', async () => {
    window.activeTextEditor = {
      document: { getText: () => 'Some content' },
      edit: vi.fn(),
    } as any;

    // Force an unknown type through the conversion
    window.showQuickPick.mockResolvedValueOnce({ label: 'Custom', type: 'CUSTOM' });
    workspace.openTextDocument.mockResolvedValueOnce({ getText: () => '' });

    await convertFormat();

    const openDocCall = workspace.openTextDocument.mock.calls[0][0] as { content: string };
    // CUSTOM type falls through to default case -- plain text, no wrapping
    expect(openDocCall.content).toBe('Some content');
  });
});
