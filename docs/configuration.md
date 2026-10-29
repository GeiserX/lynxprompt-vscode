# Configuration

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `lynxprompt.apiUrl` | `https://lynxprompt.geiser.cloud` | Base URL for the LynxPrompt API. A saved `https://lynxprompt.com` (the old official address) is treated as the new one; any other URL is used as is. |
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

- VS Code `1.125.0` or later
- A LynxPrompt account at [lynxprompt.geiser.cloud](https://lynxprompt.geiser.cloud)

