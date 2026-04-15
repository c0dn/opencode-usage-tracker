/**
 * Z.AI usage provider
 *
 * API: GET /api/monitor/usage/quota/limit
 * Docs: https://docs.z.ai/devpack/extension/usage-query-plugin
 */

import type { UsageData } from "../utils/format.ts";
import { formatRelativeTime } from "../utils/format.ts";

const DEFAULT_ZAI_BASE_HOST = "https://api.z.ai";
const ZAI_USAGE_ENDPOINT = "/api/monitor/usage/quota/limit";

interface ZaiLimitUsageDetail {
  modelCode?: string;
  usage?: number;
}

interface ZaiLimit {
  type?: string;
  unit?: number;
  number?: number;
  usage?: number;
  currentValue?: number;
  remaining?: number;
  percentage?: number;
  nextResetTime?: number;
  usageDetails?: ZaiLimitUsageDetail[];
}

interface ZaiUsageResponse {
  data?: {
    limits?: ZaiLimit[];
  };
  limits?: ZaiLimit[];
}

function normalizeHost(baseHost?: string): string {
  if (!baseHost) {
    return DEFAULT_ZAI_BASE_HOST;
  }

  const trimmed = baseHost.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return DEFAULT_ZAI_BASE_HOST;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_ZAI_BASE_HOST;
  }
}

function getAuthVariants(apiKey: string): string[] {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return [];
  }

  const variants = [trimmed];
  const hasBearerPrefix = /^bearer\s+/i.test(trimmed);
  if (!hasBearerPrefix) {
    variants.push(`Bearer ${trimmed}`);
  }

  return variants;
}

function buildLabel(limit: ZaiLimit): string {
  const type = limit.type;
  if (type === "TOKENS_LIMIT") {
    if (limit.unit === 3 && limit.number === 5) {
      return "Session (5h)";
    }
    if (limit.unit === 6 && limit.number === 7) {
      return "Weekly";
    }
    return "Tokens";
  }

  if (type === "TIME_LIMIT") {
    if (limit.unit === 5 && limit.number === 1) {
      return "Web Search";
    }
    return "Time";
  }

  if (limit.unit === 3 && limit.number === 5) {
    return "Session (5h)";
  }

  if (limit.unit === 6 && limit.number === 7) {
    return "Weekly";
  }

  if (limit.unit === 5 && limit.number === 1) {
    return "Monthly";
  }

  return type || "Usage";
}

function parsePercentage(limit: ZaiLimit): number {
  if (typeof limit.percentage === "number" && Number.isFinite(limit.percentage)) {
    return limit.percentage;
  }

  if (typeof limit.currentValue === "number" && typeof limit.usage === "number" && limit.usage > 0) {
    return (limit.currentValue / limit.usage) * 100;
  }

  return 0;
}

function parseResetTime(limit: ZaiLimit): string | undefined {
  if (typeof limit.nextResetTime === "number" && Number.isFinite(limit.nextResetTime)) {
    const milliseconds = limit.nextResetTime > 2_000_000_000_000
      ? limit.nextResetTime
      : limit.nextResetTime * 1000;

    return formatRelativeTime(new Date(milliseconds));
  }

  return undefined;
}

function readLimits(response: unknown): ZaiLimit[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const data = response as ZaiUsageResponse;
  const limits = data.data?.limits || data.limits;
  if (!Array.isArray(limits)) {
    return [];
  }

  return limits;
}

export async function fetchZaiUsage(
  accessToken: string,
  baseHost?: string,
): Promise<UsageData> {
  try {
    const variants = getAuthVariants(accessToken);
    const url = `${normalizeHost(baseHost)}${ZAI_USAGE_ENDPOINT}`;

    if (variants.length === 0) {
      return {
        provider: "Z.AI",
        windows: [],
        error: "No API key found",
      };
    }

    let response: Response | null = null;

    for (const token of variants) {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: token,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (response.status !== 401 && response.status !== 403) {
        break;
      }

      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
      }
    }

    if (!response) {
      return {
        provider: "Z.AI",
        windows: [],
        error: "No response from Z.AI usage endpoint",
      };
    }

    if (response.status === 401) {
      return {
        provider: "Z.AI",
        windows: [],
        error: "API key invalid",
      };
    }

    if (response.status === 403) {
      return {
        provider: "Z.AI",
        windows: [],
        error: "API access denied",
      };
    }

    if (!response.ok) {
      return {
        provider: "Z.AI",
        windows: [],
        error: `HTTP ${response.status}`,
      };
    }

    const raw = (await response.json()) as unknown;
    const limits = readLimits(raw);

    const windows: UsageData["windows"] = [];
    const extra: Record<string, string> = {};

    for (const limit of limits) {
      if (!limit || typeof limit !== "object") {
        continue;
      }

      const label = buildLabel(limit);
      const usedPercent = parsePercentage(limit);
      const resetTime = parseResetTime(limit);

      windows.push({
        label,
        usedPercent,
        resetTime,
      });

      if (typeof limit.currentValue === "number" && typeof limit.usage === "number") {
        extra[`${label} Used`] = `${limit.currentValue}/${limit.usage}`;
      }

      if (typeof limit.remaining === "number") {
        extra[`${label} Remaining`] = `${limit.remaining}`;
      }

      if (Array.isArray(limit.usageDetails) && limit.usageDetails.length > 0) {
        const modelUsage = limit.usageDetails
          .map((detail) => {
            const modelCode = detail?.modelCode?.trim();
            const modelUsageValue = detail?.usage;
            if (!modelCode || typeof modelUsageValue !== "number") {
              return undefined;
            }
            return `${modelCode}: ${modelUsageValue}`;
          })
          .filter((item): item is string => item !== undefined);

        if (modelUsage.length > 0) {
          extra[`${label} Model Usage`] = modelUsage.join(", ");
        }
      }
    }

    windows.sort((a, b) => {
      if (a.label === "Session (5h)") {
        return -1;
      }
      if (b.label === "Session (5h)") {
        return 1;
      }
      return 0;
    });

    return {
      provider: "Z.AI",
      windows,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    };
  } catch {
    return {
      provider: "Z.AI",
      windows: [],
      error: "Usage request failed",
    };
  }
}
