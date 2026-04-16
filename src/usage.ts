import { fetchCopilotUsage } from "./providers/copilot.ts";
import { fetchKimiUsage } from "./providers/kimi.ts";
import { fetchOpenAIUsage } from "./providers/openai.ts";
import { getAuthTokens, type AuthTokens } from "./utils/auth.ts";
import { type UsageData } from "./utils/format.ts";
import {
  PROVIDER_METADATA,
  PROVIDER_ORDER,
  type ConcreteProviderName,
  type ProviderName,
} from "./constants.ts";

export type UsageResult =
  | { kind: "ok"; provider: ProviderName; providers: UsageData[] }
  | { kind: "empty"; provider: ProviderName; message: string }
  | { kind: "error"; provider: ProviderName; message: string };

export async function fetchUsageResult(provider: ProviderName): Promise<UsageResult> {
  const tokens = await getAuthTokens();

  const hasProviders = getProviderFetchers(tokens).length > 0;
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
    return getProviderFetchers(tokens).length > 0;
  }

  return getProviderFetchers(tokens).some((fetcher) => fetcher.provider === provider);
}

async function fetchUsageData(tokens: AuthTokens, provider: ProviderName): Promise<UsageData[]> {
  const fetchers = getProviderFetchers(tokens).filter(
    (fetcher) => provider === "all" || fetcher.provider === provider,
  );
  const results: UsageData[] = [];
  const settled = await Promise.allSettled(fetchers.map((fetcher) => fetcher.request()));

  for (const [index, result] of settled.entries()) {
    const providerInfo = fetchers[index];
    if (!providerInfo) {
      continue;
    }

    if (result.status === "fulfilled") {
      results.push(...result.value);
      continue;
    }

    results.push({
      provider: providerInfo.name,
      windows: [],
      error: result.reason instanceof Error ? result.reason.message : "Unknown error",
    });
  }

  return results;
}

type ProviderFetcher = {
  provider: ConcreteProviderName;
  name: string;
  request: () => Promise<UsageData[]>;
};

function getProviderFetchers(tokens: AuthTokens): ProviderFetcher[] {
  const openAIAuth = tokens.openai;
  const copilotAccessToken = tokens.copilot?.accessToken;
  const kimiApiKey = tokens.kimi?.apiKey;

  const fetchers: Partial<Record<ConcreteProviderName, ProviderFetcher>> = {
    openai: openAIAuth
      ? {
          provider: "openai",
          name: PROVIDER_METADATA.openai.label,
          request: () => fetchOpenAIUsage(openAIAuth),
        }
      : undefined,
    copilot: copilotAccessToken
      ? {
          provider: "copilot",
          name: PROVIDER_METADATA.copilot.label,
          request: () => fetchCopilotUsage(copilotAccessToken).then((usage) => [usage]),
        }
      : undefined,
    kimi: kimiApiKey
      ? {
          provider: "kimi",
          name: PROVIDER_METADATA.kimi.label,
          request: () => fetchKimiUsage(kimiApiKey).then((usage) => [usage]),
        }
      : undefined,
  };

  return PROVIDER_ORDER.flatMap((provider) => {
    const fetcher = fetchers[provider];
    return fetcher ? [fetcher] : [];
  });
}
