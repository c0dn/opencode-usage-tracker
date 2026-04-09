/**
 * OpenCode Usage Tracker Plugin
 * 
 * Displays subscription usage for AI providers (Copilot, OpenAI, Claude)
 * directly in the OpenCode chat interface.
 * 
 * Commands:
 *   /usage          - Show all configured providers
 *   /usage copilot  - Show GitHub Copilot usage only
 *   /usage openai   - Show OpenAI/Codex usage only
 *   /usage claude   - Show Claude (placeholder only)
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import { getAuthTokens, type AuthTokens } from "./utils/auth.ts";
import { 
  formatUsageTable, 
  formatNoProviders, 
  formatError,
  type UsageData 
} from "./utils/format.ts";
import { fetchClaudeUsage } from "./providers/claude.ts";
import { fetchCopilotUsage } from "./providers/copilot.ts";
import { fetchOpenAIUsage } from "./providers/openai.ts";

const HANDLED_SENTINEL = "__USAGE_TRACKER_HANDLED__";

type ProviderName = "claude" | "copilot" | "openai" | "all";

function parseProviderArg(text: string): ProviderName {
  const lower = text.toLowerCase().trim();
  const [firstToken] = lower.split(/\s+/);

  switch (firstToken) {
    case "claude":
    case "anthropic":
      return "claude";
    case "copilot":
    case "github":
      return "copilot";
    case "openai":
    case "codex":
    case "chatgpt":
      return "openai";
    default:
      break;
  }

  return "all";
}

function isUsageCommand(command: string): boolean {
  return command.replace(/^\//, "") === "usage";
}

function isProviderConfigured(tokens: AuthTokens, provider: ProviderName): boolean {
  switch (provider) {
    case "claude":
      return Boolean(tokens.claude?.configured);
    case "copilot":
      return Boolean(tokens.copilot?.accessToken);
    case "openai":
      return Boolean(tokens.openai?.accessToken);
    case "all":
      return Boolean(tokens.claude?.configured || tokens.copilot?.accessToken || tokens.openai?.accessToken);
  }
}

async function fetchUsageData(
  tokens: AuthTokens, 
  provider: ProviderName
): Promise<UsageData[]> {
  const results: UsageData[] = [];
  const fetchPromises: Array<{ name: string; request: Promise<UsageData> }> = [];
  
  // Claude (placeholder only)
  if ((provider === "all" || provider === "claude") && tokens.claude?.configured) {
    fetchPromises.push({ name: "Claude", request: fetchClaudeUsage() });
  }
  
  // Copilot
  if ((provider === "all" || provider === "copilot") && tokens.copilot?.accessToken) {
    fetchPromises.push({
      name: "GitHub Copilot",
      request: fetchCopilotUsage(tokens.copilot.accessToken),
    });
  }
  
  // OpenAI
  if ((provider === "all" || provider === "openai") && tokens.openai?.accessToken) {
    fetchPromises.push({
      name: "OpenAI/Codex",
      request: fetchOpenAIUsage(tokens.openai.accessToken, tokens.openai.accountId),
    });
  }
  
  // Fetch all in parallel
  const settled = await Promise.allSettled(fetchPromises.map((item) => item.request));

  for (const [index, result] of settled.entries()) {
    const providerInfo = fetchPromises[index];

    if (!providerInfo) {
      continue;
    }

    if (result.status === "fulfilled") {
      results.push(result.value);
      continue;
    }

    results.push({
      provider: providerInfo.name,
      windows: [],
      error: result.reason instanceof Error ? result.reason.message : "Unknown error",
    });
  }
  
  // Sort results in consistent order: Claude, Copilot, OpenAI
  const order = ["Claude", "GitHub Copilot", "OpenAI/Codex"];
  results.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
  
  return results;
}

export async function UsageTrackerPlugin(
  { client }: PluginInput,
): Promise<Hooks> {
  return {
    /**
     * Register the /usage command
     */
    config: async (input) => {
      input.command ??= {};

      if (input.command["usage"]) {
        return;
      }

      input.command["usage"] = {
        template: "$ARGUMENTS",
        description: "Show AI provider usage",
      };
    },
    
    /**
     * Handle /usage command before normal command execution.
     */
    "command.execute.before": async (input, output) => {
      if (!isUsageCommand(input.command)) {
        return;
      }

      // Extract provider argument from slash command args
      const args = input.arguments.trim();
      const provider = parseProviderArg(args);
      
      // Show loading toast
      await client.tui.showToast({
        body: { message: "Fetching usage data...", variant: "info" },
      });
      
      // Get auth tokens
      let tokens: AuthTokens;
      try {
        tokens = await getAuthTokens();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        await injectResponse(client, input.sessionID, formatError(`Failed to read auth: ${errorMsg}`));
        return stopCommandFlow(output);
      }
      
      // Check if any providers are configured
      const hasProviders = 
        tokens.claude?.configured || 
        tokens.copilot?.accessToken || 
        tokens.openai?.accessToken;
      
      if (!hasProviders) {
        await injectResponse(client, input.sessionID, formatNoProviders());
        return stopCommandFlow(output);
      }

      if (!isProviderConfigured(tokens, provider)) {
        await injectResponse(
          client,
          input.sessionID,
          formatError(`Provider not configured: ${provider}`),
        );
        return stopCommandFlow(output);
      }
      
      // Fetch usage data
      const usageData = await fetchUsageData(tokens, provider);
      
      if (usageData.length === 0) {
        await injectResponse(client, input.sessionID, formatNoProviders());
        return stopCommandFlow(output);
      }
      
      // Format and display results
      const output_text = formatUsageTable(usageData);
      await injectResponse(client, input.sessionID, output_text);

      // Prevent default LLM command execution for /usage.
      return stopCommandFlow(output);
    },
  };
}

/**
 * Inject a response directly into the session (bypasses LLM)
 */
async function injectResponse(
  client: PluginInput["client"],
  sessionID: string,
  text: string
): Promise<void> {
  await client.session.prompt({
    path: { id: sessionID },
    body: {
      noReply: true,
      parts: [
        {
          type: "text",
          text: text,
          ignored: true,
        },
      ],
    },
  });
}

/**
 * Stop command flow after we handled /usage ourselves.
 *
 * Newer OpenCode runtimes support command hook noReply, older runtimes don't.
 * Fallback to the historical sentinel throw for backward compatibility.
 */
function stopCommandFlow(output: { parts: unknown[] }): void {
  void output;
  throw new Error(HANDLED_SENTINEL);
}
