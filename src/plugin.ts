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

const COMMAND_MARKER = "[USAGE_TRACKER_COMMAND]";

type ProviderName = "claude" | "copilot" | "openai" | "all";

function parseProviderArg(text: string): ProviderName {
  const lower = text.toLowerCase().trim();
  
  if (lower.includes("claude") || lower.includes("anthropic")) {
    return "claude";
  }
  if (lower.includes("copilot") || lower.includes("github")) {
    return "copilot";
  }
  if (lower.includes("openai") || lower.includes("codex") || lower.includes("chatgpt")) {
    return "openai";
  }
  
  return "all";
}

async function fetchUsageData(
  tokens: AuthTokens, 
  provider: ProviderName
): Promise<UsageData[]> {
  const results: UsageData[] = [];
  const fetchPromises: Promise<void>[] = [];
  
  // Claude (placeholder only)
  if ((provider === "all" || provider === "claude") && tokens.claude?.configured) {
    fetchPromises.push(
      fetchClaudeUsage()
        .then(data => { results.push(data); })
    );
  }
  
  // Copilot
  if ((provider === "all" || provider === "copilot") && tokens.copilot?.accessToken) {
    fetchPromises.push(
      fetchCopilotUsage(tokens.copilot.accessToken)
        .then(data => { results.push(data); })
    );
  }
  
  // OpenAI
  if ((provider === "all" || provider === "openai") && tokens.openai?.accessToken) {
    fetchPromises.push(
      fetchOpenAIUsage(tokens.openai.accessToken, tokens.openai.accountId)
        .then(data => { results.push(data); })
    );
  }
  
  // Fetch all in parallel
  await Promise.all(fetchPromises);
  
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
      
      input.command["usage"] = {
        template: `${COMMAND_MARKER}\n$ARGUMENTS`,
        description: "Show AI provider usage",
      };
    },
    
    /**
     * Handle the /usage command
     */
    "chat.message": async (input, output) => {
      const text = output.parts.find((p) => p.type === "text")?.text ?? "";
      
      if (!text.includes(COMMAND_MARKER)) {
        return;
      }
      
      // Extract provider argument from the command
      const args = text.replace(COMMAND_MARKER, "").trim();
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
        await injectResponse(client, input, formatError(`Failed to read auth: ${errorMsg}`));
        return;
      }
      
      // Check if any providers are configured
      const hasProviders = 
        tokens.claude?.configured || 
        tokens.copilot?.accessToken || 
        tokens.openai?.accessToken;
      
      if (!hasProviders) {
        await injectResponse(client, input, formatNoProviders());
        return;
      }
      
      // Fetch usage data
      const usageData = await fetchUsageData(tokens, provider);
      
      if (usageData.length === 0) {
        await injectResponse(client, input, formatNoProviders());
        return;
      }
      
      // Format and display results
      const output_text = formatUsageTable(usageData);
      await injectResponse(client, input, output_text);
    },
  };
}

/**
 * Inject a response directly into the session (bypasses LLM)
 */
async function injectResponse(
  client: PluginInput["client"],
  input: { sessionID: string; agent?: string; model?: { providerID: string; modelID: string } },
  text: string
): Promise<void> {
  await client.session.prompt({
    path: { id: input.sessionID },
    body: {
      noReply: true,
      agent: input.agent,
      model: input.model,
      parts: [
        {
          type: "text",
          text: text,
          ignored: true,
        },
      ],
    },
  });
  
  // Throw to prevent LLM from processing
  throw new Error("__USAGE_TRACKER_HANDLED__");
}
