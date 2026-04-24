/**
 * Comprehensive mock of the vscode module for unit testing.
 * Covers all APIs used across the LynxPrompt extension.
 */
import { vi } from 'vitest';

// --- Uri ---
export class Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;

  private constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
    this.fsPath = path;
  }

  static file(path: string): Uri {
    return new Uri('file', '', path, '', '');
  }

  static parse(value: string): Uri {
    return new Uri('https', '', value, '', '');
  }

  toString(): string {
    return this.fsPath || this.path;
  }
}

// --- Enums ---
export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// --- ThemeIcon / ThemeColor ---
export class ThemeIcon {
  constructor(public readonly id: string, public readonly color?: ThemeColor) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

// --- MarkdownString ---
export class MarkdownString {
  value = '';
  isTrusted = false;
  supportThemeIcons = false;

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendText(value: string): MarkdownString {
    this.value += value;
    return this;
  }
}

// --- TreeItem ---
export class TreeItem {
  label?: string;
  description?: string;
  tooltip?: string | MarkdownString;
  iconPath?: ThemeIcon | Uri;
  contextValue?: string;
  command?: { command: string; title: string; arguments?: unknown[] };
  collapsibleState?: TreeItemCollapsibleState;
  resourceUri?: Uri;
  id?: string;
  backgroundColor?: ThemeColor;

  constructor(
    labelOrUri: string | Uri,
    collapsibleState?: TreeItemCollapsibleState
  ) {
    if (typeof labelOrUri === 'string') {
      this.label = labelOrUri;
    } else {
      this.resourceUri = labelOrUri;
    }
    this.collapsibleState = collapsibleState;
  }
}

// --- EventEmitter ---
export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void): Disposable => {
    this.listeners.push(listener);
    return new Disposable(() => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    });
  };

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

// --- Disposable ---
export class Disposable {
  private _callOnDispose: () => void;

  constructor(callOnDispose: () => void) {
    this._callOnDispose = callOnDispose;
  }

  dispose(): void {
    this._callOnDispose();
  }
}

// --- CancellationTokenSource ---
export class CancellationTokenSource {
  token = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(),
  };
  cancel(): void {
    this.token.isCancellationRequested = true;
  }
  dispose(): void {}
}

// --- window ---
const _statusBarItem = {
  text: '',
  tooltip: '',
  command: undefined as string | undefined,
  backgroundColor: undefined as ThemeColor | undefined,
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
};

export const window = {
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  showQuickPick: vi.fn().mockResolvedValue(undefined),
  showInputBox: vi.fn().mockResolvedValue(undefined),
  showOpenDialog: vi.fn().mockResolvedValue(undefined),
  showWorkspaceFolderPick: vi.fn().mockResolvedValue(undefined),
  showTextDocument: vi.fn().mockResolvedValue(undefined),
  createTreeView: vi.fn().mockReturnValue({
    dispose: vi.fn(),
    onDidChangeSelection: vi.fn(),
    onDidChangeVisibility: vi.fn(),
    reveal: vi.fn(),
  }),
  createStatusBarItem: vi.fn().mockReturnValue(_statusBarItem),
  activeTextEditor: undefined as { document: { getText: () => string }; edit: () => void } | undefined,
  withProgress: vi.fn().mockImplementation(
    async (_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      const progress = { report: vi.fn() };
      const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
      return task(progress, token);
    }
  ),
  createOutputChannel: vi.fn().mockReturnValue({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  }),
};

// --- commands ---
export const commands = {
  registerCommand: vi.fn().mockReturnValue(new Disposable(() => {})),
  executeCommand: vi.fn().mockResolvedValue(undefined),
};

// --- workspace ---
const _configValues: Record<string, unknown> = {
  'lynxprompt.apiUrl': 'https://lynxprompt.com',
  'lynxprompt.autoDetectConfigFiles': true,
  'lynxprompt.watchFileChanges': true,
  'lynxprompt.showStatusBar': true,
};

export const workspace = {
  getConfiguration: vi.fn().mockImplementation((_section?: string) => ({
    get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
      const fullKey = _section ? `${_section}.${key}` : key;
      return fullKey in _configValues ? _configValues[fullKey] : defaultValue;
    }),
    update: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockReturnValue(true),
    inspect: vi.fn(),
  })),
  workspaceFolders: [
    {
      uri: Uri.file('/workspace'),
      name: 'workspace',
      index: 0,
    },
  ],
  getWorkspaceFolder: vi.fn().mockImplementation((uri: Uri) => ({
    uri: Uri.file('/workspace'),
    name: 'workspace',
    index: 0,
  })),
  findFiles: vi.fn().mockResolvedValue([]),
  openTextDocument: vi.fn().mockResolvedValue({
    getText: vi.fn().mockReturnValue(''),
    uri: Uri.file('/workspace/test.md'),
  }),
  createFileSystemWatcher: vi.fn().mockReturnValue({
    onDidChange: vi.fn().mockReturnValue(new Disposable(() => {})),
    onDidCreate: vi.fn().mockReturnValue(new Disposable(() => {})),
    onDidDelete: vi.fn().mockReturnValue(new Disposable(() => {})),
    dispose: vi.fn(),
  }),
  asRelativePath: vi.fn().mockImplementation((pathOrUri: string | Uri) => {
    const p = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
    return p.replace('/workspace/', '');
  }),
  fs: {
    readFile: vi.fn().mockResolvedValue(Buffer.from('')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ type: 1, size: 0, ctime: 0, mtime: 0 }),
    delete: vi.fn().mockResolvedValue(undefined),
    createDirectory: vi.fn().mockResolvedValue(undefined),
  },
};

// --- env ---
export const env = {
  openExternal: vi.fn().mockResolvedValue(true),
};

// --- SecretStorage mock helper ---
export function createMockSecretStorage(): {
  get: ReturnType<typeof vi.fn>;
  store: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  onDidChange: ReturnType<typeof vi.fn>;
} {
  const storage = new Map<string, string>();
  const emitter = new EventEmitter<{ key: string }>();
  return {
    get: vi.fn().mockImplementation(async (key: string) => storage.get(key)),
    store: vi.fn().mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
      emitter.fire({ key });
    }),
    delete: vi.fn().mockImplementation(async (key: string) => {
      storage.delete(key);
      emitter.fire({ key });
    }),
    onDidChange: emitter.event,
  };
}

// --- ExtensionContext mock helper ---
export function createMockExtensionContext() {
  const workspaceState = new Map<string, unknown>();
  const secrets = createMockSecretStorage();
  return {
    subscriptions: [] as Disposable[],
    workspaceState: {
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) =>
        workspaceState.has(key) ? workspaceState.get(key) : defaultValue
      ),
      update: vi.fn().mockImplementation((key: string, value: unknown) => {
        workspaceState.set(key, value);
        return Promise.resolve();
      }),
      keys: vi.fn().mockImplementation(() => [...workspaceState.keys()]),
    },
    globalState: {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockReturnValue([]),
      setKeysForSync: vi.fn(),
    },
    secrets,
    extensionPath: '/mock/extension',
    extensionUri: Uri.file('/mock/extension'),
    storageUri: Uri.file('/mock/storage'),
    globalStorageUri: Uri.file('/mock/global-storage'),
    logUri: Uri.file('/mock/log'),
    extensionMode: 3, // Production
  };
}

// Helper to reset all mocks
export function resetAllMocks(): void {
  window.showInformationMessage.mockReset().mockResolvedValue(undefined);
  window.showWarningMessage.mockReset().mockResolvedValue(undefined);
  window.showErrorMessage.mockReset().mockResolvedValue(undefined);
  window.showQuickPick.mockReset().mockResolvedValue(undefined);
  window.showInputBox.mockReset().mockResolvedValue(undefined);
  window.showOpenDialog.mockReset().mockResolvedValue(undefined);
  window.showWorkspaceFolderPick.mockReset().mockResolvedValue(undefined);
  window.showTextDocument.mockReset().mockResolvedValue(undefined);
  window.createTreeView.mockReset().mockReturnValue({
    dispose: vi.fn(),
    onDidChangeSelection: vi.fn(),
    onDidChangeVisibility: vi.fn(),
    reveal: vi.fn(),
  });
  window.withProgress.mockReset().mockImplementation(
    async (_opts: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      const progress = { report: vi.fn() };
      const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
      return task(progress, token);
    }
  );
  window.activeTextEditor = undefined;
  commands.registerCommand.mockReset().mockReturnValue(new Disposable(() => {}));
  commands.executeCommand.mockReset().mockResolvedValue(undefined);
  workspace.findFiles.mockReset().mockResolvedValue([]);
  workspace.fs.readFile.mockReset().mockResolvedValue(Buffer.from(''));
  workspace.fs.writeFile.mockReset().mockResolvedValue(undefined);
  workspace.fs.stat.mockReset().mockResolvedValue({ type: 1, size: 0, ctime: 0, mtime: 0 });
  workspace.fs.delete.mockReset().mockResolvedValue(undefined);
  workspace.fs.createDirectory.mockReset().mockResolvedValue(undefined);
  env.openExternal.mockReset().mockResolvedValue(true);
}
