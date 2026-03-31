<p align="center">
  <img src="media/banner.png" alt="LynxPrompt for VS Code banner" width="900"/>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/GeiserX/LynxPrompt/main/public/logo.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/GeiserX/LynxPrompt/main/public/logo.png">
    <img alt="LynxPrompt" src="https://raw.githubusercontent.com/GeiserX/LynxPrompt/main/public/logo.png" width="120">
  </picture>
</p>

<h1 align="center">LynxPrompt for VS Code</h1>

<p align="center">
  <strong>Browse, pull, diff, and push AI config files directly from the editor</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=LynxPrompt.lynxprompt"><img src="https://img.shields.io/visual-studio-marketplace/v/LynxPrompt.lynxprompt?style=flat-square&logo=visualstudiocode&label=Marketplace" alt="Marketplace version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=LynxPrompt.lynxprompt"><img src="https://img.shields.io/visual-studio-marketplace/i/LynxPrompt.lynxprompt?style=flat-square&logo=visualstudiocode&label=Installs" alt="Marketplace installs"></a>
  <a href="https://github.com/GeiserX/lynxprompt-vscode/releases"><img src="https://img.shields.io/github/v/release/GeiserX/lynxprompt-vscode?style=flat-square&logo=github&label=Release" alt="GitHub Release"></a>
  <a href="https://github.com/GeiserX/lynxprompt-vscode"><img src="https://img.shields.io/github/stars/GeiserX/lynxprompt-vscode?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=LynxPrompt.lynxprompt"><strong>Install from Marketplace</strong></a>
  ·
  <a href="vscode:extension/LynxPrompt.lynxprompt"><strong>Open in VS Code</strong></a>
  ·
  <a href="https://lynxprompt.com"><strong>LynxPrompt Platform</strong></a>
  ·
  <a href="https://github.com/GeiserX/LynxPrompt"><strong>Main Repository</strong></a>
</p>

---

## What is this?

The official VS Code extension for [LynxPrompt](https://lynxprompt.com) — a self-hostable platform for managing AI IDE configuration files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `copilot-instructions.md`, `.windsurfrules`, and 30+ more formats).

This extension brings LynxPrompt directly into your editor so you can manage cloud blueprints and local config files without switching to the browser.

---

## Install

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LynxPrompt.lynxprompt) or run:

```bash
ext install LynxPrompt.lynxprompt
```

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

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `lynxprompt.apiUrl` | `https://lynxprompt.com` | Base URL for the LynxPrompt API. |
| `lynxprompt.autoDetectConfigFiles` | `true` | Automatically detect AI configuration files in the workspace. |
| `lynxprompt.watchFileChanges` | `true` | Watch linked files and notify on divergence from cloud. |
| `lynxprompt.showStatusBar` | `true` | Show connection status in the status bar. |

## Self-Hosting

If you run your own LynxPrompt instance, change the API URL in settings:

```json
{
  "lynxprompt.apiUrl": "https://lynxprompt.yourdomain.com"
}
```

## Requirements

- VS Code `1.85.0` or later
- A LynxPrompt account at [lynxprompt.com](https://lynxprompt.com)

## Development

```bash
npm install
npm run watch   # dev mode with auto-rebuild
npm run build   # production build
npm run package # create .vsix
```

Press `F5` in VS Code to launch the Extension Development Host.

## Contributing

Contributions are welcome. Open an issue first to discuss substantial changes.

## License

[GPL-3.0](LICENSE)
