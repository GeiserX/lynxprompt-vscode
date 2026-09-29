<p align="center">
  <img src="https://raw.githubusercontent.com/GeiserX/lynxprompt-vscode/main/docs/images/banner.png" alt="LynxPrompt for VS Code banner" width="900"/>
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
  <a href="https://github.com/GeiserX/lynxprompt-vscode/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/GeiserX/lynxprompt-vscode/ci.yml?style=flat-square&logo=github&label=CI" alt="CI"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=LynxPrompt.lynxprompt"><img src="https://img.shields.io/visual-studio-marketplace/v/LynxPrompt.lynxprompt?style=flat-square&logo=visualstudiocode&label=Marketplace" alt="Marketplace version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=LynxPrompt.lynxprompt"><img src="https://img.shields.io/visual-studio-marketplace/i/LynxPrompt.lynxprompt?style=flat-square&logo=visualstudiocode&label=Installs" alt="Marketplace installs"></a>
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

The official VS Code extension for [LynxPrompt](https://lynxprompt.com) — a self-hostable platform for managing AI IDE configuration files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `copilot-instructions.md`, `.windsurfrules`, and 30+ more formats).

This extension brings LynxPrompt directly into your editor so you can manage cloud blueprints and local config files without switching to the browser.

## Features

- A sidebar with your cloud blueprints grouped by type, and the AI config files found in the workspace with their sync status.
- Sign in with a device flow in the browser, no token copying.
- Pull a blueprint and it lands in the right path: `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `.windsurfrules`.
- Push a local config back to LynxPrompt from the context menu or the command palette.
- Compare a local file with its cloud blueprint in the VS Code diff editor.
- Generate configs in the LynxPrompt wizard, or convert between formats locally.
- Get notified when a linked file drifts from the cloud version.
- Point it at your own LynxPrompt instance with `lynxprompt.apiUrl`.

## Quick start

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LynxPrompt.lynxprompt), or in Quick Open (`Ctrl+P`) run:

```bash
ext install LynxPrompt.lynxprompt
```

Then run **LynxPrompt: Sign In**. You need VS Code `1.85.0` or later and a LynxPrompt account.

## Documentation

- [Usage](https://github.com/GeiserX/lynxprompt-vscode/blob/main/docs/usage.md): every feature and command
- [Configuration](https://github.com/GeiserX/lynxprompt-vscode/blob/main/docs/configuration.md): extension settings, self-hosting, requirements
- [Development](https://github.com/GeiserX/lynxprompt-vscode/blob/main/docs/development.md): building, packaging and contributing
- [Changelog](https://github.com/GeiserX/lynxprompt-vscode/blob/main/CHANGELOG.md)

## Related Projects

| Project | Description |
|---------|-------------|
| [LynxPrompt](https://github.com/GeiserX/LynxPrompt) | Self-hosted platform for AI IDE/Tools Rules and Commands via WebUI and CLI |
| [lynxprompt-action](https://github.com/GeiserX/lynxprompt-action) | GitHub Action to sync and validate AI IDE configuration files with LynxPrompt |
| [lynxprompt-mcp](https://github.com/GeiserX/lynxprompt-mcp) | MCP Server for LynxPrompt AI configuration blueprint management |
| [n8n-nodes-lynxprompt](https://github.com/GeiserX/n8n-nodes-lynxprompt) | n8n community node for LynxPrompt AI configuration blueprints |
| [homebrew-lynxprompt](https://github.com/GeiserX/homebrew-lynxprompt) | Homebrew tap for LynxPrompt CLI |

## License

[GPL-3.0](LICENSE)
