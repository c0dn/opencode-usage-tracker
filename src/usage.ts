import { fetchCopilotUsage } from "./providers/copilot.ts";
import { fetchOpenAIUsage } from "./providers/openai.ts";
import { getAuthTokens, type AuthTokens } from "./utils/auth.ts";
import {
  formatError,
  formatNoProviders,
  formatUsageTable,
  type UsageData,
} from "./utils/format.ts";
import type { ProviderName } from "./constants.ts";

export async function buildUsageTable(provider: ProviderName): Promise<string> {
  const tokens = await getAuthTokens();

  const hasProviders = Boolean(tokens.copilot?.accessToken || tokens.openai?.accessToken);
  if (!hasProviders) {
    return formatNoProviders();
  }

  if (!isProviderConfigured(tokens, provider)) {
    return formatError(`Provider not configured: ${provider}`);
  }

  const usageData = await fetchUsageData(tokens, provider);

  if (usageData.length === 0) {
    return formatNoProviders();
  }

  return formatUsageTable(usageData);
}

function isProviderConfigured(tokens: AuthTokens, provider: ProviderName): boolean {
  switch (provider) {
    case "copilot":
      return Boolean(tokens.copilot?.accessToken);
    case "openai":
      return Boolean(tokens.openai?.accessToken);
    case "all":
      return Boolean(tokens.copilot?.accessToken || tokens.openai?.accessToken);
  }
}

async function fetchUsageData(
  tokens: AuthTokens,
  provider: ProviderName,
): Promise<UsageData[]> {
  const results: UsageData[] = [];
  const fetchPromises: Array<{ name: string; request: Promise<UsageData> }> = [];

  if ((provider === "all" || provider === "copilot") && tokens.copilot?.accessToken) {
    fetchPromises.push({
      name: "GitHub Copilot",
      request: fetchCopilotUsage(tokens.copilot.accessToken),
    });
  }

  if ((provider === "all" || provider === "openai") && tokens.openai?.accessToken) {
    fetchPromises.push({
      name: "OpenAI/Codex",
      request: fetchOpenAIUsage(tokens.openai.accessToken, tokens.openai.accountId),
    });
  }

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

  const order = ["GitHub Copilot", "OpenAI/Codex"];
  results.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));

  return results;
}
