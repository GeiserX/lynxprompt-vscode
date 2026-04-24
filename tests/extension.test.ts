import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  window,
  commands,
  workspace,
  env,
  Uri,
  createMockExtensionContext,
  Disposable,
  resetAllMocks,
} from './__mocks__/vscode';
import { activate, deactivate } from '../src/extension';

describe('extension', () => {
  let context: ReturnType<typeof createMockExtensionContext>;
  let mockStatusBarItem: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllMocks();
    context = createMockExtensionContext();

    mockStatusBarItem = {
      text: '',
      tooltip: '',
      command: undefined,
      backgroundColor: undefined,
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    };
    window.createStatusBarItem.mockReturnValue(mockStatusBarItem);

    workspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'apiUrl') return 'https://lynxprompt.com';
        if (key === 'showStatusBar') return true;
        if (key === 'watchFileChanges') return true;
        if (key === 'autoDetectConfigFiles') return true;
        return defaultValue;
      }),
      update: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
    });

    workspace.createFileSystemWatcher.mockReturnValue({
      onDidChange: vi.fn().mockReturnValue(new Disposable(() => {})),
      onDidCreate: vi.fn().mockReturnValue(new Disposable(() => {})),
      onDidDelete: vi.fn().mockReturnValue(new Disposable(() => {})),
      dispose: vi.fn(),
    });
  });

  describe('activate', () => {
    it('registers all expected commands', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      const registeredCommands = commands.registerCommand.mock.calls.map(
        (call: unknown[]) => call[0]
      );

      expect(registeredCommands).toContain('lynxprompt.signIn');
      expect(registeredCommands).toContain('lynxprompt.signOut');
      expect(registeredCommands).toContain('lynxprompt.refreshBlueprints');
      expect(registeredCommands).toContain('lynxprompt.refreshLocalFiles');
      expect(registeredCommands).toContain('lynxprompt.pullBlueprint');
      expect(registeredCommands).toContain('lynxprompt.pushConfig');
      expect(registeredCommands).toContain('lynxprompt.diffBlueprint');
      expect(registeredCommands).toContain('lynxprompt.generateConfig');
      expect(registeredCommands).toContain('lynxprompt.convertFormat');
      expect(registeredCommands).toContain('lynxprompt.openBlueprint');
    });

    it('creates tree views for blueprints and local files', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      const treeViewCalls = window.createTreeView.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(treeViewCalls).toContain('lynxprompt.blueprints');
      expect(treeViewCalls).toContain('lynxprompt.localFiles');
    });

    it('sets authentication context when token exists', async () => {
      context.secrets.get.mockResolvedValue('existing-token');
      await activate(context as any);

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'lynxprompt.authenticated',
        true
      );
    });

    it('sets authentication context to false when no token', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'lynxprompt.authenticated',
        false
      );
    });

    it('creates status bar item and shows it', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      expect(window.createStatusBarItem).toHaveBeenCalled();
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('shows unauthenticated status bar state', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      expect(mockStatusBarItem.text).toBe('$(circle-slash) LynxPrompt');
      expect(mockStatusBarItem.command).toBe('lynxprompt.signIn');
    });

    it('shows authenticated status bar state', async () => {
      context.secrets.get.mockResolvedValue('my-token');
      await activate(context as any);

      expect(mockStatusBarItem.text).toBe('$(check) LynxPrompt');
      expect(mockStatusBarItem.command).toBe('lynxprompt.refreshBlueprints');
    });

    it('sets up file watchers for config patterns', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      expect(workspace.createFileSystemWatcher).toHaveBeenCalled();
      const patterns = workspace.createFileSystemWatcher.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(patterns).toContain('**/AGENTS.md');
      expect(patterns).toContain('**/CLAUDE.md');
      expect(patterns).toContain('**/.cursor/rules/**');
    });

    it('skips status bar when showStatusBar is false', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      workspace.getConfiguration.mockReturnValue({
        get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'showStatusBar') return false;
          if (key === 'watchFileChanges') return true;
          if (key === 'apiUrl') return 'https://lynxprompt.com';
          return defaultValue;
        }),
        update: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
      });

      window.createStatusBarItem.mockClear();
      await activate(context as any);

      expect(window.createStatusBarItem).not.toHaveBeenCalled();
    });

    it('skips file watchers when watchFileChanges is false', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      workspace.getConfiguration.mockReturnValue({
        get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'watchFileChanges') return false;
          if (key === 'showStatusBar') return true;
          if (key === 'apiUrl') return 'https://lynxprompt.com';
          return defaultValue;
        }),
        update: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
      });

      workspace.createFileSystemWatcher.mockClear();
      await activate(context as any);

      expect(workspace.createFileSystemWatcher).not.toHaveBeenCalled();
    });

    it('adds disposables to context.subscriptions', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('openBlueprint command opens browser', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      const call = commands.registerCommand.mock.calls.find(
        (c: unknown[]) => c[0] === 'lynxprompt.openBlueprint'
      );
      expect(call).toBeDefined();
      const handler = call![1] as (item: unknown) => void;
      handler({ blueprint: { id: 'bp-123' } });
      expect(env.openExternal).toHaveBeenCalled();
    });

    it('openBlueprint does nothing with no item', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      const call = commands.registerCommand.mock.calls.find(
        (c: unknown[]) => c[0] === 'lynxprompt.openBlueprint'
      );
      const handler = call![1] as (item: unknown) => void;
      env.openExternal.mockClear();
      handler(null);
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    it('openBlueprint ignores item without blueprint property', async () => {
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      const call = commands.registerCommand.mock.calls.find(
        (c: unknown[]) => c[0] === 'lynxprompt.openBlueprint'
      );
      const handler = call![1] as (item: unknown) => void;
      env.openExternal.mockClear();
      handler({ someOtherProp: true });
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    it('loads persisted link mappings from workspace state', async () => {
      context.workspaceState.get.mockReturnValue({
        '/workspace/AGENTS.md': {
          localPath: '/workspace/AGENTS.md',
          blueprintId: 'bp-1',
          lastChecksum: 'abc',
        },
      });
      context.secrets.get.mockResolvedValue(undefined);
      await activate(context as any);

      expect(context.workspaceState.get).toHaveBeenCalledWith(
        'lynxprompt.linkMappings',
        {}
      );
    });

    it('file watcher onDidCreate refreshes local files', async () => {
      context.secrets.get.mockResolvedValue(undefined);

      const onCreateCbs: Array<(uri: any) => void> = [];
      workspace.createFileSystemWatcher.mockReturnValue({
        onDidChange: vi.fn().mockReturnValue(new Disposable(() => {})),
        onDidCreate: vi.fn().mockImplementation((cb: (uri: any) => void) => {
          onCreateCbs.push(cb);
          return new Disposable(() => {});
        }),
        onDidDelete: vi.fn().mockReturnValue(new Disposable(() => {})),
        dispose: vi.fn(),
      });

      await activate(context as any);
      expect(onCreateCbs.length).toBeGreaterThan(0);
      // Trigger without error
      onCreateCbs[0](Uri.file('/workspace/AGENTS.md'));
    });

    it('file watcher onDidDelete clears mapping and persists', async () => {
      context.workspaceState.get.mockReturnValue({
        '/workspace/AGENTS.md': {
          localPath: '/workspace/AGENTS.md',
          blueprintId: 'bp-1',
          lastChecksum: 'abc',
        },
      });
      context.secrets.get.mockResolvedValue(undefined);

      const onDeleteCbs: Array<(uri: any) => void> = [];
      workspace.createFileSystemWatcher.mockReturnValue({
        onDidChange: vi.fn().mockReturnValue(new Disposable(() => {})),
        onDidCreate: vi.fn().mockReturnValue(new Disposable(() => {})),
        onDidDelete: vi.fn().mockImplementation((cb: (uri: any) => void) => {
          onDeleteCbs.push(cb);
          return new Disposable(() => {});
        }),
        dispose: vi.fn(),
      });

      await activate(context as any);
      expect(onDeleteCbs.length).toBeGreaterThan(0);
      onDeleteCbs[0](Uri.file('/workspace/AGENTS.md'));

      expect(context.workspaceState.update).toHaveBeenCalled();
    });

    it('file watcher onDidChange handles unlinked file', async () => {
      context.secrets.get.mockResolvedValue(undefined);

      const onChangeCbs: Array<(uri: any) => void> = [];
      workspace.createFileSystemWatcher.mockReturnValue({
        onDidChange: vi.fn().mockImplementation((cb: (uri: any) => void) => {
          onChangeCbs.push(cb);
          return new Disposable(() => {});
        }),
        onDidCreate: vi.fn().mockReturnValue(new Disposable(() => {})),
        onDidDelete: vi.fn().mockReturnValue(new Disposable(() => {})),
        dispose: vi.fn(),
      });

      await activate(context as any);
      expect(onChangeCbs.length).toBeGreaterThan(0);
      // Trigger change on unlinked file - should just refresh without warning
      await onChangeCbs[0](Uri.file('/workspace/AGENTS.md'));
      expect(window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('file watcher onDidChange warns when linked file diverges', async () => {
      context.workspaceState.get.mockReturnValue({
        '/workspace/AGENTS.md': {
          localPath: '/workspace/AGENTS.md',
          blueprintId: 'bp-1',
          lastChecksum: 'old-checksum',
        },
      });
      context.secrets.get.mockResolvedValue(undefined);

      workspace.fs.readFile.mockResolvedValue(Buffer.from('changed content'));

      const onChangeCbs: Array<(uri: any) => void> = [];
      workspace.createFileSystemWatcher.mockReturnValue({
        onDidChange: vi.fn().mockImplementation((cb: (uri: any) => void) => {
          onChangeCbs.push(cb);
          return new Disposable(() => {});
        }),
        onDidCreate: vi.fn().mockReturnValue(new Disposable(() => {})),
        onDidDelete: vi.fn().mockReturnValue(new Disposable(() => {})),
        dispose: vi.fn(),
      });

      await activate(context as any);
      expect(onChangeCbs.length).toBeGreaterThan(0);
      await onChangeCbs[0](Uri.file('/workspace/AGENTS.md'));
      // Give async handleFileChange time
      await new Promise((r) => setTimeout(r, 100));

      expect(window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('modified'),
        'Push Changes',
        'Show Diff',
        'Dismiss'
      );
    });

    it('handleFileChange executes pushConfig on Push Changes', async () => {
      context.workspaceState.get.mockReturnValue({
        '/workspace/AGENTS.md': {
          localPath: '/workspace/AGENTS.md',
          blueprintId: 'bp-1',
          lastChecksum: 'old-checksum',
        },
      });
      context.secrets.get.mockResolvedValue(undefined);
      workspace.fs.readFile.mockResolvedValue(Buffer.from('changed'));
      window.showWarningMessage.mockResolvedValue('Push Changes');

      const onChangeCbs: Array<(uri: any) => void> = [];
      workspace.createFileSystemWatcher.mockReturnValue({
        onDidChange: vi.fn().mockImplementation((cb: (uri: any) => void) => {
          onChangeCbs.push(cb);
          return new Disposable(() => {});
        }),
        onDidCreate: vi.fn().mockReturnValue(new Disposable(() => {})),
        onDidDelete: vi.fn().mockReturnValue(new Disposable(() => {})),
        dispose: vi.fn(),
      });

      await activate(context as any);
      await onChangeCbs[0](Uri.file('/workspace/AGENTS.md'));
      await new Promise((r) => setTimeout(r, 100));

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'lynxprompt.pushConfig',
        expect.anything()
      );
    });

    it('handleFileChange executes diff on Show Diff', async () => {
      context.workspaceState.get.mockReturnValue({
        '/workspace/AGENTS.md': {
          localPath: '/workspace/AGENTS.md',
          blueprintId: 'bp-1',
          lastChecksum: 'old-checksum',
        },
      });
      context.secrets.get.mockResolvedValue(undefined);
      workspace.fs.readFile.mockResolvedValue(Buffer.from('changed'));
      window.showWarningMessage.mockResolvedValue('Show Diff');

      const onChangeCbs: Array<(uri: any) => void> = [];
      workspace.createFileSystemWatcher.mockReturnValue({
        onDidChange: vi.fn().mockImplementation((cb: (uri: any) => void) => {
          onChangeCbs.push(cb);
          return new Disposable(() => {});
        }),
        onDidCreate: vi.fn().mockReturnValue(new Disposable(() => {})),
        onDidDelete: vi.fn().mockReturnValue(new Disposable(() => {})),
        dispose: vi.fn(),
      });

      await activate(context as any);
      await onChangeCbs[0](Uri.file('/workspace/AGENTS.md'));
      await new Promise((r) => setTimeout(r, 100));

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'lynxprompt.diffBlueprint',
        expect.anything()
      );
    });
  });

  describe('deactivate', () => {
    it('can be called without error', () => {
      expect(() => deactivate()).not.toThrow();
    });
  });
});
