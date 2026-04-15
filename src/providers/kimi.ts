/**
 * Kimi for Coding usage provider (experimental)
 *
 * Community-confirmed API: https://api.kimi.com/coding/v1/usages
 */

import type { UsageData } from "../utils/format.ts";
import { formatRelativeTime } from "../utils/format.ts";

const KIMI_USAGE_ENDPOINT = "https://api.kimi.com/coding/v1/usages";

interface KimiUsageDetail {
  limit?: string;
  used?: string;
  remaining?: string;
  resetTime?: string;
}

interface KimiRateLimit {
  window?: {
    duration?: number;
    timeUnit?: string;
  };
  detail?: KimiUsageDetail;
}

interface KimiUsageResponse {
  user?: {
    region?: string;
    businessId?: string;
    membership?: {
      level?: string;
    };
  };
  usage?: KimiUsageDetail;
  limits?: KimiRateLimit[];
}

export async function fetchKimiUsage(apiKey: string): Promise<UsageData> {
  try {
    const response = await fetch(KIMI_USAGE_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      return {
        provider: "Kimi for Coding",
        windows: [],
        error: "API key expired or invalid",
      };
    }

    if (!response.ok) {
      return {
        provider: "Kimi for Coding",
        windows: [],
        error: `API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as KimiUsageResponse;
    const windows: UsageData["windows"] = [];
    const extra: Record<string, string> = {};

    const weeklyWindow = toUsageWindow("Weekly", data.usage);
    if (weeklyWindow) {
      windows.push(weeklyWindow);
    }

    for (const limit of data.limits ?? []) {
      const label = getDurationLabel(limit.window?.duration, limit.window?.timeUnit);
      const usageWindow = toUsageWindow(label, limit.detail);
      if (usageWindow) {
        windows.push(usageWindow);
      }
    }

    const planType = formatMembershipLevel(data.user?.membership?.level);

    if (data.user?.region) {
      extra["Region"] = humanizeEnumValue(data.user.region);
    }

    if (data.user?.businessId) {
      extra["Business"] = data.user.businessId;
    }

    return {
      provider: "Kimi for Coding",
      planType,
      windows,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    };
  } catch (error) {
    return {
      provider: "Kimi for Coding",
      windows: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function toUsageWindow(label: string, detail?: KimiUsageDetail) {
  if (!detail) {
    return undefined;
  }

  const usedPercent = getUsedPercent(detail);
  if (usedPercent === null) {
    return undefined;
  }

  const resetDate = detail.resetTime ? new Date(detail.resetTime) : undefined;
  const resetTime = resetDate && !Number.isNaN(resetDate.getTime()) ? formatRelativeTime(resetDate) : undefined;

  return {
    label,
    usedPercent,
    resetTime,
  };
}

function getUsedPercent(detail: KimiUsageDetail): number | null {
  const limit = toNumber(detail.limit);
  const remaining = toNumber(detail.remaining);
  const used = toNumber(detail.used);

  if (limit !== null && remaining !== null && limit > 0) {
    return clampPercent(((limit - remaining) / limit) * 100);
  }

  if (used !== null && used >= 0 && used <= 100) {
    return clampPercent(used);
  }

  return null;
}

function getDurationLabel(duration?: number, timeUnit?: string): string {
  if (!duration || !timeUnit) {
    return "Rate limit";
  }

  const normalizedUnit = timeUnit.toUpperCase();
  if (normalizedUnit === "TIME_UNIT_MINUTE") {
    const hours = duration / 60;
    return Number.isInteger(hours) && hours > 0 ? `${hours}h` : `${duration}m`;
  }

  if (normalizedUnit === "TIME_UNIT_HOUR") {
    return `${duration}h`;
  }

  if (normalizedUnit === "TIME_UNIT_DAY") {
    return duration === 7 ? "Weekly" : `${duration}d`;
  }

  return `${duration} ${humanizeEnumValue(normalizedUnit)}`;
}

function formatMembershipLevel(level?: string): string | undefined {
  if (!level) {
    return undefined;
  }

  return humanizeEnumValue(level);
}

function humanizeEnumValue(value: string): string {
  return value
    .replace(/^(LEVEL_|REGION_|TIME_UNIT_)/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toNumber(value?: string): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
