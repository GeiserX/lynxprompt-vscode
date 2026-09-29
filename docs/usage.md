# Usage

## Features

### Browse Blueprints and Local Files

Use the dedicated sidebar to see your LynxPrompt blueprints and the AI config files detected in the current workspace.

- **My Blueprints** shows cloud blueprints grouped by type
- **Local Config Files** shows workspace files with sync status indicators

### Sign In with Device Flow

Authenticate securely without copying tokens by hand.

1. Run **LynxPrompt: Sign In**
2. Complete authentication in your browser
3. Return to VS Code and start browsing your blueprints

### Pull Blueprints into the Right Paths

Download a blueprint and let the extension place it in the correct workspace location automatically.

- `CLAUDE.md`
- `AGENTS.md`
- `.cursor/rules/`
- `.github/copilot-instructions.md`
- `.windsurfrules`

### Push Local Configs Back to LynxPrompt

Right-click a supported file or use the command palette to upload local configs as blueprints.

### Diff Local vs Cloud

Open the built-in VS Code diff editor to compare a local file with its linked cloud blueprint before deciding what to keep.

### Generate and Convert

Open the LynxPrompt wizard in your browser to generate new configs, or convert supported config formats locally.

### Watch for Drift

The extension monitors linked config files and notifies you when local files diverge from the cloud version.

## Commands

| Command | Description |
|---------|-------------|
| `LynxPrompt: Sign In` | Authenticate with LynxPrompt using device flow |
| `LynxPrompt: Sign Out` | Clear stored credentials |
| `LynxPrompt: Refresh Blueprints` | Reload blueprint list from the cloud |
| `LynxPrompt: Refresh Local Files` | Rescan the workspace for AI config files |
| `LynxPrompt: Pull Blueprint to Workspace` | Download a blueprint to the correct file path |
| `LynxPrompt: Push to LynxPrompt` | Upload a local config file as a blueprint |
| `LynxPrompt: Compare with Cloud` | Open the diff editor for local vs cloud |
| `LynxPrompt: Generate Config` | Open the LynxPrompt wizard in your browser |
| `LynxPrompt: Convert Format` | Convert between supported AI config formats |

