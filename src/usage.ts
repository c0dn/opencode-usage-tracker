import { fetchCopilotUsage } from "./providers/copilot.ts";
import { fetchKimiUsage } from "./providers/kimi.ts";
import { fetchOpenAIUsage } from "./providers/openai.ts";
import { getAuthTokens, type AuthTokens } from "./utils/auth.ts";
import { type UsageData } from "./utils/format.ts";
import {
  PROVIDER_METADATA,
  getProviderLabel,
  type ProviderName,
  type SingleProviderName,
} from "./constants.ts";

export type UsageResult =
  | { kind: "ok"; provider: ProviderName; providers: UsageData[] }
  | { kind: "empty"; provider: ProviderName; message: string }
  | { kind: "error"; provider: ProviderName; message: string };

export async function fetchUsageResult(provider: ProviderName): Promise<UsageResult> {
  const tokens = await getAuthTokens();

  const hasProviders = hasAnyProviderConfigured(tokens);
  if (!hasProviders) {
    return {
      kind: "empty",
      provider,
      message: "No providers configured. Add tokens to auth.json first.",
    };
  }

  if (!isProviderConfigured(tokens, provider)) {
    return {
      kind: "error",
      provider,
      message: `Provider not configured: ${provider}`,
    };
  }

  const usageData = await fetchUsageData(tokens, provider);

  if (usageData.length === 0) {
    return {
      kind: "empty",
      provider,
      message: "No usage data available.",
    };
  }

  return {
    kind: "ok",
    provider,
    providers: usageData,
  };
}

function isProviderConfigured(tokens: AuthTokens, provider: ProviderName): boolean {
  if (provider === "all") {
    return hasAnyProviderConfigured(tokens);
  }

  return PROVIDER_CONFIG_CHECKS[provider](tokens);
}

function hasAnyProviderConfigured(tokens: AuthTokens): boolean {
  return PROVIDER_METADATA.some((provider) => PROVIDER_CONFIG_CHECKS[provider.id](tokens));
}

const PROVIDER_CONFIG_CHECKS: Record<SingleProviderName, (tokens: AuthTokens) => boolean> = {
  copilot: (tokens) => Boolean(tokens.copilot?.accessToken),
  openai: (tokens) => Boolean(tokens.openai?.accessToken),
  kimi: (tokens) => Boolean(tokens.kimi?.apiKey),
};

const PROVIDER_USAGE_FETCHERS: Record<SingleProviderName, (tokens: AuthTokens) => Promise<UsageData>> = {
  copilot: (tokens) => fetchCopilotUsage(tokens.copilot?.accessToken ?? ""),
  openai: (tokens) => fetchOpenAIUsage(tokens.openai?.accessToken ?? "", tokens.openai?.accountId),
  kimi: (tokens) => fetchKimiUsage(tokens.kimi?.apiKey ?? ""),
};

async function fetchUsageData(
  tokens: AuthTokens,
  provider: ProviderName,
): Promise<UsageData[]> {
  const results: UsageData[] = [];
  const selectedProviders = provider === "all"
    ? PROVIDER_METADATA
    : PROVIDER_METADATA.filter((metadata) => metadata.id === provider);

  const fetchPromises: Array<{ provider: SingleProviderName; request: Promise<UsageData> }> = [];

  for (const providerMetadata of selectedProviders) {
    if (!PROVIDER_CONFIG_CHECKS[providerMetadata.id](tokens)) {
      continue;
    }

    fetchPromises.push({
      provider: providerMetadata.id,
      request: PROVIDER_USAGE_FETCHERS[providerMetadata.id](tokens),
    });
  }

  const settled = await Promise.allSettled(fetchPromises.map((item) => item.request));

  for (const [index, result] of settled.entries()) {
    const providerInfo = fetchPromises[index];
    if (!providerInfo) {
      continue;
    }

    const providerLabel = getProviderLabel(providerInfo.provider);

    if (result.status === "fulfilled") {
      results.push({ ...result.value, provider: providerLabel });
      continue;
    }

    results.push({
      provider: providerLabel,
      windows: [],
      error: result.reason instanceof Error ? result.reason.message : "Unknown error",
    });
  }

  return results;
}
