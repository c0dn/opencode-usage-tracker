/**
 * OpenCode Usage Tracker Plugin (server hooks)
 *
 * Handles /usage slash command and opens the TUI command dialog entry
 * exposed by the companion TUI plugin.
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import {
  USAGE_COMMAND_OPEN_ALL,
  USAGE_COMMAND_OPEN_COPILOT,
  USAGE_COMMAND_OPEN_OPENAI,
  USAGE_COMMAND_OPEN_PICKER,
} from "./constants.ts";

const HANDLED_SENTINEL = "__USAGE_TRACKER_HANDLED__";
function parseUsageCommandTarget(args: string): string {
  const lower = args.toLowerCase().trim();
  const [firstToken] = lower.split(/\s+/);

  switch (firstToken) {
    case "copilot":
    case "github":
      return USAGE_COMMAND_OPEN_COPILOT;
    case "openai":
    case "codex":
    case "chatgpt":
      return USAGE_COMMAND_OPEN_OPENAI;
    case "all":
      return USAGE_COMMAND_OPEN_ALL;
    default:
      return USAGE_COMMAND_OPEN_PICKER;
  }
}

function isUsageCommand(command: string): boolean {
  return command.replace(/^\//, "") === "usage";
}

export async function UsageTrackerPlugin(
  { client }: PluginInput,
): Promise<Hooks> {
  return {
    config: async (input) => {
      input.command ??= {};

      if (!input.command["usage"]) {
        input.command["usage"] = {
          template: "$ARGUMENTS",
          description: "Open usage dashboard",
        };
      }
    },

    "command.execute.before": async (input, output) => {
      if (!isUsageCommand(input.command)) {
        return;
      }

      const command = parseUsageCommandTarget(input.arguments);

      try {
        await client.tui.executeCommand({
          body: { command },
        });
      } catch {
        await client.tui.showToast({
          body: {
            title: "Usage Tracker",
            message: "Usage dialog unavailable. Install/load the TUI plugin in tui.json or via `opencode plugin opencode-usage-tracker`.",
            variant: "warning",
          },
        });
      }

      return stopCommandFlow(output);
    },
  };
}

function stopCommandFlow(output: { parts: unknown[] }): void {
  void output;
  throw new Error(HANDLED_SENTINEL);
}
