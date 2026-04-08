# OpenCode Usage Tracker

A plugin for [OpenCode](https://opencode.ai) that displays your AI provider subscription usage directly in the chat interface.

## Supported Providers

| Provider | Auth Type | Usage Data |
|----------|-----------|------------|
| GitHub Copilot | OAuth | Premium requests quota, reset date |
| OpenAI/Codex | OAuth | 5-hour & weekly limits, credits |
| Claude | - | Placeholder only (usage tracking unavailable) |

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Dylan-Liew/opencode-usage-tracker.git <plugin-directory>
```

2. Install dependencies:

```bash
cd <plugin-directory>
bun install
```

3. Add the plugin to your `opencode.json` config file:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["<plugin-directory>"]
}
```

4. Restart OpenCode.

## Usage

Run the `/usage` command in OpenCode chat:

```
/usage          # Show all providers
/usage copilot  # Show GitHub Copilot only
/usage openai   # Show OpenAI/Codex only
/usage claude   # Show Claude placeholder
```

### Example Output

```
╭───────────────────────────────────────────────╮
│               AI Provider Usage               │
├───────────────────────────────────────────────┤
│ GitHub Copilot (Education)                    │
│   Premium:  ███░░░░░░░░░░░░  10%              │
│   Premium Resets: 22d 16h (01/05/26 9:09 PM)  │
│   Requests: 31/300 used                       │
│   Remaining: 269 requests                     │
├───────────────────────────────────────────────┤
│ OpenAI/Codex (Plus)                           │
│   5-hour:   ░░░░░░░░░░░░░░   3%               │
│   Weekly:   ░░░░░░░░░░░░░░   1%               │
│   5-hour Resets: 2h 58m (9:09 PM)             │
│   Weekly Resets: 6d 21h (15/04/26 9:09 PM)    │
│   Credits: $0.00                              │
├───────────────────────────────────────────────┤
│ Claude                                        │
│   Usage tracking unavailable                  │
╰───────────────────────────────────────────────╯
```

## Authentication

The plugin reads authentication tokens from OpenCode's `auth.json` file located at:
- Linux: `~/.local/share/opencode/auth.json`
- macOS: `~/Library/Application Support/opencode/auth.json`

Tokens are automatically populated when you authenticate with providers in OpenCode.

## Notes

- **Read-only**: This plugin only fetches usage data - it does not consume any quota
- **Claude**: Usage tracking is not available for Claude (API limitations)
- **Fresh Data**: Usage data is fetched fresh on each command (no caching)

## License

MIT
