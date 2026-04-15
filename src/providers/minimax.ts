/**
 * MiniMax Coding Plan usage provider
 *
 * API: https://api.minimax.io/v1/api/openplatform/coding_plan/remains
 */

import type { UsageData } from "../utils/format.ts";
import { formatRelativeTime } from "../utils/format.ts";

const PRIMARY_MINIMAX_CODING_PLAN_ENDPOINT =
  "https://api.minimax.io/v1/api/openplatform/coding_plan/remains";
const FALLBACK_MINIMAX_CODING_PLAN_ENDPOINT =
  "https://www.minimax.io/v1/api/openplatform/coding_plan/remains";

const MODEL_NAME_KEYS = ["model_name", "modelName", "name", "model"];
const INTERVAL_TOTAL_KEYS = ["current_interval_total_count", "currentIntervalTotalCount"];
const INTERVAL_REMAINING_KEYS = [
  "current_interval_usage_count",
  "currentIntervalUsageCount",
  "current_interval_remain_count",
  "currentIntervalRemainCount",
  "current_interval_remaining_count",
  "currentIntervalRemainingCount",
];
const WEEKLY_TOTAL_KEYS = ["current_weekly_total_count", "currentWeeklyTotalCount"];
const WEEKLY_REMAINING_KEYS = ["current_weekly_usage_count", "currentWeeklyUsageCount"];
const INTERVAL_END_KEYS = ["end_time", "endTime", "reset_at", "resetAt"];
const WEEKLY_END_KEYS = ["weekly_end_time", "weeklyEndTime"];
const INTERVAL_REMAINS_MS_KEYS = ["remains_time", "remain_time", "remainsTime", "remainTime"];
const WEEKLY_REMAINS_MS_KEYS = ["weekly_remains_time", "weeklyRemainTime", "weeklyRemainsTime"];
const PERCENT_KEYS = [
  "used_percent",
  "usedPercent",
  "usage_percent",
  "usagePercent",
];
const PLAN_KEYS = ["plan", "plan_type", "planType", "plan_name", "planName"];

interface BaseResp {
  status_code?: unknown;
  status_msg?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return undefined;
}

function pickValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  return toNumber(pickValue(record, keys));
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  return toStringValue(pickValue(record, keys));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function parseStatusCode(value: unknown): number | null {
  const status = toNumber(value);
  return status === null ? null : Math.trunc(status);
}

function parseResetTime(value: unknown, key: string): Date | undefined {
  const raw = toNumber(value);
  if (raw === null || raw <= 0) {
    return undefined;
  }

  const lower = key.toLowerCase();

  // Explicit epoch-like timestamps
  if (lower.includes("at") || lower.includes("expires") || lower.includes("reset")) {
    if (raw > 10_000_000_000) {
      return new Date(raw > 10_000_000_000_000 ? raw : raw * 1000);
    }

    return new Date(raw * 1000);
  }

  if (lower.includes("remain")) {
    return new Date(Date.now() + raw);
  }

  if (raw > 10_000_000_000) {
    return new Date(raw);
  }

  return new Date(Date.now() + raw);
}

function normalizePercentage(value: number): number {
  const normalized = value <= 1 ? value * 100 : value;
  return clampPercent(normalized);
}

function extractModelRemains(data: Record<string, unknown>): unknown[] {
  const rootArray = pickValue(data, ["model_remains", "modelRemains"]);
  if (Array.isArray(rootArray) && rootArray.length > 0) {
    return rootArray;
  }

  const nestedData = pickValue(data, ["data"]);
  if (isRecord(nestedData)) {
    const nestedArray = pickValue(nestedData, ["model_remains", "modelRemains"]);
    if (Array.isArray(nestedArray) && nestedArray.length > 0) {
      return nestedArray;
    }
  }

  return [];
}

function parseModelLabel(index: number, record: Record<string, unknown>): string {
  return pickString(record, MODEL_NAME_KEYS) ?? `Model ${index + 1}`;
}

function parseModelPercent(record: Record<string, unknown>): number | null {
  const directPercent = pickNumber(record, PERCENT_KEYS);
  if (directPercent !== null) {
    return normalizePercentage(directPercent);
  }

  return null;
}

function getStatusCode(payload: Record<string, unknown>): number | null {
  const baseResp = pickValue(payload, ["base_resp"]) as BaseResp | undefined;
  if (isRecord(baseResp)) {
    return parseStatusCode(baseResp.status_code);
  }

  const statusCode = pickValue(payload, ["status_code"]);
  return parseStatusCode(statusCode);
}

function getStatusMessage(payload: Record<string, unknown>): string | undefined {
  const baseResp = pickValue(payload, ["base_resp"]) as BaseResp | undefined;
  if (isRecord(baseResp)) {
    const message = toStringValue(baseResp.status_msg);
    if (message) {
      return message;
    }
  }

  return undefined;
}

function shouldFallback(status: number): boolean {
  return status === 404 || status === 502 || status >= 500;
}

function buildEndpoints(groupId?: string): string[] {
  const suffix = groupId ? `?GroupId=${encodeURIComponent(groupId)}` : "";
  return [
    `${PRIMARY_MINIMAX_CODING_PLAN_ENDPOINT}${suffix}`,
    `${FALLBACK_MINIMAX_CODING_PLAN_ENDPOINT}${suffix}`,
  ];
}

async function fetchCodingPlanPayload(apiKey: string, groupId?: string): Promise<Response> {
  const endpoints = buildEndpoints(groupId);
  let fallbackResponse: Response | null = null;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    if (!endpoint) {
      continue;
    }

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (i === 0 && !response.ok && shouldFallback(response.status)) {
        fallbackResponse = response;
        continue;
      }

      return response;
    } catch (error) {
      if (i === 0) {
        continue;
      }

      throw error instanceof Error ? error : new Error("Failed to fetch MiniMax usage data");
    }
  }

  if (fallbackResponse) {
    return fallbackResponse;
  }

  throw new Error("Failed to fetch MiniMax usage data");
}

export async function fetchMinimaxUsage(apiKey: string, groupId?: string): Promise<UsageData> {
  try {
    const response = await fetchCodingPlanPayload(apiKey, groupId);

    if (response.status === 401) {
      return {
        provider: "MiniMax Coding Plan",
        windows: [],
        error: "API key expired or invalid",
      };
    }

    if (!response.ok) {
      return {
        provider: "MiniMax Coding Plan",
        windows: [],
        error: `HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as unknown;
    if (!isRecord(payload)) {
      return {
        provider: "MiniMax Coding Plan",
        windows: [],
        error: "Unexpected MiniMax response format",
      };
    }

    const baseStatusCode = getStatusCode(payload);
    if (baseStatusCode !== null && baseStatusCode !== 0) {
      return {
        provider: "MiniMax Coding Plan",
        windows: [],
        error: `MiniMax API error (${baseStatusCode}): ${getStatusMessage(payload) ?? "request failed"}`,
      };
    }

    const modelRows = extractModelRemains(payload);
    if (modelRows.length === 0) {
      return {
        provider: "MiniMax Coding Plan",
        windows: [],
        error: "No model_remains data in MiniMax response",
      };
    }

    const windows = [] as UsageData["windows"];
    const extra: Record<string, string> = {};
    const modelNames = new Set<string>();

    for (let index = 0; index < modelRows.length; index++) {
      const row = modelRows[index];
      if (!isRecord(row)) {
        continue;
      }

      const modelName = pickString(row, MODEL_NAME_KEYS);
      if (modelName) {
        modelNames.add(modelName);
      }

      const intervalTotal = pickNumber(row, INTERVAL_TOTAL_KEYS);
      const intervalRemaining = pickNumber(row, INTERVAL_REMAINING_KEYS);
      if (intervalTotal !== null && intervalRemaining !== null && intervalTotal > 0) {
        const usedPercent = normalizePercentage(((intervalTotal - intervalRemaining) / intervalTotal) * 100);
        const intervalEndKey = INTERVAL_END_KEYS.find((key) => key in row);
        const intervalResetDate = intervalEndKey
          ? parseResetTime(row[intervalEndKey], intervalEndKey)
          : (() => {
              const remainKey = INTERVAL_REMAINS_MS_KEYS.find((key) => key in row);
              return remainKey ? parseResetTime(row[remainKey], remainKey) : undefined;
            })();

        windows.push({
          label: modelRows.length > 1 ? `${parseModelLabel(index, row)} 5h` : "5h",
          usedPercent,
          resetTime: intervalResetDate ? formatRelativeTime(intervalResetDate) : undefined,
        });

        extra[modelRows.length > 1 ? `${parseModelLabel(index, row)} 5h remaining` : "5h remaining"] = `${Math.max(0, intervalRemaining)}/${intervalTotal}`;
      }

      const weeklyTotal = pickNumber(row, WEEKLY_TOTAL_KEYS);
      const weeklyRemaining = pickNumber(row, WEEKLY_REMAINING_KEYS);
      if (weeklyTotal !== null && weeklyRemaining !== null && weeklyTotal > 0) {
        const usedPercent = normalizePercentage(((weeklyTotal - weeklyRemaining) / weeklyTotal) * 100);
        const weeklyEndKey = WEEKLY_END_KEYS.find((key) => key in row);
        const weeklyResetDate = weeklyEndKey
          ? parseResetTime(row[weeklyEndKey], weeklyEndKey)
          : (() => {
              const remainKey = WEEKLY_REMAINS_MS_KEYS.find((key) => key in row);
              return remainKey ? parseResetTime(row[remainKey], remainKey) : undefined;
            })();

        windows.push({
          label: modelRows.length > 1 ? `${parseModelLabel(index, row)} weekly` : "Weekly",
          usedPercent,
          resetTime: weeklyResetDate ? formatRelativeTime(weeklyResetDate) : undefined,
        });

        extra[modelRows.length > 1 ? `${parseModelLabel(index, row)} weekly remaining` : "Weekly remaining"] = `${Math.max(0, weeklyRemaining)}/${weeklyTotal}`;
      }

      const directPercent = parseModelPercent(row);
      if (directPercent !== null && windows.length === 0) {
        windows.push({
          label: parseModelLabel(index, row),
          usedPercent: directPercent,
        });
      }
    }

    if (windows.length === 0) {
      return {
        provider: "MiniMax Coding Plan",
        windows: [],
        error: "No parseable quota windows were returned by MiniMax",
      };
    }

    const names = [...modelNames].filter(Boolean);
    if (names.length === 1) {
      extra["Model"] = names[0] ?? "";
    } else if (names.length > 1) {
      extra["Models"] = names.join(", ");
    }

    const planType = pickString(pickValue(payload, ["data"]) as Record<string, unknown> ?? payload, PLAN_KEYS);
    if (planType) {
      extra["Plan"] = planType;
    }

    return {
      provider: "MiniMax Coding Plan",
      windows,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    };
  } catch (error) {
    return {
      provider: "MiniMax Coding Plan",
      windows: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
