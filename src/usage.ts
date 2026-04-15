import { fetchCopilotUsage } from "./providers/copilot.ts";
import { fetchOpenAIUsage } from "./providers/openai.ts";
import { fetchZaiUsage } from "./providers/zai.ts";
import { getAuthTokens, type AuthTokens } from "./utils/auth.ts";
import { type UsageData } from "./utils/format.ts";
import {
  getProviderLabel,
  PROVIDER_RESULT_ORDER,
  type ProviderName,
} from "./constants.ts";

export type UsageResult =
  | { kind: "ok"; provider: ProviderName; providers: UsageData[] }
  | { kind: "empty"; provider: ProviderName; message: string }
  | { kind: "error"; provider: ProviderName; message: string };

const PROVIDER_RESULT_ORDER_INDEX = new Map(
  PROVIDER_RESULT_ORDER.map((provider, index) => [provider, index] as const),
);

type SingleProviderName = Exclude<ProviderName, "all">;

export async function fetchUsageResult(provider: ProviderName): Promise<UsageResult> {
  const tokens = await getAuthTokens();

  const hasProviders = Boolean(
    tokens.copilot?.accessToken
      || tokens.openai?.accessToken
      || tokens.zai?.accessToken,
  );
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
  switch (provider) {
    case "copilot":
      return Boolean(tokens.copilot?.accessToken);
    case "openai":
      return Boolean(tokens.openai?.accessToken);
    case "zai":
      return Boolean(tokens.zai?.accessToken);
    case "all":
      return Boolean(
        tokens.copilot?.accessToken
          || tokens.openai?.accessToken
          || tokens.zai?.accessToken,
      );
  }
}

async function fetchUsageData(
  tokens: AuthTokens,
  provider: ProviderName,
): Promise<UsageData[]> {
  type ProviderFetchResult = {
    provider: SingleProviderName;
    request: Promise<UsageData>;
  };

  const results: Array<{ provider: SingleProviderName; value: UsageData }> = [];
  const fetchPromises: ProviderFetchResult[] = [];

  if ((provider === "all" || provider === "copilot") && tokens.copilot?.accessToken) {
    fetchPromises.push({
      provider: "copilot",
      request: fetchCopilotUsage(tokens.copilot.accessToken),
    });
  }

  if ((provider === "all" || provider === "openai") && tokens.openai?.accessToken) {
    fetchPromises.push({
      provider: "openai",
      request: fetchOpenAIUsage(tokens.openai.accessToken, tokens.openai.accountId),
    });
  }

  if ((provider === "all" || provider === "zai") && tokens.zai?.accessToken) {
    fetchPromises.push({
      provider: "zai",
      request: fetchZaiUsage(tokens.zai.accessToken, tokens.zai.baseHost),
    });
  }

  const settled = await Promise.allSettled(fetchPromises.map((item) => item.request));

  for (const [index, result] of settled.entries()) {
    const providerInfo = fetchPromises[index];
    if (!providerInfo) {
      continue;
    }

    if (result.status === "fulfilled") {
      results.push({ provider: providerInfo.provider, value: result.value });
      continue;
    }

    results.push({
      provider: providerInfo.provider,
      value: {
        provider: getProviderLabel(providerInfo.provider),
        windows: [],
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
      },
    });
  }

  results.sort((a, b) => {
    const aIndex = PROVIDER_RESULT_ORDER_INDEX.get(a.provider) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = PROVIDER_RESULT_ORDER_INDEX.get(b.provider) ?? Number.MAX_SAFE_INTEGER;

    return aIndex - bIndex;
  });

  return results.map((item) => item.value);
}
