# OpenCode Usage Tracker

A plugin for [OpenCode](https://opencode.ai) that shows provider usage in a TUI dialog.

## Supported Providers

| Provider | Auth Type | Usage Data |
|----------|-----------|------------|
| GitHub Copilot | OAuth | Premium requests quota, reset date |
| OpenAI/Codex | ChatGPT login or API key | ChatGPT login: 5-hour & weekly limits, credits; API key: informational only |
| MiniMax Coding Plan *(experimental)* | API key (`minimax-coding-plan.key`) | coding plan quota windows from `model_remains` |

## Installation

Recommended: install with the OpenCode plugin installer so both the server and TUI targets are configured:

```bash
opencode plugin opencode-usage-tracker
```

If you want to configure it manually, add the package to both configs:

`opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-usage-tracker"]
}
```

`tui.json`

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-usage-tracker"]
}
```

The TUI dialog will not load if the package is only present in `opencode.json`.

## Usage

Open the usage dialog from either:

- `/usage` in chat
- Command palette (`Ctrl+P`) -> `Usage`

Both entry points open the provider picker dialog.

Supported slash command:

```
/usage          # Open provider picker
```

### Example Output

The dialog displays a native TUI usage view for the selected provider scope.

## Authentication

The plugin reads authentication tokens from OpenCode's `auth.json` file located at:
- Linux: `~/.local/share/opencode/auth.json`
- macOS: `~/Library/Application Support/opencode/auth.json`

Tokens are automatically populated when you authenticate with providers in OpenCode.

MiniMax support is experimental and uses the `minimax-coding-plan.key` field in `auth.json` when present.

### OpenAI/Codex auth modes

- **ChatGPT login**: the plugin reads the ChatGPT access token from `auth.json` and fetches Codex usage from `https://chatgpt.com/backend-api/wham/usage`
- **API key**: the plugin detects manual OpenAI API-key auth and shows an informational card instead of a quota percentage, because the ChatGPT subscription usage endpoint does not apply in API-key mode

## Notes

- **Read-only**: This plugin only fetches usage data - it does not consume any quota
- **Fresh Data**: Usage data is fetched fresh on each command (no caching)

## License

MIT
